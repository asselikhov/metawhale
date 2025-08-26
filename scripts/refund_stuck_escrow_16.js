/**
 * Script to manually refund stuck escrow ID 16 using admin privileges
 * This addresses the order cancellation bug where refund transactions were failing
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const { ethers } = require('ethers');

async function refundStuckEscrow(escrowId, userChatId) {
  try {
    console.log(`🔄 Attempting to refund stuck escrow ID: ${escrowId} for user: ${userChatId}`);
    
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
    
    // Use admin private key to refund the escrow
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
    
    // Get current gas price with higher premium
    const gasPrice = await provider.getGasPrice();
    console.log(`   Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    
    // Send transaction to recover escrow with higher gas settings
    console.log(`💸 Sending refund transaction with admin key...`);
    const tx = await escrowContract.refundEscrow(escrowId, {
      gasLimit: 500000, // Increased gas limit
      gasPrice: gasPrice.mul(150).div(100) // 50% higher gas price for reliability
    });
    
    console.log(`   Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    console.log(`   Waiting for confirmation...`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`✅ Successfully refunded escrow ID: ${escrowId}`);
      console.log(`   Transaction hash: ${tx.hash}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      
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
        txHash: tx.hash,
        smartContractEscrowId: escrowId,
        reason: 'Manual refund of stuck escrow tokens using admin key (order cancellation bug fix)',
        completedAt: new Date()
      });
      
      await escrowTx.save();
      console.log(`   Created refund transaction record: ${escrowTx._id}`);
      
      return { success: true, amount: amount, txHash: tx.hash };
    } else {
      console.log(`❌ Failed to refund escrow - transaction reverted`);
      return { success: false, reason: 'Transaction reverted' };
    }
    
  } catch (error) {
    console.error(`❌ Error refunding stuck escrow: ${error.message}`);
    console.error(error.stack);
    return { success: false, reason: error.message };
  }
}

// Main function
async function main() {
  console.log('💰 Manual Stuck Escrow Refund Script (Order Cancellation Bug Fix)');
  console.log('=============================================================');
  
  try {
    // Connect to database first
    await connectDatabase();
    
    // Refund the stuck escrow (ID 16 based on logs)
    const result = await refundStuckEscrow('16', '942851377');
    
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

module.exports = { refundStuckEscrow };