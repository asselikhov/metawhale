/**
 * Simple Balance Synchronization Test
 * Test that user balances are properly synchronized with blockchain
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

async function runTest() {
  try {
    console.log('🧪 RUNNING BALANCE SYNCHRONIZATION TEST');
    console.log('=====================================');
    
    await connectDatabase();
    
    const USER_CHAT_ID = '942851377';
    const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
    
    // Get user from database
    console.log('📋 1. Getting user from database...');
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ FAIL: User not found in database');
      return;
    }
    
    if (user.walletAddress !== TARGET_WALLET) {
      console.log('❌ FAIL: User wallet address mismatch');
      console.log(`   Expected: ${TARGET_WALLET}`);
      console.log(`   Actual: ${user.walletAddress}`);
      return;
    }
    
    console.log('✅ PASS: User found and wallet address matches');
    
    // Get real blockchain balances
    console.log('🔍 2. Getting real blockchain balances...');
    const realCESBalance = await walletService.getCESBalance(TARGET_WALLET);
    const realPOLBalance = await walletService.getPOLBalance(TARGET_WALLET);
    
    console.log(`   Real CES Balance: ${realCESBalance}`);
    console.log(`   Real POL Balance: ${realPOLBalance}`);
    
    // Check that database balances match blockchain
    console.log('📊 3. Checking database balances...');
    if (user.cesBalance !== realCESBalance) {
      console.log('❌ FAIL: CES balance mismatch');
      console.log(`   Database: ${user.cesBalance}`);
      console.log(`   Blockchain: ${realCESBalance}`);
      return;
    }
    
    if (user.polBalance !== realPOLBalance) {
      console.log('❌ FAIL: POL balance mismatch');
      console.log(`   Database: ${user.polBalance}`);
      console.log(`   Blockchain: ${realPOLBalance}`);
      return;
    }
    
    console.log('✅ PASS: Database balances match blockchain');
    
    // Check that protection is disabled
    console.log('🛡️ 4. Checking balance protection status...');
    if (user.balanceProtectionEnabled !== false) {
      console.log('❌ FAIL: Balance protection still enabled');
      return;
    }
    
    if (user.adminAllocationAmount !== 0) {
      console.log('❌ FAIL: Admin allocation amount not zero');
      return;
    }
    
    if (user.adminProtected !== false) {
      console.log('❌ FAIL: Admin protection still enabled');
      return;
    }
    
    if (user.skipBalanceSync !== false) {
      console.log('❌ FAIL: Skip balance sync still enabled');
      return;
    }
    
    if (user.manualBalance !== false) {
      console.log('❌ FAIL: Manual balance still enabled');
      return;
    }
    
    console.log('✅ PASS: Balance protection disabled');
    
    // Check wallet service returns correct balances
    console.log('💼 5. Checking wallet service...');
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    if (walletInfo.cesBalance !== realCESBalance) {
      console.log('❌ FAIL: Wallet service CES balance mismatch');
      console.log(`   Wallet Service: ${walletInfo.cesBalance}`);
      console.log(`   Blockchain: ${realCESBalance}`);
      return;
    }
    
    if (walletInfo.polBalance !== realPOLBalance) {
      console.log('❌ FAIL: Wallet service POL balance mismatch');
      console.log(`   Wallet Service: ${walletInfo.polBalance}`);
      console.log(`   Blockchain: ${realPOLBalance}`);
      return;
    }
    
    if (walletInfo.protected !== undefined) {
      console.log('❌ FAIL: Wallet service still shows protection');
      return;
    }
    
    console.log('✅ PASS: Wallet service returns correct balances');
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('====================');
    console.log('User balance is properly synchronized with blockchain');
    console.log(`CES Balance: ${realCESBalance} CES`);
    console.log(`POL Balance: ${realPOLBalance} POL`);
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

if (require.main === module) {
  runTest()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}