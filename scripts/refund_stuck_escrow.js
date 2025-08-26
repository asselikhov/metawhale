/**
 * Script to manually refund stuck escrow tokens
 * This script will refund tokens from a specific smart contract escrow ID
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');

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
    
    if (!refundCheck.canRefund) {
      console.log(`❌ Escrow cannot be refunded. Status: ${refundCheck.statusText}`);
      return false;
    }
    
    // Get user's private key
    console.log(`🔐 Getting user's private key...`);
    const userPrivateKey = await walletService.getUserPrivateKey(userChatId);
    if (!userPrivateKey) {
      throw new Error('Failed to get user private key');
    }
    
    // Execute refund
    console.log(`💸 Executing refund transaction...`);
    const refundResult = await smartContractService.refundSmartEscrow(
      escrowId,
      userPrivateKey
    );
    
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
        reason: 'Manual refund of stuck escrow tokens',
        completedAt: new Date()
      });
      
      await escrowTx.save();
      console.log(`   Created refund transaction record: ${escrowTx._id}`);
      
      return true;
    } else {
      console.log(`❌ Failed to refund escrow`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error refunding stuck escrow: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// Function to return 2 CES to the user (as requested)
async function returnTokensToUser(userChatId, amount) {
  try {
    console.log(`🔄 Returning ${amount} CES to user ${userChatId}`);
    
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    // Add tokens to user's available balance
    user.cesBalance = (user.cesBalance || 0) + amount;
    await user.save();
    
    console.log(`✅ Successfully added ${amount} CES to user's balance`);
    console.log(`   New available balance: ${user.cesBalance} CES`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error returning tokens to user: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('💰 Manual Escrow Refund Script');
  console.log('==============================');
  
  try {
    // Connect to database first
    await connectDatabase();
    
    // Refund the stuck escrow (ID 13 based on logs)
    const escrowRefunded = await refundStuckEscrow('13', '942851377');
    
    if (escrowRefunded) {
      console.log('\n✅ Escrow refund completed successfully');
      
      // Now return the 2 CES to the user as requested
      console.log('\n🔄 Returning 2 CES to user as requested...');
      const tokensReturned = await returnTokensToUser('942851377', 2);
      
      if (tokensReturned) {
        console.log('✅ Successfully returned 2 CES to user');
      } else {
        console.log('❌ Failed to return 2 CES to user');
      }
    } else {
      console.log('\n❌ Failed to refund stuck escrow');
      
      // Even if escrow refund failed, still return the 2 CES to the user as requested
      console.log('\n🔄 Returning 2 CES to user as requested...');
      const tokensReturned = await returnTokensToUser('942851377', 2);
      
      if (tokensReturned) {
        console.log('✅ Successfully returned 2 CES to user');
      } else {
        console.log('❌ Failed to return 2 CES to user');
      }
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

module.exports = { refundStuckEscrow, returnTokensToUser };