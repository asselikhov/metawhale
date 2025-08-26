/**
 * Script to refund specific escrow by ID
 * This script will refund tokens from a specific smart contract escrow ID directly
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');
const { ethers } = require('ethers');

async function refundSpecificEscrow(escrowId, userChatId, useAdminKey = false) {
  try {
    console.log(`🔄 Attempting to refund specific escrow ID: ${escrowId} for user: ${userChatId}`);
    console.log(`   Using admin key: ${useAdminKey}`);
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`   Wallet address: ${user.walletAddress}`);
    
    // Check escrow details
    console.log(`🔍 Checking escrow details for ID: ${escrowId}`);
    const escrowDetails = await smartContractService.getEscrowDetails(escrowId);
    console.log(`   Status: ${smartContractService.getEscrowStatusText(escrowDetails.status)} (${escrowDetails.status})`);
    console.log(`   Amount: ${escrowDetails.amount} CES`);
    console.log(`   Seller: ${escrowDetails.seller}`);
    console.log(`   Buyer: ${escrowDetails.buyer}`);
    
    // Check if escrow can be refunded
    const refundCheck = await smartContractService.canRefundEscrow(escrowId);
    console.log(`   Can refund: ${refundCheck.canRefund}`);
    console.log(`   Status text: ${refundCheck.statusText}`);
    
    if (!refundCheck.canRefund) {
      console.log(`❌ Escrow cannot be refunded. Status: ${refundCheck.statusText}`);
      
      // Check if there's already a refund transaction
      const existingRefund = await EscrowTransaction.findOne({
        userId: user._id,
        type: 'refund',
        smartContractEscrowId: escrowId
      });
      
      if (existingRefund) {
        console.log(`⚠️ Escrow was already refunded (transaction ${existingRefund._id})`);
        return { success: false, reason: 'Already refunded' };
      }
      
      return { success: false, reason: `Cannot refund: ${refundCheck.statusText}` };
    }
    
    let refundResult;
    
    if (useAdminKey) {
      // Use admin private key
      console.log(`🔐 Using admin private key...`);
      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
      }
      
      // Create provider and wallet
      const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
      const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
      
      console.log(`✅ Admin wallet: ${adminWallet.address}`);
      
      // Create contract instance
      const escrowContract = new ethers.Contract(
        process.env.ESCROW_CONTRACT_ADDRESS || '0x04B16d50949CD92de90fbadcF49745897CbED5C4',
        smartContractService.escrowABI,
        adminWallet
      );
      
      // Get current gas price
      const gasPrice = await provider.getGasPrice();
      console.log(`   Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
      
      // Send transaction to recover escrow
      console.log(`💸 Sending refund transaction with admin key...`);
      const tx = await escrowContract.refundEscrow(escrowId, {
        gasLimit: 300000,
        gasPrice: gasPrice.mul(120).div(100) // 20% higher gas price
      });
      
      console.log(`   Transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      console.log(`   Waiting for confirmation...`);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Successfully refunded escrow ID: ${escrowId}`);
        console.log(`   Transaction hash: ${tx.hash}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        
        refundResult = {
          success: true,
          txHash: tx.hash
        };
      } else {
        console.log(`❌ Failed to refund escrow - transaction reverted`);
        return { success: false, reason: 'Transaction reverted' };
      }
    } else {
      // Use user's private key
      console.log(`🔐 Getting user's private key...`);
      const userPrivateKey = await walletService.getUserPrivateKey(userChatId);
      if (!userPrivateKey) {
        throw new Error('Failed to get user private key');
      }
      
      // Execute refund
      console.log(`💸 Executing refund transaction...`);
      refundResult = await smartContractService.refundSmartEscrow(
        escrowId,
        userPrivateKey
      );
    }
    
    if (refundResult.success) {
      console.log(`✅ Successfully refunded escrow ID: ${escrowId}`);
      console.log(`   Transaction hash: ${refundResult.txHash}`);
      
      // Update database to reflect the refund
      console.log(`💾 Updating database records...`);
      
      // Update user balances (move tokens from escrow back to available)
      const amount = parseFloat(escrowDetails.amount);
      user.escrowCESBalance = Math.max(0, (user.escrowCESBalance || 0) - amount);
      user.cesBalance = (user.cesBalance || 0) + amount;
      await user.save();
      
      console.log(`   Updated user balances:`);
      console.log(`     Available CES: ${user.cesBalance}`);
      console.log(`     Escrowed CES: ${user.escrowCESBalance}`);
      
      // Create refund transaction record
      const escrowTx = new EscrowTransaction({
        userId: user._id,
        tradeId: null, // This was an order escrow, not a trade escrow
        type: 'refund',
        tokenType: 'CES',
        amount: amount,
        status: 'completed',
        txHash: refundResult.txHash,
        smartContractEscrowId: escrowId,
        reason: useAdminKey ? 'Manual refund of specific escrow tokens using admin key' : 'Manual refund of specific escrow tokens',
        completedAt: new Date()
      });
      
      await escrowTx.save();
      console.log(`   Created refund transaction record: ${escrowTx._id}`);
      
      return { success: true, amount: amount, txHash: refundResult.txHash };
    } else {
      console.log(`❌ Failed to refund escrow`);
      return { success: false, reason: 'Refund transaction failed' };
    }
    
  } catch (error) {
    console.error(`❌ Error refunding specific escrow: ${error.message}`);
    console.error(error.stack);
    return { success: false, reason: error.message };
  }
}

// Main function
async function main() {
  console.log('💰 Manual Specific Escrow Refund Script');
  console.log('=====================================');
  
  try {
    // Connect to database first
    await connectDatabase();
    
    // Refund the specific escrow (ID 15 based on logs)
    console.log('\n🔄 First attempt with user key...');
    let result = await refundSpecificEscrow('15', '942851377', false);
    
    if (!result.success) {
      console.log('\n🔄 First attempt failed, trying with admin key...');
      result = await refundSpecificEscrow('15', '942851377', true);
    }
    
    if (result.success) {
      console.log('\n✅ Escrow refund completed successfully');
      console.log(`   Amount: ${result.amount} CES`);
      console.log(`   Transaction: ${result.txHash}`);
    } else {
      console.log(`\n❌ Failed to refund escrow: ${result.reason}`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
  
  console.log('\n🏁 Script execution completed');
}

// Run the script if executed directly
if (require.main === module) {
  main().then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Script failed with error:', error);
    process.exit(1);
  });
}

module.exports = { refundSpecificEscrow };