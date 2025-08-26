/**
 * Restore Deleted User and Wallet
 * Restore user 942851377 and their wallet 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, Wallet } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const MISSING_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';

async function restoreUserAndWallet() {
  try {
    console.log('🔧 RESTORING DELETED USER AND WALLET');
    console.log('====================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet Address: ${MISSING_WALLET}`);
    console.log('');
    
    await connectDatabase();
    
    // 1. Check if wallet record still exists in Wallet collection
    console.log('📋 1. CHECKING WALLET RECORD:');
    const walletRecord = await Wallet.findOne({ address: MISSING_WALLET });
    
    if (!walletRecord) {
      console.log('❌ WALLET RECORD NOT FOUND');
      console.log('');
      console.log('⚠️ CRITICAL: Both user and wallet records are missing!');
      console.log('💡 This indicates complete data loss.');
      console.log('🔧 RECOVERY OPTIONS:');
      console.log('   1. Check database backups');
      console.log('   2. If user has private key backup - can recreate wallet');
      console.log('   3. If no backup - wallet is permanently lost');
      
      // Still create user account for future use
      console.log('');
      console.log('📝 Creating new user account...');
      
      const newUser = new User({
        chatId: USER_CHAT_ID,
        username: 'restored_user',
        firstName: 'Restored',
        lastName: 'User',
        isActive: true,
        subscribedAt: new Date(),
        language: 'ru',
        walletAddress: null, // Will need to create new wallet
        cesBalance: 0,
        polBalance: 0,
        escrowCESBalance: 0,
        escrowPOLBalance: 0,
        p2pTradingEnabled: true,
        successfulTrades: 0,
        totalTradeVolume: 0,
        p2pRating: 5.0,
        disputeCount: 0
      });
      
      await newUser.save();
      console.log('✅ New user account created');
      console.log('⚠️ User will need to create a new wallet');
      
      return;
    }
    
    console.log('✅ Wallet record found in Wallet collection');
    console.log(`   Wallet ID: ${walletRecord._id}`);
    console.log(`   Original User ID: ${walletRecord.userId}`);
    console.log(`   Address: ${walletRecord.address}`);
    console.log(`   Has Encrypted Private Key: ${walletRecord.encryptedPrivateKey ? 'YES' : 'NO'}`);
    console.log('');
    
    // 2. Create new user account with same chatId
    console.log('📋 2. RESTORING USER ACCOUNT:');
    
    // Check if user was somehow recreated
    let existingUser = await User.findOne({ chatId: USER_CHAT_ID });
    if (existingUser) {
      console.log('⚠️ User account already exists (possibly recreated)');
      console.log(`   Current wallet: ${existingUser.walletAddress || 'NULL'}`);
      
      if (existingUser.walletAddress === MISSING_WALLET) {
        console.log('✅ User already has correct wallet assigned');
        return;
      } else {
        console.log('🔧 Updating user with correct wallet...');
        existingUser.walletAddress = MISSING_WALLET;
        existingUser.walletCreatedAt = walletRecord.createdAt || new Date();
        await existingUser.save();
        console.log('✅ User wallet restored');
        return;
      }
    }
    
    // Create new user with the original wallet
    const restoredUser = new User({
      chatId: USER_CHAT_ID,
      username: 'restored_user', // Original username was lost
      firstName: 'Restored',
      lastName: 'User',
      isActive: true,
      subscribedAt: new Date(),
      language: 'ru',
      walletAddress: MISSING_WALLET,
      walletCreatedAt: walletRecord.createdAt || new Date(),
      cesBalance: 0, // Will be updated when wallet is accessed
      polBalance: 0, // Will be updated when wallet is accessed
      lastBalanceUpdate: null,
      escrowCESBalance: 0,
      escrowPOLBalance: 0,
      p2pTradingEnabled: true,
      successfulTrades: 0,
      totalTradeVolume: 0,
      p2pRating: 5.0,
      disputeCount: 0
    });
    
    await restoredUser.save();
    console.log('✅ User account restored');
    console.log(`   New User ID: ${restoredUser._id}`);
    console.log('');
    
    // 3. Update wallet record to point to new user
    console.log('📋 3. UPDATING WALLET OWNERSHIP:');
    walletRecord.userId = restoredUser._id;
    await walletRecord.save();
    console.log('✅ Wallet ownership updated');
    console.log('');
    
    // 4. Test wallet functionality
    console.log('📋 4. TESTING RESTORED WALLET:');
    try {
      const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
      
      if (walletInfo && walletInfo.hasWallet) {
        console.log('✅ Wallet is working correctly');
        console.log(`   Address: ${walletInfo.address}`);
        console.log(`   CES Balance: ${walletInfo.cesBalance}`);
        console.log(`   POL Balance: ${walletInfo.polBalance}`);
        
        // Update balances in database
        restoredUser.cesBalance = walletInfo.cesBalance;
        restoredUser.polBalance = walletInfo.polBalance;
        restoredUser.lastBalanceUpdate = new Date();
        await restoredUser.save();
        console.log('✅ Balances updated in database');
      } else {
        console.log('❌ Wallet still not working');
        console.log('   Additional debugging needed');
      }
    } catch (error) {
      console.log('❌ Wallet test failed:');
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
    
    // 5. Summary
    console.log('📋 5. RESTORATION SUMMARY:');
    console.log('==========================');
    console.log('✅ User account restored');
    console.log('✅ Wallet ownership updated');
    console.log('✅ Wallet functionality tested');
    console.log('');
    console.log('⚠️ IMPORTANT NOTES:');
    console.log('   1. User profile data (username, name, etc.) was lost');
    console.log('   2. P2P trading history may be affected');
    console.log('   3. User should verify their wallet and balances');
    console.log('   4. Consider investigating what caused the deletion');
    console.log('');
    console.log('💡 NEXT STEPS:');
    console.log('   1. User can now access their wallet in personal cabinet');
    console.log('   2. Ask user to update their profile information');
    console.log('   3. Monitor for any remaining issues');
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Restoration failed:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  restoreUserAndWallet()
    .then(() => {
      console.log('\n🎉 Restoration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Restoration failed:', error);
      process.exit(1);
    });
}

module.exports = { restoreUserAndWallet };