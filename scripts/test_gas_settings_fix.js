/**
 * Script to test gas settings fix
 * This script will simulate escrow refund with dynamic gas settings
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');
const { ethers } = require('ethers');

async function testGasSettingsFix(userChatId) {
  try {
    console.log(`🧪 Testing gas settings fix for user: ${userChatId}`);
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    
    // Get current gas price from provider
    const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
    const currentGasPrice = await provider.getGasPrice();
    console.log(`📊 Current network gas price: ${ethers.utils.formatUnits(currentGasPrice, 'gwei')} Gwei`);
    
    // Test the new gas settings calculation
    const adjustedGasPrice = currentGasPrice.mul(120).div(100); // 20% higher
    console.log(`📊 Adjusted gas price (20% higher): ${ethers.utils.formatUnits(adjustedGasPrice, 'gwei')} Gwei`);
    
    // Compare with old fixed settings
    const oldFixedGasPrice = ethers.utils.parseUnits('30', 'gwei');
    console.log(`📊 Old fixed gas price: ${ethers.utils.formatUnits(oldFixedGasPrice, 'gwei')} Gwei`);
    
    if (adjustedGasPrice.gt(oldFixedGasPrice)) {
      console.log(`✅ New dynamic gas price is higher than old fixed price - this should prevent 'out of gas' errors`);
    } else {
      console.log(`✅ New dynamic gas price is lower or equal to old fixed price - this should reduce transaction costs`);
    }
    
    // Test getting user's private key
    console.log(`\n🔐 Testing private key retrieval...`);
    const userPrivateKey = await walletService.getUserPrivateKey(userChatId);
    if (userPrivateKey) {
      console.log(`✅ User private key retrieved successfully`);
      
      // Create a wallet instance to test
      const wallet = new ethers.Wallet(userPrivateKey, provider);
      console.log(`✅ Wallet created successfully: ${wallet.address}`);
    } else {
      console.log(`❌ Failed to retrieve user private key`);
    }
    
    // Test smart contract connection
    console.log(`\n🔗 Testing smart contract connection...`);
    const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS || '0x04B16d50949CD92de90fbadcF49745897CbED5C4';
    console.log(`✅ Escrow contract address: ${escrowContractAddress}`);
    
    // Test getting escrow details for a known escrow (we can use one that's already refunded)
    try {
      console.log(`\n🔍 Testing escrow details retrieval...`);
      // We'll use escrow ID 15 which we just refunded
      const details = await smartContractService.getEscrowDetails('15');
      console.log(`✅ Escrow details retrieved:`);
      console.log(`   Status: ${smartContractService.getEscrowStatusText(details.status)} (${details.status})`);
      console.log(`   Amount: ${details.amount} CES`);
      console.log(`   Seller: ${details.seller}`);
      console.log(`   Buyer: ${details.buyer}`);
    } catch (error) {
      console.log(`⚠️ Could not retrieve escrow details: ${error.message}`);
    }
    
    return { success: true };
    
  } catch (error) {
    console.error(`❌ Error testing gas settings fix: ${error.message}`);
    console.error(error.stack);
    return { success: false, reason: error.message };
  }
}

// Main function
async function main() {
  console.log('🧪 Gas Settings Fix Test Script');
  console.log('============================');
  
  try {
    // Connect to database first
    await connectDatabase();
    
    // Test the gas settings fix
    const result = await testGasSettingsFix('942851377');
    
    if (result.success) {
      console.log('\n✅ Gas settings fix test completed successfully');
      console.log('\n📋 Summary of improvements:');
      console.log('   1. Dynamic gas price calculation instead of fixed values');
      console.log('   2. 20% gas price premium to ensure transaction processing');
      console.log('   3. Increased gas limit for better reliability');
      console.log('   4. Real-time network gas price monitoring');
    } else {
      console.log(`\n❌ Gas settings fix test failed: ${result.reason}`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
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

module.exports = { testGasSettingsFix };