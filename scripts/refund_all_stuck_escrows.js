/**
 * Script to refund all stuck escrow tokens for a user
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
      
      return { success: true, amount: amount };
    } else {
      console.log(`❌ Failed to refund escrow`);
      return { success: false, reason: 'Refund transaction failed' };
    }
    
  } catch (error) {
    console.error(`❌ Error refunding stuck escrow: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function refundAllStuckEscrows(userChatId) {
  console.log(`🔄 Refunding all stuck escrows for user: ${userChatId}`);
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`   Wallet address: ${user.walletAddress}`);
    console.log(`   Available CES: ${user.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${user.escrowCESBalance || 0}`);
    
    // Find all active escrow transactions for this user
    const lockTransactions = await EscrowTransaction.find({
      userId: user._id,
      type: 'lock',
      tokenType: 'CES',
      smartContractEscrowId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });
    
    console.log(`\n📋 Found ${lockTransactions.length} lock transactions with smart contract IDs:`);
    
    let totalRefunded = 0;
    let refundResults = [];
    
    for (const tx of lockTransactions) {
      console.log(`\n--- Checking Lock Transaction ${tx._id} ---`);
      console.log(`   Smart Contract Escrow ID: ${tx.smartContractEscrowId}`);
      console.log(`   Amount: ${tx.amount}`);
      console.log(`   Created: ${tx.createdAt}`);
      
      // Check if the escrow was actually refunded
      if (tx.smartContractEscrowId) {
        try {
          const details = await smartContractService.getEscrowDetails(tx.smartContractEscrowId);
          console.log(`   Actual Status: ${smartContractService.getEscrowStatusText(details.status)} (${details.status})`);
          
          if (details.status !== 2) { // 2 = Refunded
            console.log(`   ⚠️ ESCROW NOT ACTUALLY REFUNDED - Attempting refund...`);
            
            const refundResult = await refundStuckEscrow(tx.smartContractEscrowId, userChatId);
            refundResults.push({
              escrowId: tx.smartContractEscrowId,
              ...refundResult
            });
            
            if (refundResult.success) {
              totalRefunded += refundResult.amount;
            }
          } else {
            console.log(`   ✅ Escrow was already properly refunded`);
            refundResults.push({
              escrowId: tx.smartContractEscrowId,
              success: true,
              alreadyRefunded: true
            });
          }
        } catch (error) {
          console.log(`   ❌ Error checking escrow status: ${error.message}`);
          refundResults.push({
            escrowId: tx.smartContractEscrowId,
            success: false,
            reason: `Error checking status: ${error.message}`
          });
        }
      }
    }
    
    console.log(`\n📊 Refund Summary:`);
    console.log(`   Total escrows checked: ${lockTransactions.length}`);
    console.log(`   Total successfully refunded: ${totalRefunded} CES`);
    
    console.log(`\n📋 Detailed Results:`);
    for (const result of refundResults) {
      if (result.success) {
        if (result.alreadyRefunded) {
          console.log(`   ✅ Escrow ${result.escrowId}: Already refunded`);
        } else {
          console.log(`   ✅ Escrow ${result.escrowId}: Successfully refunded ${result.amount} CES`);
        }
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
    console.error('❌ Error refunding all stuck escrows:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('💰 Manual All Escrow Refund Script');
  console.log('==================================');
  
  try {
    const results = await refundAllStuckEscrows('942851377');
    console.log('\n✅ Script completed successfully');
    return results;
  } catch (error) {
    console.error('❌ Script failed:', error.message);
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

module.exports = { refundAllStuckEscrows };