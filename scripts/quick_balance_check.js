/**
 * Quick User Balance Check
 * Verify the user's current CES balance after manual allocation
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');

const USER_CHAT_ID = '942851377';

async function checkUserBalance() {
  try {
    console.log('🔍 CHECKING USER BALANCE');
    console.log('========================');
    
    await connectDatabase();
    
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   Chat ID: ${user.chatId}`);
    console.log(`   Wallet: ${user.walletAddress}`);
    console.log(`   CES Balance: ${user.cesBalance || 0} CES`);
    console.log(`   Escrow CES: ${user.escrowCESBalance || 0} CES`);
    console.log(`   Total CES: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)} CES`);
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error checking user balance:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  checkUserBalance()
    .then(() => {
      console.log('\n✅ Balance check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Balance check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkUserBalance };