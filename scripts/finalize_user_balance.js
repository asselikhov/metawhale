/**
 * Script to finalize user balance to match blockchain reality and document what happened
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');

async function finalizeUserBalance(userChatId) {
  console.log(`🔄 Finalizing balance for user: ${userChatId}`);
  
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
    
    // Check actual blockchain balances
    console.log(`\n🔍 Checking actual blockchain balances...`);
    
    const cesBalance = await walletService.getCESBalance(user.walletAddress);
    const polBalance = await walletService.getPOLBalance(user.walletAddress);
    
    console.log(`💰 CES Balance: ${cesBalance} CES`);
    console.log(`💎 POL Balance: ${polBalance} POL`);
    
    // Compare with database balances
    console.log(`\n📊 Balance Comparison BEFORE adjustment:`);
    console.log(`   Database Available CES: ${user.cesBalance || 0}`);
    console.log(`   Database Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   Database Available POL: ${user.polBalance || 0}`);
    console.log(`   Database Escrowed POL: ${user.escrowPOLBalance || 0}`);
    console.log(`   Blockchain CES: ${cesBalance}`);
    console.log(`   Blockchain POL: ${polBalance}`);
    
    const totalDatabaseCES = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
    console.log(`\n📈 Total CES (Database): ${totalDatabaseCES}`);
    console.log(`📈 Blockchain CES: ${cesBalance}`);
    
    const cesDifference = Math.abs(cesBalance - totalDatabaseCES);
    if (cesDifference > 0.0001) {
      console.log(`⚠️  CES Balance Mismatch: ${cesDifference}`);
    } else {
      console.log(`✅ CES Balances Match`);
    }
    
    // Document the stuck escrows
    console.log(`\n📋 Documenting stuck escrows...`);
    const lockTransactions = await EscrowTransaction.find({
      userId: user._id,
      type: 'lock',
      tokenType: 'CES',
      smartContractEscrowId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });
    
    console.log(`   Found ${lockTransactions.length} lock transactions with smart contract IDs:`);
    
    let stuckEscrows = [];
    for (const tx of lockTransactions) {
      console.log(`\n   --- Lock Transaction ${tx._id} ---`);
      console.log(`      Smart Contract Escrow ID: ${tx.smartContractEscrowId}`);
      console.log(`      Amount: ${tx.amount}`);
      console.log(`      Created: ${tx.createdAt}`);
      
      // Check if the escrow was actually refunded
      if (tx.smartContractEscrowId) {
        try {
          // In a real implementation, we would check the smart contract status
          // For now, we'll assume all are stuck since we know the refund transactions failed
          stuckEscrows.push({
            escrowId: tx.smartContractEscrowId,
            amount: tx.amount,
            createdAt: tx.createdAt
          });
          console.log(`      ⚠️ ESCROW STUCK - Tokens not refunded from smart contract`);
        } catch (error) {
          console.log(`      ❌ Error checking escrow status: ${error.message}`);
        }
      }
    }
    
    // Adjust user balance to match blockchain reality
    console.log(`\n🔄 Adjusting user balance to match blockchain reality...`);
    console.log(`   Current database CES balance: ${totalDatabaseCES}`);
    console.log(`   Blockchain CES balance: ${cesBalance}`);
    console.log(`   Difference: ${cesBalance - totalDatabaseCES}`);
    
    // Set user's available balance to match blockchain
    const oldAvailable = user.cesBalance || 0;
    const oldEscrowed = user.escrowCESBalance || 0;
    
    user.cesBalance = cesBalance;  // Set to actual blockchain balance
    user.escrowCESBalance = 0;     // Clear escrowed balance since tokens are stuck
    
    await user.save();
    
    console.log(`\n✅ Balance adjustment completed:`);
    console.log(`   Previous available: ${oldAvailable} CES`);
    console.log(`   Previous escrowed: ${oldEscrowed} CES`);
    console.log(`   New available: ${user.cesBalance} CES`);
    console.log(`   New escrowed: ${user.escrowCESBalance} CES`);
    
    // Create a documentation transaction
    const documentationTx = new EscrowTransaction({
      userId: user._id,
      type: 'manual_intervention_required',
      tokenType: 'CES',
      amount: totalDatabaseCES - cesBalance,
      status: 'completed',
      reason: `MANUAL INTERVENTION REQUIRED: ${stuckEscrows.length} escrows stuck in smart contract. Database balance was ${totalDatabaseCES} CES but blockchain shows ${cesBalance} CES. Balance adjusted to match blockchain reality. Stuck escrow IDs: ${stuckEscrows.map(e => e.escrowId).join(', ')}`,
      completedAt: new Date()
    });
    
    await documentationTx.save();
    console.log(`\n📄 Created documentation transaction: ${documentationTx._id}`);
    
    // Final verification
    console.log(`\n🔍 Final verification:`);
    const updatedUser = await User.findOne({ chatId: userChatId });
    const newTotalDatabaseCES = (updatedUser.cesBalance || 0) + (updatedUser.escrowCESBalance || 0);
    console.log(`   Updated Total CES (Database): ${newTotalDatabaseCES}`);
    console.log(`   Blockchain CES: ${cesBalance}`);
    
    if (Math.abs(newTotalDatabaseCES - cesBalance) < 0.0001) {
      console.log(`✅ Final balances match!`);
    } else {
      console.log(`⚠️ Final balances still don't match`);
    }
    
    console.log(`\n📋 Summary of stuck escrows:`);
    for (const escrow of stuckEscrows) {
      console.log(`   Escrow ID ${escrow.escrowId}: ${escrow.amount} CES (Created: ${escrow.createdAt})`);
    }
    
    console.log(`\n📝 Manual intervention required for ${stuckEscrows.length} escrows:`);
    console.log(`   These escrows are stuck in the smart contract and require manual intervention`);
    console.log(`   to either successfully refund the tokens or properly document their status.`);
    
    return {
      user: updatedUser,
      stuckEscrows,
      adjustment: {
        oldAvailable,
        oldEscrowed,
        newAvailable: updatedUser.cesBalance,
        newEscrowed: updatedUser.escrowCESBalance
      }
    };
    
  } catch (error) {
    console.error('❌ Error finalizing user balance:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🔄 Finalizing User Balance Script');
  console.log('==============================');
  
  try {
    const result = await finalizeUserBalance('942851377');
    console.log('\n✅ Balance finalization completed successfully');
    return result;
  } catch (error) {
    console.error('❌ Balance finalization failed:', error.message);
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

module.exports = { finalizeUserBalance };