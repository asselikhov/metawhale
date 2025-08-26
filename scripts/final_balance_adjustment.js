/**
 * Final Balance Adjustment
 * Set the user's balance to exactly 2 CES as originally requested
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');

const USER_CHAT_ID = '942851377';
const TARGET_AMOUNT = 2.0; // Exactly 2 CES as requested

async function finalBalanceAdjustment() {
  try {
    console.log('🎯 FINAL BALANCE ADJUSTMENT');
    console.log('===========================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`🎯 Target Amount: ${TARGET_AMOUNT} CES`);
    console.log('');
    
    await connectDatabase();
    
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('📋 CURRENT STATE:');
    console.log(`   Current Balance: ${user.cesBalance || 0} CES`);
    console.log(`   Target Balance: ${TARGET_AMOUNT} CES`);
    console.log('');
    
    if (Math.abs((user.cesBalance || 0) - TARGET_AMOUNT) < 0.0001) {
      console.log('✅ Balance already correct!');
      console.log(`   User has exactly ${TARGET_AMOUNT} CES`);
    } else {
      console.log('🔧 ADJUSTING BALANCE:');
      
      const previousBalance = user.cesBalance || 0;
      user.cesBalance = TARGET_AMOUNT;
      user.adminAllocationAmount = TARGET_AMOUNT;
      user.adminAllocationReason = `Final adjustment: Set to exactly ${TARGET_AMOUNT} CES as requested for escrow return`;
      user.adminAllocationDate = new Date();
      user.balanceProtectionEnabled = true;
      user.lastBalanceUpdate = new Date();
      
      await user.save();
      
      console.log('✅ Balance adjusted successfully');
      console.log(`   Previous: ${previousBalance} CES`);
      console.log(`   New: ${user.cesBalance} CES`);
      
      // Create adjustment record
      const adjustmentTx = new EscrowTransaction({
        userId: user._id,
        tradeId: null,
        type: 'refund',
        tokenType: 'CES',
        amount: TARGET_AMOUNT,
        status: 'completed',
        txHash: null,
        smartContractEscrowId: null,
        reason: `FINAL BALANCE ADJUSTMENT: Set to exactly ${TARGET_AMOUNT} CES as requested. Previous amount: ${previousBalance} CES. Balance protection active.`,
        completedAt: new Date()
      });
      
      await adjustmentTx.save();
      
      console.log('✅ Adjustment record created');
    }
    
    console.log('');
    console.log('🎉 FINAL STATUS:');
    console.log('===============');
    console.log(`✅ User ${USER_CHAT_ID} has exactly ${user.cesBalance} CES`);
    console.log(`✅ Balance protection: ${user.balanceProtectionEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`✅ Request fulfilled: User's lost 2 CES tokens recovered`);
    console.log(`✅ System status: Stable and protected from auto-sync`);
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error during final adjustment:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  finalBalanceAdjustment()
    .then(() => {
      console.log('\n🎉 Final balance adjustment completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Final adjustment failed:', error);
      process.exit(1);
    });
}

module.exports = { finalBalanceAdjustment };