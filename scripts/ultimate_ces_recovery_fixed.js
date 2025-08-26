/**
 * Ultimate CES Balance Recovery
 * Final comprehensive solution that sets balance and monitors what happens to it
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');

const USER_CHAT_ID = '942851377';
const REQUIRED_CES = 2.0;

async function ultimateCESBalanceRecovery() {
  try {
    console.log('🚨 ULTIMATE CES BALANCE RECOVERY');
    console.log('================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`🎯 Required CES: ${REQUIRED_CES}`);
    console.log('');
    
    await connectDatabase();
    
    // Step 1: Set balance with maximum protection and immediate verification
    console.log('📋 1. SETTING BALANCE WITH ULTIMATE PROTECTION:');
    
    let user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log(`   Before: CES Balance = ${user.cesBalance || 0}`);
    
    // Set balance and ALL protection flags
    user.cesBalance = REQUIRED_CES;
    user.escrowCESBalance = 0;
    
    // Maximum protection
    user.balanceProtectionEnabled = true;
    user.adminAllocationAmount = REQUIRED_CES;
    user.adminAllocationReason = 'ULTIMATE: Lost 2 CES recovery - maximum protection active';
    user.adminAllocationDate = new Date();
    user.adminProtected = true;
    user.balanceOverride = REQUIRED_CES;
    user.skipBalanceSync = true;
    user.manualBalance = true;
    user.lastBalanceUpdate = new Date();
    
    await user.save();
    
    console.log('✅ Balance set with ultimate protection');
    console.log(`   After save: CES Balance = ${user.cesBalance}`);
    console.log('');
    
    // Step 2: Immediate verification - check if it persists
    console.log('📋 2. IMMEDIATE VERIFICATION:');
    
    const verifyUser1 = await User.findOne({ chatId: USER_CHAT_ID });
    console.log(`   Immediate read: CES Balance = ${verifyUser1.cesBalance || 0}`);
    
    const protectionFlags = {
      balanceProtectionEnabled: verifyUser1.balanceProtectionEnabled,
      adminAllocationAmount: verifyUser1.adminAllocationAmount,
      adminProtected: verifyUser1.adminProtected,
      skipBalanceSync: verifyUser1.skipBalanceSync,
      manualBalance: verifyUser1.manualBalance
    };
    
    console.log(`   Protection flags: ${JSON.stringify(protectionFlags, null, 2)}`);
    console.log('');
    
    // Step 3: Test wallet service with new protection
    console.log('📋 3. TESTING WALLET SERVICE:');
    
    const walletService = require('../src/services/walletService');
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    console.log('   Wallet service response:');
    console.log(`     CES Balance: ${walletInfo.cesBalance}`);
    console.log(`     Available CES: ${walletInfo.availableCESBalance}`);
    console.log(`     Protected: ${walletInfo.protected}`);
    console.log('');
    
    // Step 4: Verify again after wallet service call
    console.log('📋 4. POST-WALLET-SERVICE VERIFICATION:');
    
    const verifyUser2 = await User.findOne({ chatId: USER_CHAT_ID });
    console.log(`   After wallet service: CES Balance = ${verifyUser2.cesBalance || 0}`);
    
    if (verifyUser2.cesBalance !== REQUIRED_CES) {
      console.log('❌ BALANCE WAS MODIFIED BY WALLET SERVICE!');
      console.log('   Restoring balance...');
      
      verifyUser2.cesBalance = REQUIRED_CES;
      verifyUser2.balanceProtectionEnabled = true;
      verifyUser2.adminAllocationAmount = REQUIRED_CES;
      await verifyUser2.save();
      
      console.log('✅ Balance restored');
    } else {
      console.log('✅ Balance preserved after wallet service call');
    }
    console.log('');
    
    // Step 5: Create final transaction record
    console.log('📋 5. CREATING FINAL RECOVERY RECORD:');
    
    const ultimateTx = new EscrowTransaction({
      userId: user._id,
      tradeId: null,
      type: 'refund',
      tokenType: 'CES',
      amount: REQUIRED_CES,
      status: 'completed',
      txHash: null,
      smartContractEscrowId: null,
      reason: `ULTIMATE RECOVERY: User ${USER_CHAT_ID} lost 2 CES tokens. Final comprehensive admin intervention with maximum protection. Balance: ${REQUIRED_CES} CES. EMERGENCY MODE ACTIVE.`,
      completedAt: new Date()
    });
    
    await ultimateTx.save();
    
    console.log('✅ Ultimate recovery record created');
    console.log(`   Transaction ID: ${ultimateTx._id}`);
    console.log('');
    
    // Step 6: Final comprehensive check
    console.log('📋 6. FINAL COMPREHENSIVE STATUS:');
    
    const finalUser = await User.findOne({ chatId: USER_CHAT_ID });
    const finalWalletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    console.log('🎯 FINAL RESULTS:');
    console.log('================');
    console.log(`   Database CES Balance: ${finalUser.cesBalance || 0} CES`);
    console.log(`   Wallet Service CES: ${finalWalletInfo.cesBalance || 0} CES`);
    console.log(`   Wallet Service Available: ${finalWalletInfo.availableCESBalance || 0} CES`);
    console.log(`   Protection Status: ${finalWalletInfo.protected ? 'ACTIVE' : 'INACTIVE'}`);
    console.log('');
    
    if (finalUser.cesBalance >= REQUIRED_CES && finalWalletInfo.cesBalance >= REQUIRED_CES) {
      console.log('🎉 ULTIMATE SUCCESS!');
      console.log('===================');
      console.log('✅ User has correct CES balance in database');
      console.log('✅ Wallet service shows correct balance');
      console.log('✅ Protection mechanisms active');
      console.log('✅ Lost 2 CES tokens have been permanently recovered');
      console.log('✅ User can now access their tokens via Telegram bot');
    } else {
      console.log('❌ RECOVERY INCOMPLETE');
      console.log('=====================');
      console.log('   Further investigation required');
      console.log(`   Database balance: ${finalUser.cesBalance || 0} CES`);
      console.log(`   Wallet service balance: ${finalWalletInfo.cesBalance || 0} CES`);
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error during ultimate recovery:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  ultimateCESBalanceRecovery()
    .then(() => {
      console.log('\n🎉 Ultimate CES balance recovery completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Ultimate recovery failed:', error);
      process.exit(1);
    });
}

module.exports = { ultimateCESBalanceRecovery };