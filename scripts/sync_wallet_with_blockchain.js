/**
 * Sync Wallet with Blockchain
 * Disable balance protection and sync user's wallet with real blockchain balances
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';

async function syncWalletWithBlockchain() {
  try {
    console.log('🔄 SYNC WALLET WITH BLOCKCHAIN');
    console.log('============================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
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
    console.log(`   Wallet: ${user.walletAddress}`);
    console.log(`   Current CES Balance: ${user.cesBalance || 0}`);
    console.log(`   Balance Protection Enabled: ${user.balanceProtectionEnabled}`);
    console.log(`   Admin Allocation Amount: ${user.adminAllocationAmount}`);
    console.log(`   Admin Protected: ${user.adminProtected}`);
    console.log(`   Skip Balance Sync: ${user.skipBalanceSync}`);
    console.log(`   Manual Balance: ${user.manualBalance}`);
    console.log('');
    
    // 2. Get real blockchain balances
    console.log('🔍 2. GETTING REAL BLOCKCHAIN BALANCES:');
    const realCESBalance = await walletService.getCESBalance(TARGET_WALLET);
    const realPOLBalance = await walletService.getPOLBalance(TARGET_WALLET);
    
    console.log(`   Real CES Balance: ${realCESBalance} CES`);
    console.log(`   Real POL Balance: ${realPOLBalance} POL`);
    console.log('');
    
    // 3. Disable balance protection
    console.log('🔧 3. DISABLING BALANCE PROTECTION:');
    user.balanceProtectionEnabled = false;
    user.adminAllocationAmount = 0;
    user.adminProtected = false;
    user.skipBalanceSync = false;
    user.manualBalance = false;
    user.adminAllocationReason = null;
    user.balanceOverride = null;
    
    // 4. Update balances to real blockchain values
    console.log('💰 4. UPDATING BALANCES TO REAL VALUES:');
    user.cesBalance = realCESBalance;
    user.polBalance = realPOLBalance;
    user.lastBalanceUpdate = new Date();
    
    await user.save();
    
    console.log(`   Updated CES Balance: ${user.cesBalance}`);
    console.log(`   Updated POL Balance: ${user.polBalance}`);
    console.log('');
    
    // 5. Verify the changes
    console.log('✅ 5. VERIFYING CHANGES:');
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    console.log(`   Wallet Service CES Balance: ${walletInfo.cesBalance}`);
    console.log(`   Wallet Service POL Balance: ${walletInfo.polBalance}`);
    console.log(`   Balance Protection Active: ${walletInfo.protected}`);
    console.log('');
    
    console.log('🎉 SYNC COMPLETE!');
    console.log('=================');
    console.log('The user will now see real blockchain balances instead of protected ones.');
    console.log('User trust should be restored as balances are now accurate.');
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error syncing wallet with blockchain:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

if (require.main === module) {
  syncWalletWithBlockchain()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { syncWalletWithBlockchain };