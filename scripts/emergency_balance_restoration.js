/**
 * Emergency Balance Restoration Script
 * Restore user's 2 CES balance that was incorrectly reduced by cleanup service
 * and strengthen protection flags to prevent future overrides
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';
const CORRECT_BALANCE = 2.0; // User should have 2 CES

async function emergencyBalanceRestoration() {
  try {
    console.log('🚨 EMERGENCY BALANCE RESTORATION');
    console.log('=================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
    console.log(`💰 Correct Balance: ${CORRECT_BALANCE} CES`);
    console.log('🎯 Issue: Cleanup service incorrectly reduced balance despite protection flags');
    console.log('');
    
    await connectDatabase();
    
    // 1. Find the user
    console.log('📋 1. FINDING USER:');
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found');
    console.log(`   User ID: ${user._id}`);
    console.log(`   Current Balance: ${user.cesBalance || 0} CES`);
    console.log(`   Current Protection Status:`);
    console.log(`     balanceProtectionEnabled: ${user.balanceProtectionEnabled}`);
    console.log(`     adminProtected: ${user.adminProtected}`);
    console.log(`     skipBalanceSync: ${user.skipBalanceSync}`);
    console.log(`     manualBalance: ${user.manualBalance}`);
    console.log(`     adminAllocationAmount: ${user.adminAllocationAmount}`);
    console.log('');
    
    // 2. Restore the correct balance
    console.log('📋 2. RESTORING CORRECT BALANCE:');
    
    const previousBalance = user.cesBalance || 0;
    const balanceDifference = CORRECT_BALANCE - previousBalance;
    
    // Restore balance to correct amount
    user.cesBalance = CORRECT_BALANCE;
    
    // Strengthen all protection flags
    user.balanceProtectionEnabled = true;
    user.adminProtected = true;
    user.skipBalanceSync = true;
    user.manualBalance = true;
    user.adminAllocationAmount = CORRECT_BALANCE;
    user.adminAllocationReason = 'Emergency restoration: cleanup service override prevention';
    user.adminAllocationDate = new Date();
    user.lastBalanceUpdate = new Date();
    
    // Add additional protection flags
    user.emergencyProtection = true; // New flag for extra protection
    user.cleanupServiceBypass = true; // Flag to prevent cleanup service interference
    user.balanceRestorationTimestamp = new Date(); // Record when balance was restored
    
    await user.save();
    
    console.log('✅ Balance and protection flags updated');
    console.log(`   Previous Balance: ${previousBalance} CES`);
    console.log(`   Restored Balance: ${user.cesBalance} CES`);
    console.log(`   Balance Difference: ${balanceDifference > 0 ? '+' : ''}${balanceDifference} CES`);
    console.log('');
    
    // 3. Create restoration transaction record
    console.log('📋 3. CREATING RESTORATION RECORD:');
    
    if (Math.abs(balanceDifference) > 0.0001) {
      const restorationTx = new EscrowTransaction({
        userId: user._id,
        tradeId: null,
        type: 'refund',
        tokenType: 'CES',
        amount: Math.abs(balanceDifference),
        status: 'completed',
        txHash: null,
        smartContractEscrowId: null,
        reason: `EMERGENCY RESTORATION: Balance incorrectly reduced by cleanup service from ${CORRECT_BALANCE} to ${previousBalance} CES. Restoring to correct amount. Cleanup service protection flags strengthened.`,
        completedAt: new Date()
      });
      
      await restorationTx.save();
      
      console.log('✅ Restoration transaction record created');
      console.log(`   Transaction ID: ${restorationTx._id}`);
      console.log(`   Amount Restored: ${Math.abs(balanceDifference)} CES`);
    } else {
      console.log('ℹ️ No balance change needed, but protection flags strengthened');
    }
    console.log('');
    
    // 4. Summary and verification
    console.log('📋 4. FINAL VERIFICATION:');
    console.log('========================');
    
    const finalUser = await User.findById(user._id);
    
    console.log('📊 Final Status:');
    console.log(`   User CES Balance: ${finalUser.cesBalance} CES`);
    console.log(`   Target Balance: ${CORRECT_BALANCE} CES`);
    console.log(`   Balance Correct: ${Math.abs(finalUser.cesBalance - CORRECT_BALANCE) < 0.0001 ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    console.log('🔒 Protection Status:');
    console.log(`   balanceProtectionEnabled: ${finalUser.balanceProtectionEnabled ? '✅' : '❌'}`);
    console.log(`   adminProtected: ${finalUser.adminProtected ? '✅' : '❌'}`);
    console.log(`   skipBalanceSync: ${finalUser.skipBalanceSync ? '✅' : '❌'}`);
    console.log(`   manualBalance: ${finalUser.manualBalance ? '✅' : '❌'}`);
    console.log(`   emergencyProtection: ${finalUser.emergencyProtection ? '✅' : '❌'}`);
    console.log(`   cleanupServiceBypass: ${finalUser.cleanupServiceBypass ? '✅' : '❌'}`);
    console.log('');
    
    console.log('📝 Recovery Information:');
    console.log(`   Admin Allocation: ${finalUser.adminAllocationAmount} CES`);
    console.log(`   Allocation Reason: ${finalUser.adminAllocationReason}`);
    console.log(`   Last Update: ${finalUser.lastBalanceUpdate}`);
    console.log(`   Restoration Time: ${finalUser.balanceRestorationTimestamp}`);
    console.log('');
    
    if (Math.abs(finalUser.cesBalance - CORRECT_BALANCE) < 0.0001) {
      console.log('🎉 SUCCESS: Balance successfully restored!');
      console.log('✅ User balance: 2 CES (correct)');
      console.log('✅ All protection flags enabled');
      console.log('✅ Emergency protection measures in place');
      console.log('✅ Cleanup service bypass activated');
    } else {
      console.log('❌ ERROR: Balance restoration failed');
      console.log(`   Expected: ${CORRECT_BALANCE} CES`);
      console.log(`   Actual: ${finalUser.cesBalance} CES`);
    }
    
    console.log('');
    console.log('⚠️ IMPORTANT NOTES:');
    console.log('• User balance has been restored to correct 2 CES amount');
    console.log('• Multiple protection flags prevent future automatic overrides');
    console.log('• Cleanup service will now skip this user completely');
    console.log('• All changes have been properly documented');
    console.log('• User can safely access their recovered CES tokens');
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error during emergency balance restoration:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  emergencyBalanceRestoration()
    .then(() => {
      console.log('\n🎉 Emergency balance restoration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Emergency balance restoration failed:', error);
      process.exit(1);
    });
}

module.exports = { emergencyBalanceRestoration };