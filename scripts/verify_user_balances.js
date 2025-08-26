/**
 * Script to verify user balances after fixing the order cancellation bug
 * This ensures that the user has the correct amount of CES tokens available
 */

const { connectDatabase } = require('../src/database/models');
const { User } = require('../src/database/models');
const { ethers } = require('ethers');
const walletService = require('../src/services/walletService');

async function verifyUserBalances(userChatId) {
  try {
    console.log(`🔍 Verifying balances for user: ${userChatId}`);
    
    // Connect to database
    await connectDatabase();
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    
    // Get wallet information
    const walletInfo = await walletService.getUserWallet(userChatId);
    
    console.log(`\n💰 Database balances:`);
    console.log(`   Available CES: ${user.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   Available POL: ${user.polBalance || 0}`);
    console.log(`   Escrowed POL: ${user.escrowPOLBalance || 0}`);
    
    console.log(`\n💼 Wallet service balances:`);
    console.log(`   Available CES: ${walletInfo.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${walletInfo.escrowCESBalance || 0}`);
    console.log(`   Available POL: ${walletInfo.polBalance || 0}`);
    console.log(`   Escrowed POL: ${walletInfo.escrowPOLBalance || 0}`);
    
    // Check real blockchain balances
    console.log(`\n🔗 Blockchain balances:`);
    
    // Check CES balance
    const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
    const cesTokenAddress = process.env.CES_TOKEN_ADDRESS || '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610';
    const erc20Abi = [
      "function balanceOf(address account) view returns (uint256)"
    ];
    
    const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);
    const realCesBalance = await cesContract.balanceOf(user.walletAddress);
    console.log(`   Real CES balance: ${ethers.utils.formatEther(realCesBalance)} CES`);
    
    // Check POL balance
    const realPolBalance = await provider.getBalance(user.walletAddress);
    console.log(`   Real POL balance: ${ethers.utils.formatEther(realPolBalance)} POL`);
    
    // Verify consistency
    console.log(`\n✅ Verification Summary:`);
    const dbCesTotal = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
    const walletCesTotal = (walletInfo.cesBalance || 0) + (walletInfo.escrowCESBalance || 0);
    const realCesTotal = parseFloat(ethers.utils.formatEther(realCesBalance));
    
    console.log(`   Database total CES: ${dbCesTotal}`);
    console.log(`   Wallet service total CES: ${walletCesTotal}`);
    console.log(`   Blockchain total CES: ${realCesTotal}`);
    
    if (dbCesTotal === walletCesTotal && Math.abs(dbCesTotal - realCesTotal) < 0.0001) {
      console.log(`✅ All balances are consistent!`);
    } else {
      console.log(`⚠️ Balance inconsistency detected:`);
      console.log(`   Difference between database and blockchain: ${Math.abs(dbCesTotal - realCesTotal)}`);
    }
    
    return {
      success: true,
      database: {
        cesBalance: user.cesBalance || 0,
        escrowCESBalance: user.escrowCESBalance || 0,
        polBalance: user.polBalance || 0,
        escrowPOLBalance: user.escrowPOLBalance || 0
      },
      walletService: walletInfo,
      blockchain: {
        cesBalance: realCesTotal,
        polBalance: parseFloat(ethers.utils.formatEther(realPolBalance))
      }
    };
    
  } catch (error) {
    console.error(`❌ Error verifying user balances: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  console.log('🔍 User Balance Verification Script');
  console.log('==================================');
  
  try {
    const result = await verifyUserBalances('942851377');
    
    if (result.success) {
      console.log('\n✅ Balance verification completed successfully');
      console.log(`   Database available CES: ${result.database.cesBalance}`);
      console.log(`   Database escrowed CES: ${result.database.escrowCESBalance}`);
      console.log(`   Blockchain total CES: ${result.blockchain.cesBalance}`);
    } else {
      console.log(`\n❌ Balance verification failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Script failed:', error.message);
  }
  
  console.log('\n🏁 Script execution completed');
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

module.exports = { verifyUserBalances };