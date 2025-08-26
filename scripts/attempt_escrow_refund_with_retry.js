/**
 * Script to attempt escrow refund with different parameters
 */

const { connectDatabase } = require('../src/database/models');
const { User } = require('../src/database/models');
const { ethers } = require('ethers');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');

async function attemptRefundWithRetry(escrowId, userChatId) {
  console.log(`🔄 Attempting refund for escrow ID: ${escrowId} with retry parameters`);
  
  try {
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    
    // Check escrow details
    console.log(`🔍 Checking escrow details for ID: ${escrowId}`);
    const escrowDetails = await smartContractService.getEscrowDetails(escrowId);
    console.log(`   Status: ${smartContractService.getEscrowStatusText(escrowDetails.status)} (${escrowDetails.status})`);
    console.log(`   Amount: ${escrowDetails.amount} CES`);
    
    // Check if escrow can be refunded
    const refundCheck = await smartContractService.canRefundEscrow(escrowId);
    console.log(`   Can refund: ${refundCheck.canRefund}`);
    
    if (!refundCheck.canRefund) {
      console.log(`ℹ️ Escrow cannot be refunded. Status: ${refundCheck.statusText}`);
      return { success: false, reason: `Cannot refund - ${refundCheck.statusText}` };
    }
    
    // Get user's private key
    console.log(`🔐 Getting user's private key...`);
    const userPrivateKey = await walletService.getUserPrivateKey(userChatId);
    if (!userPrivateKey) {
      throw new Error('Failed to get user private key');
    }
    
    // Create wallet and contract instances
    const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
    const wallet = new ethers.Wallet(userPrivateKey, provider);
    const escrowContract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS || '0x04B16d50949CD92de90fbadcF49745897CbED5C4',
      smartContractService.escrowABI,
      wallet
    );
    
    // Try with different gas parameters
    console.log(`💸 Executing refund transaction with adjusted parameters...`);
    
    // Get current gas price
    const gasPrice = await provider.getGasPrice();
    console.log(`   Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    
    // Try with higher gas price and gas limit
    const tx = await escrowContract.refundEscrow(escrowId, {
      gasLimit: 300000, // Higher gas limit
      gasPrice: gasPrice.mul(150).div(100) // 50% higher gas price
    });
    
    console.log(`   Transaction sent: ${tx.hash}`);
    console.log(`   Gas limit: 300000`);
    console.log(`   Gas price: ${ethers.utils.formatUnits(tx.gasPrice, 'gwei')} Gwei`);
    
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
      
      return { success: true, amount: amount, txHash: tx.hash };
    } else {
      console.log(`❌ Failed to refund escrow - transaction reverted`);
      return { success: false, reason: 'Transaction reverted' };
    }
    
  } catch (error) {
    console.error(`❌ Error refunding escrow: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function attemptAllRefunds(userChatId) {
  console.log(`🔄 Attempting refunds for all stuck escrows with retry parameters`);
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Define stuck escrows that can still be refunded
    const refundableEscrows = ['13', '12'];
    
    console.log(`📋 Attempting refund for ${refundableEscrows.length} escrows:`);
    
    let totalRefunded = 0;
    let refundResults = [];
    
    for (const escrowId of refundableEscrows) {
      console.log(`\n--- Attempting Refund for Escrow ${escrowId} ---`);
      const result = await attemptRefundWithRetry(escrowId, userChatId);
      refundResults.push({
        escrowId,
        ...result
      });
      
      if (result.success) {
        totalRefunded += result.amount;
      }
    }
    
    console.log(`\n📊 Refund Summary:`);
    console.log(`   Total escrows attempted: ${refundableEscrows.length}`);
    console.log(`   Total successfully refunded: ${totalRefunded} CES`);
    
    console.log(`\n📋 Detailed Results:`);
    for (const result of refundResults) {
      if (result.success) {
        console.log(`   ✅ Escrow ${result.escrowId}: Successfully refunded ${result.amount} CES`);
        console.log(`      Transaction: ${result.txHash}`);
      } else {
        console.log(`   ❌ Escrow ${result.escrowId}: Failed - ${result.reason}`);
      }
    }
    
    // Final user balance
    const updatedUser = await User.findOne({ chatId: userChatId });
    console.log(`\n💰 Final User Balance:`);
    console.log(`   Available CES: ${updatedUser.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${updatedUser.escrowCESBalance || 0}`);
    
    return refundResults;
    
  } catch (error) {
    console.error('❌ Error attempting all refunds:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🔄 Escrow Refund with Retry Parameters');
  console.log('====================================');
  
  try {
    const results = await attemptAllRefunds('942851377');
    console.log('\n✅ Refund attempts completed');
    return results;
  } catch (error) {
    console.error('❌ Refund attempts failed:', error.message);
    throw error;
  }
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

module.exports = { attemptAllRefunds };