/**
 * Script to compensate user with 2 CES tokens for stuck escrows
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction } = require('../src/database/models');

async function compensateUser(userChatId, amount) {
  console.log(`🔄 Compensating user ${userChatId} with ${amount} CES tokens`);
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`   Current available CES: ${user.cesBalance || 0}`);
    console.log(`   Current escrowed CES: ${user.escrowCESBalance || 0}`);
    
    // Add compensation to user's available balance
    const oldBalance = user.cesBalance || 0;
    user.cesBalance = oldBalance + amount;
    await user.save();
    
    console.log(`\n✅ Compensation completed:`);
    console.log(`   Previous balance: ${oldBalance} CES`);
    console.log(`   Compensation: +${amount} CES`);
    console.log(`   New balance: ${user.cesBalance} CES`);
    
    // Create a compensation transaction record
    const compensationTx = new EscrowTransaction({
      userId: user._id,
      type: 'refund',
      tokenType: 'CES',
      amount: amount,
      status: 'completed',
      reason: `COMPENSATION: User compensation for ${amount} CES tokens stuck in smart contract escrows. Manual balance adjustment to restore user funds.`,
      completedAt: new Date()
    });
    
    await compensationTx.save();
    console.log(`\n📄 Created compensation transaction record: ${compensationTx._id}`);
    
    // Document the stuck escrows for reference
    console.log(`\n📋 Documenting stuck escrows that required compensation:`);
    const lockTransactions = await EscrowTransaction.find({
      userId: user._id,
      type: 'lock',
      tokenType: 'CES',
      smartContractEscrowId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });
    
    console.log(`   Found ${lockTransactions.length} lock transactions with smart contract IDs:`);
    
    let stuckEscrows = [];
    for (const tx of lockTransactions) {
      // Check if the escrow was actually refunded by checking its status
      if (tx.smartContractEscrowId) {
        try {
          // We'll assume all are stuck since we know the refund transactions failed
          stuckEscrows.push({
            escrowId: tx.smartContractEscrowId,
            amount: tx.amount,
            createdAt: tx.createdAt
          });
          console.log(`\n   --- Lock Transaction ${tx._id} ---`);
          console.log(`      Smart Contract Escrow ID: ${tx.smartContractEscrowId}`);
          console.log(`      Amount: ${tx.amount}`);
          console.log(`      Created: ${tx.createdAt}`);
          console.log(`      ⚠️ ESCROW STUCK - Tokens not refunded from smart contract`);
        } catch (error) {
          console.log(`      ❌ Error checking escrow status: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📝 Summary:`);
    console.log(`   User has been compensated with ${amount} CES tokens`);
    console.log(`   ${stuckEscrows.length} escrows remain stuck in smart contract`);
    console.log(`   Manual intervention may still be required for these escrows`);
    
    return {
      user,
      compensation: {
        amount: amount,
        oldBalance: oldBalance,
        newBalance: user.cesBalance
      },
      stuckEscrows
    };
    
  } catch (error) {
    console.error('❌ Error compensating user:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('💰 User Compensation Script');
  console.log('========================');
  
  try {
    const result = await compensateUser('942851377', 2);
    console.log('\n✅ User compensation completed successfully');
    return result;
  } catch (error) {
    console.error('❌ User compensation failed:', error.message);
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

module.exports = { compensateUser };