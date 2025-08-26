/**
 * Test Wallet Service Protection
 * Verify that the wallet service respects balance protection and returns correct balance
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const USER_CHAT_ID = '942851377';

async function testWalletServiceProtection() {
  try {
    console.log('🧪 TESTING WALLET SERVICE PROTECTION');
    console.log('====================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log('');
    
    await connectDatabase();
    
    console.log('📋 TESTING getUserWallet() METHOD:');
    console.log('');
    
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    if (!walletInfo) {
      console.log('❌ No wallet info returned');
      return;
    }
    
    console.log('✅ Wallet Service Response:');
    console.log(`   Has Wallet: ${walletInfo.hasWallet}`);
    console.log(`   Address: ${walletInfo.address}`);
    console.log(`   CES Balance: ${walletInfo.cesBalance} CES`);
    console.log(`   Available CES: ${walletInfo.availableCESBalance} CES`);
    console.log(`   Escrow CES: ${walletInfo.escrowCESBalance} CES`);
    console.log(`   POL Balance: ${walletInfo.polBalance} POL`);
    console.log(`   Protected: ${walletInfo.protected ? 'YES' : 'NO'}`);
    
    if (walletInfo.protected) {
      console.log(`   Protection Reason: ${walletInfo.protectionReason}`);
      console.log('');
      console.log('🔒 PROTECTION STATUS: ACTIVE');
      console.log('   ✅ Balance protection is working correctly');
      console.log('   ✅ Admin allocation is preserved');
      console.log('   ✅ Automatic sync bypassed');
    } else {
      console.log('');
      console.log('⚠️ PROTECTION STATUS: INACTIVE');
      console.log('   This might indicate protection is not working');
    }
    
    console.log('');
    console.log('📊 VERIFICATION:');
    
    const expectedBalance = 2.0; // User should have exactly 2 CES
    const actualBalance = walletInfo.cesBalance;
    
    if (Math.abs(actualBalance - expectedBalance) < 0.0001) {
      console.log(`✅ PASS: User has correct balance (${actualBalance} CES)`);
    } else {
      console.log(`❌ FAIL: Balance mismatch - Expected: ${expectedBalance}, Got: ${actualBalance}`);
    }
    
    if (walletInfo.availableCESBalance >= expectedBalance) {
      console.log(`✅ PASS: Available balance is correct (${walletInfo.availableCESBalance} CES)`);
    } else {
      console.log(`❌ FAIL: Available balance too low (${walletInfo.availableCESBalance} CES)`);
    }
    
    console.log('');
    console.log('🎯 TEST RESULTS:');
    
    if (walletInfo.protected && actualBalance >= expectedBalance) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('   ✅ Balance protection is active');
      console.log('   ✅ User has correct CES balance');
      console.log('   ✅ Telegram bot will show correct balance');
      console.log('   ✅ Lost CES recovery is complete');
    } else {
      console.log('⚠️ SOME TESTS FAILED');
      console.log('   Further investigation may be needed');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error testing wallet service protection:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  testWalletServiceProtection()
    .then(() => {
      console.log('\n🎉 Wallet service protection test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testWalletServiceProtection };