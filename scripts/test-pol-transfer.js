/**
 * Test script for POL token transfer functionality
 */

require('dotenv').config();
const mongoose = require('mongoose');
const walletService = require('../src/services/walletService');

// Test data - using the seller's chat ID from the logs
const TEST_CHAT_ID = '942851377'; // Алексей
const TEST_RECIPIENT_ADDRESS = '0xA055F762EFa0a0499f48cFD74AFA13e66D8FF7a4';
const TEST_AMOUNT = 0.2;

async function testPOLTransfer() {
  try {
    console.log('🧪 TESTING POL TOKEN TRANSFER');
    console.log('=============================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    console.log(`\n📤 Testing transfer of ${TEST_AMOUNT} POL from ${TEST_CHAT_ID} to ${TEST_RECIPIENT_ADDRESS}`);
    
    // Execute the transfer
    const result = await walletService.sendPOLTokens(TEST_CHAT_ID, TEST_RECIPIENT_ADDRESS, TEST_AMOUNT);
    
    console.log('\n✅ TRANSFER SUCCESSFUL!');
    console.log(`   Transaction Hash: ${result.txHash}`);
    console.log(`   Amount: ${result.amount} POL`);
    console.log(`   To Address: ${result.toAddress}`);
    
  } catch (error) {
    console.error('\n❌ TRANSFER FAILED:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  testPOLTransfer().catch(console.error);
}

module.exports = { testPOLTransfer };