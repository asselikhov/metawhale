/**
 * Script to check user's actual blockchain balance
 */

const { connectDatabase } = require('../src/database/models');
const { User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

async function checkUserBlockchainBalance(userChatId) {
  console.log(`🔍 Checking blockchain balance for user: ${userChatId}`);
  
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
    
    // Check actual blockchain balances
    console.log(`\n🔍 Checking actual blockchain balances...`);
    
    const cesBalance = await walletService.getCESBalance(user.walletAddress);
    const polBalance = await walletService.getPOLBalance(user.walletAddress);
    
    console.log(`💰 CES Balance: ${cesBalance} CES`);
    console.log(`💎 POL Balance: ${polBalance} POL`);
    
    // Compare with database balances
    console.log(`\n📊 Balance Comparison:`);
    console.log(`   Database Available CES: ${user.cesBalance || 0}`);
    console.log(`   Database Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   Database Available POL: ${user.polBalance || 0}`);
    console.log(`   Database Escrowed POL: ${user.escrowPOLBalance || 0}`);
    console.log(`   Blockchain CES: ${cesBalance}`);
    console.log(`   Blockchain POL: ${polBalance}`);
    
    const totalDatabaseCES = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
    console.log(`\n📈 Total CES (Database): ${totalDatabaseCES}`);
    console.log(`📈 Blockchain CES: ${cesBalance}`);
    
    const cesDifference = Math.abs(cesBalance - totalDatabaseCES);
    if (cesDifference > 0.0001) {
      console.log(`⚠️  CES Balance Mismatch: ${cesDifference}`);
    } else {
      console.log(`✅ CES Balances Match`);
    }
    
    return {
      user,
      blockchain: {
        ces: cesBalance,
        pol: polBalance
      },
      database: {
        availableCES: user.cesBalance || 0,
        escrowedCES: user.escrowCESBalance || 0,
        availablePOL: user.polBalance || 0,
        escrowedPOL: user.escrowPOLBalance || 0
      }
    };
    
  } catch (error) {
    console.error('❌ Error checking user blockchain balance:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🔍 User Blockchain Balance Checker');
  console.log('================================');
  
  try {
    const result = await checkUserBlockchainBalance('942851377');
    console.log('\n✅ Balance check completed successfully');
    return result;
  } catch (error) {
    console.error('❌ Balance check failed:', error.message);
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

module.exports = { checkUserBlockchainBalance };