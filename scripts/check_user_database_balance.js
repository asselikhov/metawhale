/**
 * Script to check user's database balance directly
 */

const { connectDatabase } = require('../src/database/models');
const { User } = require('../src/database/models');

async function checkUserDatabaseBalance(userChatId) {
  console.log(`🔍 Checking database balance for user: ${userChatId}`);
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`   Wallet address: ${user.walletAddress}`);
    
    // Display balances
    console.log(`\n📊 Database Balances:`);
    console.log(`   Available CES: ${user.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   Available POL: ${user.polBalance || 0}`);
    console.log(`   Escrowed POL: ${user.escrowPOLBalance || 0}`);
    
    const totalCES = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
    console.log(`\n📈 Total CES Balance: ${totalCES}`);
    
    return {
      user,
      balances: {
        availableCES: user.cesBalance || 0,
        escrowedCES: user.escrowCESBalance || 0,
        availablePOL: user.polBalance || 0,
        escrowedPOL: user.escrowPOLBalance || 0,
        totalCES: totalCES
      }
    };
    
  } catch (error) {
    console.error('❌ Error checking user database balance:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🔍 User Database Balance Checker');
  console.log('==============================');
  
  try {
    const result = await checkUserDatabaseBalance('942851377');
    console.log('\n✅ Database balance check completed successfully');
    return result;
  } catch (error) {
    console.error('❌ Database balance check failed:', error.message);
    throw error;
  }
}

// Run the script if executed directly
if (require.main === module) {
  main().then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Script failed with error:', error);
    process.exit(1);
  });
}

module.exports = { checkUserDatabaseBalance };