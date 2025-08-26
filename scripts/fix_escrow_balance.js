/**
 * Fix Escrow Balance
 * Fix negative escrow balance for user 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');

const USER_CHAT_ID = '942851377';

async function fixEscrowBalance() {
  try {
    console.log('🔧 FIX ESCROW BALANCE');
    console.log('====================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
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
    console.log(`   Current Escrow CES: ${user.escrowCESBalance || 0}`);
    console.log('');
    
    // 2. Fix escrow balance if negative
    if ((user.escrowCESBalance || 0) < 0) {
      console.log('🔧 2. FIXING NEGATIVE ESCROW BALANCE:');
      user.escrowCESBalance = 0;
      await user.save();
      console.log('✅ Escrow balance fixed');
      console.log(`   New Escrow CES Balance: ${user.escrowCESBalance}`);
    } else {
      console.log('✅ Escrow balance is correct, no fix needed');
    }
    
    console.log('\n🎉 ESCROW BALANCE FIX COMPLETE!');
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error fixing escrow balance:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

if (require.main === module) {
  fixEscrowBalance()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixEscrowBalance };