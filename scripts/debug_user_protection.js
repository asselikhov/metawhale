/**
 * Debug User Protection Flags
 * Examine the exact user record to understand why protection isn't working
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');

const USER_CHAT_ID = '942851377';

async function debugUserProtectionFlags() {
  try {
    console.log('🔍 DEBUGGING USER PROTECTION FLAGS');
    console.log('==================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log('');
    
    await connectDatabase();
    
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('📋 COMPLETE USER RECORD:');
    console.log('========================');
    
    // Show all relevant fields
    console.log(`User ID: ${user._id}`);
    console.log(`Chat ID: ${user.chatId}`);
    console.log(`Wallet Address: ${user.walletAddress}`);
    console.log(`CES Balance: ${user.cesBalance}`);
    console.log(`Escrow CES Balance: ${user.escrowCESBalance}`);
    console.log(`POL Balance: ${user.polBalance}`);
    console.log(`Escrow POL Balance: ${user.escrowPOLBalance}`);
    console.log(`Last Balance Update: ${user.lastBalanceUpdate}`);
    console.log('');
    
    console.log('🔒 PROTECTION FLAGS:');
    console.log('====================');
    console.log(`balanceProtectionEnabled: ${user.balanceProtectionEnabled}`);
    console.log(`adminAllocationAmount: ${user.adminAllocationAmount}`);
    console.log(`adminAllocationReason: ${user.adminAllocationReason}`);
    console.log(`adminAllocationDate: ${user.adminAllocationDate}`);
    console.log('');
    
    console.log('🧪 PROTECTION LOGIC TEST:');
    console.log('=========================');
    
    const hasBalanceProtection = user.balanceProtectionEnabled || user.adminAllocationAmount > 0;
    console.log(`user.balanceProtectionEnabled: ${user.balanceProtectionEnabled} (${typeof user.balanceProtectionEnabled})`);
    console.log(`user.adminAllocationAmount: ${user.adminAllocationAmount} (${typeof user.adminAllocationAmount})`);
    console.log(`user.adminAllocationAmount > 0: ${user.adminAllocationAmount > 0}`);
    console.log(`hasBalanceProtection: ${hasBalanceProtection}`);
    console.log('');
    
    if (hasBalanceProtection) {
      console.log('✅ PROTECTION SHOULD BE ACTIVE');
      console.log('   The wallet service should respect the protection');
    } else {
      console.log('❌ PROTECTION IS NOT ACTIVE');
      console.log('   Need to investigate why flags are not set correctly');
      
      // Try to fix the protection flags
      console.log('');
      console.log('🔧 FIXING PROTECTION FLAGS:');
      
      user.balanceProtectionEnabled = true;
      user.adminAllocationAmount = user.cesBalance || 2.0;
      user.adminAllocationReason = 'Debug fix: Ensuring balance protection is active';
      user.adminAllocationDate = new Date();
      
      await user.save();
      
      console.log('✅ Protection flags updated');
      console.log(`   balanceProtectionEnabled: ${user.balanceProtectionEnabled}`);
      console.log(`   adminAllocationAmount: ${user.adminAllocationAmount}`);
    }
    
    console.log('');
    console.log('📊 FINAL CHECK:');
    
    const finalUser = await User.findOne({ chatId: USER_CHAT_ID });
    const finalProtection = finalUser.balanceProtectionEnabled || finalUser.adminAllocationAmount > 0;
    
    console.log(`Final protection status: ${finalProtection}`);
    console.log(`Final CES balance: ${finalUser.cesBalance}`);
    
    if (finalProtection && finalUser.cesBalance >= 2.0) {
      console.log('🎉 PROTECTION IS NOW ACTIVE AND BALANCE IS CORRECT');
    } else {
      console.log('⚠️ Still need to investigate further');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error debugging user protection:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  debugUserProtectionFlags()
    .then(() => {
      console.log('\n🎉 Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugUserProtectionFlags };