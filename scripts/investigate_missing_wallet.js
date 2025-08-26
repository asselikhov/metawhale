/**
 * Investigate Missing Wallet
 * Investigate why wallet 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d 
 * disappeared from user 942851377's account
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, Wallet } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const MISSING_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';

async function investigateMissingWallet() {
  try {
    console.log('🔍 INVESTIGATION: MISSING WALLET');
    console.log('=================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Missing Wallet: ${MISSING_WALLET}`);
    console.log('');
    
    await connectDatabase();
    
    // 1. Check if user exists
    console.log('📋 1. CHECKING USER ACCOUNT:');
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ USER NOT FOUND in database!');
      console.log('   This could mean:');
      console.log('   - User account was deleted');
      console.log('   - Database corruption');
      console.log('   - Chat ID changed');
      return;
    }
    
    console.log('✅ User found in database');
    console.log(`   User ID: ${user._id}`);
    console.log(`   Username: ${user.username || 'N/A'}`);
    console.log(`   First Name: ${user.firstName || 'N/A'}`);
    console.log(`   Current walletAddress: ${user.walletAddress || 'NULL'}`);
    console.log(`   Wallet Created At: ${user.walletCreatedAt || 'N/A'}`);
    console.log(`   CES Balance: ${user.cesBalance || 0}`);
    console.log(`   POL Balance: ${user.polBalance || 0}`);
    console.log(`   Last Balance Update: ${user.lastBalanceUpdate || 'N/A'}`);
    console.log('');
    
    // 2. Check if the specific wallet exists in Wallet collection
    console.log('📋 2. CHECKING WALLET COLLECTION:');
    const walletRecord = await Wallet.findOne({ address: MISSING_WALLET });
    
    if (!walletRecord) {
      console.log('❌ WALLET RECORD NOT FOUND in Wallet collection!');
      console.log('   This means the wallet was completely deleted from database');
    } else {
      console.log('✅ Wallet record found in Wallet collection');
      console.log(`   Wallet ID: ${walletRecord._id}`);
      console.log(`   User ID: ${walletRecord.userId}`);
      console.log(`   Address: ${walletRecord.address}`);
      console.log(`   Has Encrypted Private Key: ${walletRecord.encryptedPrivateKey ? 'YES' : 'NO'}`);
      console.log(`   Created At: ${walletRecord.createdAt || 'N/A'}`);
      
      // Check if wallet belongs to this user
      if (walletRecord.userId.toString() === user._id.toString()) {
        console.log('✅ Wallet belongs to this user');
      } else {
        console.log('❌ WALLET BELONGS TO DIFFERENT USER!');
        console.log(`   Expected User ID: ${user._id}`);
        console.log(`   Actual User ID: ${walletRecord.userId}`);
      }
    }
    console.log('');
    
    // 3. Check all wallets for this user
    console.log('📋 3. CHECKING ALL USER WALLETS:');
    const userWallets = await Wallet.find({ userId: user._id });
    
    if (userWallets.length === 0) {
      console.log('❌ NO WALLETS found for this user');
    } else {
      console.log(`✅ Found ${userWallets.length} wallet(s) for this user:`);
      userWallets.forEach((wallet, index) => {
        console.log(`   Wallet ${index + 1}:`);
        console.log(`     Address: ${wallet.address}`);
        console.log(`     Created: ${wallet.createdAt}`);
        console.log(`     Is Missing Wallet: ${wallet.address === MISSING_WALLET ? 'YES' : 'NO'}`);
      });
    }
    console.log('');
    
    // 4. Check if anyone else has this wallet
    console.log('📋 4. CHECKING WALLET OWNERSHIP:');
    const allUsersWithThisWallet = await User.find({ walletAddress: MISSING_WALLET });
    
    if (allUsersWithThisWallet.length === 0) {
      console.log('❌ NO USERS have this wallet address assigned');
    } else {
      console.log(`⚠️ Found ${allUsersWithThisWallet.length} user(s) with this wallet:`);
      allUsersWithThisWallet.forEach((u, index) => {
        console.log(`   User ${index + 1}:`);
        console.log(`     Chat ID: ${u.chatId}`);
        console.log(`     Username: ${u.username || 'N/A'}`);
        console.log(`     Is Target User: ${u.chatId === USER_CHAT_ID ? 'YES' : 'NO'}`);
      });
    }
    console.log('');
    
    // 5. Test walletService.getUserWallet()
    console.log('📋 5. TESTING WALLET SERVICE:');
    try {
      const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
      
      if (!walletInfo) {
        console.log('❌ walletService.getUserWallet() returned NULL');
      } else if (!walletInfo.hasWallet) {
        console.log('❌ walletService reports: NO WALLET');
        console.log(`   User object exists: ${walletInfo.user ? 'YES' : 'NO'}`);
      } else {
        console.log('✅ walletService reports: HAS WALLET');
        console.log(`   Address: ${walletInfo.address}`);
        console.log(`   CES Balance: ${walletInfo.cesBalance}`);
        console.log(`   POL Balance: ${walletInfo.polBalance}`);
        console.log(`   Is Correct Wallet: ${walletInfo.address === MISSING_WALLET ? 'YES' : 'NO'}`);
      }
    } catch (error) {
      console.log('❌ walletService.getUserWallet() FAILED:');
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
    
    // 6. Diagnostic summary
    console.log('📋 6. DIAGNOSTIC SUMMARY:');
    console.log('=========================');
    
    if (!user.walletAddress) {
      console.log('🔍 ROOT CAUSE: User.walletAddress is NULL/undefined');
      console.log('');
      console.log('💡 POSSIBLE CAUSES:');
      console.log('   1. Database update that cleared walletAddress field');
      console.log('   2. Manual database modification');
      console.log('   3. Bug in wallet deletion/reset code');
      console.log('   4. Data migration issue');
      console.log('');
      
      if (walletRecord) {
        console.log('✅ GOOD NEWS: Wallet record still exists in Wallet collection');
        console.log('');
        console.log('🔧 RECOMMENDED FIX:');
        console.log('   1. Restore user.walletAddress to the correct value');
        console.log('   2. Verify wallet ownership is correct');
        console.log('   3. Test wallet functionality');
        console.log('');
        console.log('🚨 IMMEDIATE ACTION REQUIRED:');
        console.log(`   Execute: await User.findOneAndUpdate({chatId: '${USER_CHAT_ID}'}, {walletAddress: '${MISSING_WALLET}'})`);
      } else {
        console.log('❌ BAD NEWS: Wallet record completely deleted');
        console.log('');
        console.log('🔧 RECOVERY OPTIONS:');
        console.log('   1. If user has private key backup - import wallet');
        console.log('   2. If no backup - wallet is permanently lost');
        console.log('   3. Create new wallet and inform user about loss');
      }
    } else if (user.walletAddress !== MISSING_WALLET) {
      console.log('🔍 ROOT CAUSE: User.walletAddress points to different wallet');
      console.log(`   Expected: ${MISSING_WALLET}`);
      console.log(`   Current: ${user.walletAddress}`);
      console.log('');
      console.log('💡 POSSIBLE CAUSES:');
      console.log('   1. Wallet was replaced/reassigned');
      console.log('   2. Data corruption');
      console.log('   3. User created new wallet');
    } else {
      console.log('🔍 ROOT CAUSE: Unknown - wallet address matches but still not showing');
      console.log('');
      console.log('💡 POSSIBLE CAUSES:');
      console.log('   1. walletService.getUserWallet() logic issue');
      console.log('   2. Frontend display bug');
      console.log('   3. Session/cache issue');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  investigateMissingWallet()
    .then(() => {
      console.log('\n🎉 Investigation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateMissingWallet };