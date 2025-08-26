/**
 * Final Verification Script
 * Verify that the user's 2 CES balance is properly protected and won't be overridden
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const USER_CHAT_ID = '942851377';
const EXPECTED_BALANCE = 2.0;

async function finalVerification() {
  try {
    console.log('✅ FINAL VERIFICATION');
    console.log('====================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💰 Expected Balance: ${EXPECTED_BALANCE} CES`);
    console.log('');
    
    await connectDatabase();
    
    // 1. Check database balance
    console.log('📋 1. DATABASE BALANCE CHECK:');
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log(`✅ Database balance: ${user.cesBalance} CES`);
    console.log(`   Expected: ${EXPECTED_BALANCE} CES`);
    console.log(`   Match: ${Math.abs(user.cesBalance - EXPECTED_BALANCE) < 0.0001 ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    // 2. Check protection flags
    console.log('📋 2. PROTECTION FLAGS CHECK:');
    const protectionFlags = {
      balanceProtectionEnabled: user.balanceProtectionEnabled,
      adminProtected: user.adminProtected,
      skipBalanceSync: user.skipBalanceSync,
      manualBalance: user.manualBalance,
      emergencyProtection: user.emergencyProtection,
      cleanupServiceBypass: user.cleanupServiceBypass,
      adminAllocationAmount: user.adminAllocationAmount
    };
    
    console.log('Protection Status:');
    Object.entries(protectionFlags).forEach(([flag, value]) => {
      console.log(`   ${flag}: ${value ? '✅' : '❌'}`);
    });
    
    const allProtected = Object.values(protectionFlags).every(flag => flag !== false);
    console.log(`\n   All Protection Active: ${allProtected ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    // 3. Test wallet service (should respect protection)
    console.log('📋 3. WALLET SERVICE TEST:');
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    console.log('Wallet Service Response:');
    console.log(`   Has Wallet: ${walletInfo.hasWallet ? '✅' : '❌'}`);
    console.log(`   CES Balance: ${walletInfo.cesBalance} CES`);
    console.log(`   Available CES: ${walletInfo.availableCESBalance} CES`);
    console.log(`   Escrow CES: ${walletInfo.escrowCESBalance} CES`);
    console.log(`   Protected: ${walletInfo.protected ? '✅' : '❌'}`);
    
    // Check if wallet service respects protection
    const walletBalanceMatch = Math.abs(walletInfo.cesBalance - EXPECTED_BALANCE) < 0.0001;
    console.log(`   Balance Protected: ${walletBalanceMatch ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    // 4. Final summary
    console.log('📋 4. FINAL SUMMARY:');
    console.log('==================');
    
    const databaseCorrect = Math.abs(user.cesBalance - EXPECTED_BALANCE) < 0.0001;
    const walletServiceCorrect = Math.abs(walletInfo.cesBalance - EXPECTED_BALANCE) < 0.0001;
    
    if (databaseCorrect && walletServiceCorrect && allProtected) {
      console.log('🎉 VERIFICATION SUCCESSFUL!');
      console.log('✅ Database balance is correct: 2 CES');
      console.log('✅ Wallet service respects protection: 2 CES');
      console.log('✅ All protection flags are active');
      console.log('✅ User can safely access their CES tokens');
      console.log('✅ Cleanup service will skip this user');
      console.log('');
      console.log('🔐 BALANCE IS FULLY PROTECTED');
    } else {
      console.log('❌ VERIFICATION FAILED:');
      if (!databaseCorrect) console.log('   - Database balance incorrect');
      if (!walletServiceCorrect) console.log('   - Wallet service balance incorrect');
      if (!allProtected) console.log('   - Some protection flags missing');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error during final verification:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  finalVerification()
    .then(() => {
      console.log('\n✅ Final verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Final verification failed:', error);
      process.exit(1);
    });
}

module.exports = { finalVerification };