/**
 * Verify Wallet Restoration
 * Confirm that user 942851377 can now access their restored wallet
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const USER_CHAT_ID = '942851377';
const EXPECTED_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function verifyWalletRestoration() {
  try {
    console.log('✅ VERIFYING WALLET RESTORATION');
    console.log('===============================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Expected Wallet: ${EXPECTED_WALLET}`);
    console.log('');
    
    await connectDatabase();
    
    // 1. Test getUserWallet service
    console.log('📋 1. TESTING WALLET SERVICE:');
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    if (!walletInfo) {
      console.log('❌ walletService.getUserWallet() returned NULL');
      return;
    }
    
    if (!walletInfo.hasWallet) {
      console.log('❌ walletService reports: NO WALLET');
      return;
    }
    
    console.log('✅ walletService reports: HAS WALLET');
    console.log(`   Address: ${walletInfo.address}`);
    console.log(`   Correct Address: ${walletInfo.address === EXPECTED_WALLET ? 'YES' : 'NO'}`);
    console.log(`   CES Balance: ${walletInfo.cesBalance} CES`);
    console.log(`   POL Balance: ${walletInfo.polBalance} POL`);
    console.log(`   Available CES: ${walletInfo.availableCESBalance} CES`);
    console.log(`   Available POL: ${walletInfo.availablePOLBalance} POL`);
    console.log(`   Escrow CES: ${walletInfo.escrowCESBalance} CES`);
    console.log(`   Escrow POL: ${walletInfo.escrowPOLBalance} POL`);
    console.log('');
    
    // 2. Test private key access
    console.log('📋 2. TESTING PRIVATE KEY ACCESS:');
    try {
      const privateKey = await walletService.getUserPrivateKey(USER_CHAT_ID);
      console.log('✅ Private key accessible');
      console.log(`   Key length: ${privateKey.length} characters`);
      console.log(`   Starts with 0x: ${privateKey.startsWith('0x') ? 'YES' : 'NO'}`);
    } catch (error) {
      console.log('❌ Private key access failed:');
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
    
    // 3. Test wallet creation scenario (should fail since wallet exists)
    console.log('📋 3. TESTING WALLET CREATION (Should fail):');
    try {
      await walletService.createUserWallet(USER_CHAT_ID);
      console.log('❌ UNEXPECTED: Wallet creation succeeded (should have failed)');
    } catch (error) {
      if (error.message.includes('already have a wallet')) {
        console.log('✅ Wallet creation correctly failed - user already has wallet');
      } else {
        console.log('⚠️ Wallet creation failed with unexpected error:');
        console.log(`   Error: ${error.message}`);
      }
    }
    console.log('');
    
    // 4. Summary
    console.log('📋 4. VERIFICATION SUMMARY:');
    console.log('===========================');
    
    if (walletInfo && walletInfo.hasWallet && walletInfo.address === EXPECTED_WALLET) {
      console.log('🎉 WALLET RESTORATION SUCCESSFUL!');
      console.log('');
      console.log('✅ User can now:');
      console.log('   • Access their wallet in personal cabinet');
      console.log('   • See their CES and POL balances');
      console.log('   • Use P2P trading functions');
      console.log('   • Make transfers');
      console.log('   • View wallet details and private key');
      console.log('');
      console.log('📊 Current Balances:');
      console.log(`   • CES: ${walletInfo.cesBalance} (${walletInfo.availableCESBalance} available)`);
      console.log(`   • POL: ${walletInfo.polBalance} (${walletInfo.availablePOLBalance} available)`);
      console.log('');
      console.log('💡 User Actions Recommended:');
      console.log('   1. Update profile information (username, etc.)');
      console.log('   2. Verify wallet balances are correct');
      console.log('   3. Test a small transaction to confirm functionality');
      console.log('   4. Backup private key if not already done');
      console.log('');
      console.log('🔧 Admin Actions:');
      console.log('   1. Investigate what caused the original deletion');
      console.log('   2. Implement safeguards to prevent future deletions');
      console.log('   3. Monitor user account for any issues');
      console.log('   4. Consider database backup strategy review');
    } else {
      console.log('❌ WALLET RESTORATION INCOMPLETE');
      console.log('   Further investigation needed');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  verifyWalletRestoration()
    .then(() => {
      console.log('\n🎉 Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyWalletRestoration };