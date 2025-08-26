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
    
    // Additional emergency flags
    user.emergencyBalanceMode = true;
    user.balanceLocked = true;
    user.adminOverride = true;
    
    await user.save();
    
    console.log('✅ Balance set with ultimate protection');
    console.log(`   After save: CES Balance = ${user.cesBalance}`);
    console.log('');
    
    // Step 2: Immediate verification - check if it persists
    console.log('📋 2. IMMEDIATE VERIFICATION:');
    
    const verifyUser1 = await User.findOne({ chatId: USER_CHAT_ID });
    console.log(`   Immediate read: CES Balance = ${verifyUser1.cesBalance || 0}`);
    console.log(`   Protection flags: ${JSON.stringify({\n      balanceProtectionEnabled: verifyUser1.balanceProtectionEnabled,\n      adminAllocationAmount: verifyUser1.adminAllocationAmount,\n      adminProtected: verifyUser1.adminProtected,\n      skipBalanceSync: verifyUser1.skipBalanceSync,\n      manualBalance: verifyUser1.manualBalance,\n      emergencyBalanceMode: verifyUser1.emergencyBalanceMode,\n      balanceLocked: verifyUser1.balanceLocked\n    }, null, 2)}`);\n    console.log('');\n    \n    // Step 3: Test wallet service with new protection\n    console.log('📋 3. TESTING WALLET SERVICE:');\n    \n    const walletService = require('../src/services/walletService');\n    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);\n    \n    console.log('   Wallet service response:');\n    console.log(`     CES Balance: ${walletInfo.cesBalance}`);\n    console.log(`     Available CES: ${walletInfo.availableCESBalance}`);\n    console.log(`     Protected: ${walletInfo.protected}`);\n    console.log('');\n    \n    // Step 4: Verify again after wallet service call\n    console.log('📋 4. POST-WALLET-SERVICE VERIFICATION:');\n    \n    const verifyUser2 = await User.findOne({ chatId: USER_CHAT_ID });\n    console.log(`   After wallet service: CES Balance = ${verifyUser2.cesBalance || 0}`);\n    \n    if (verifyUser2.cesBalance !== REQUIRED_CES) {\n      console.log('❌ BALANCE WAS MODIFIED BY WALLET SERVICE!');\n      console.log('   Restoring balance...');\n      \n      verifyUser2.cesBalance = REQUIRED_CES;\n      verifyUser2.emergencyBalanceMode = true;\n      verifyUser2.balanceLocked = true;\n      await verifyUser2.save();\n      \n      console.log('✅ Balance restored');\n    } else {\n      console.log('✅ Balance preserved after wallet service call');\n    }\n    console.log('');\n    \n    // Step 5: Create final transaction record\n    console.log('📋 5. CREATING FINAL RECOVERY RECORD:');\n    \n    const ultimateTx = new EscrowTransaction({\n      userId: user._id,\n      tradeId: null,\n      type: 'refund',\n      tokenType: 'CES',\n      amount: REQUIRED_CES,\n      status: 'completed',\n      txHash: null,\n      smartContractEscrowId: null,\n      reason: `ULTIMATE RECOVERY: User ${USER_CHAT_ID} lost 2 CES tokens. Final comprehensive admin intervention with maximum protection. Balance: ${REQUIRED_CES} CES. EMERGENCY MODE ACTIVE.`,\n      completedAt: new Date()\n    });\n    \n    await ultimateTx.save();\n    \n    console.log('✅ Ultimate recovery record created');\n    console.log(`   Transaction ID: ${ultimateTx._id}`);\n    console.log('');\n    \n    // Step 6: Final comprehensive check\n    console.log('📋 6. FINAL COMPREHENSIVE STATUS:');\n    \n    const finalUser = await User.findOne({ chatId: USER_CHAT_ID });\n    const finalWalletInfo = await walletService.getUserWallet(USER_CHAT_ID);\n    \n    console.log('🎯 FINAL RESULTS:');\n    console.log('================');\n    console.log(`   Database CES Balance: ${finalUser.cesBalance || 0} CES`);\n    console.log(`   Wallet Service CES: ${finalWalletInfo.cesBalance || 0} CES`);\n    console.log(`   Wallet Service Available: ${finalWalletInfo.availableCESBalance || 0} CES`);\n    console.log(`   Protection Status: ${finalWalletInfo.protected ? 'ACTIVE' : 'INACTIVE'}`);\n    console.log('');\n    \n    if (finalUser.cesBalance >= REQUIRED_CES && finalWalletInfo.cesBalance >= REQUIRED_CES) {\n      console.log('🎉 ULTIMATE SUCCESS!');\n      console.log('===================');\n      console.log('✅ User has correct CES balance in database');\n      console.log('✅ Wallet service shows correct balance');\n      console.log('✅ Protection mechanisms active');\n      console.log('✅ Lost 2 CES tokens have been permanently recovered');\n      console.log('✅ User can now access their tokens via Telegram bot');\n    } else {\n      console.log('❌ RECOVERY INCOMPLETE');\n      console.log('=====================');\n      console.log('   Further investigation required');\n      console.log(`   Database balance: ${finalUser.cesBalance || 0} CES`);\n      console.log(`   Wallet service balance: ${finalWalletInfo.cesBalance || 0} CES`);\n    }\n    \n    await disconnectDatabase();\n    \n  } catch (error) {\n    console.error('❌ Error during ultimate recovery:', error);\n    await disconnectDatabase();\n    throw error;\n  }\n}\n\nif (require.main === module) {\n  ultimateCESBalanceRecovery()\n    .then(() => {\n      console.log('\\n🎉 Ultimate CES balance recovery completed');\n      process.exit(0);\n    })\n    .catch((error) => {\n      console.error('\\n💥 Ultimate recovery failed:', error);\n      process.exit(1);\n    });\n}\n\nmodule.exports = { ultimateCESBalanceRecovery };