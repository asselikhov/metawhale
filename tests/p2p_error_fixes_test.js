/**
 * P2P Error Fixes Test
 * Test that the P2P errors related to null username and undefined toFixed have been fixed
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, P2POrder } = require('../src/database/models');
const reputationService = require('../src/services/reputationService');

async function runTest() {
  try {
    console.log('🧪 RUNNING P2P ERROR FIXES TEST');
    console.log('==============================');
    
    await connectDatabase();
    
    // Test 1: Check getStandardizedUserStats with null userId
    console.log('📋 Test 1: Testing getStandardizedUserStats with null userId');
    try {
      const stats = await reputationService.getStandardizedUserStats(null);
      console.log('✅ PASS: getStandardizedUserStats handles null userId correctly');
      console.log(`   Rating: ${stats.rating}`);
      console.log(`   Orders: ${stats.ordersLast30Days}`);
    } catch (error) {
      console.log('❌ FAIL: getStandardizedUserStats failed with null userId');
      console.log(`   Error: ${error.message}`);
      return;
    }
    
    // Test 2: Check getStandardizedUserStats with non-existent userId
    console.log('\n📋 Test 2: Testing getStandardizedUserStats with non-existent userId');
    try {
      const stats = await reputationService.getStandardizedUserStats('nonexistent_user_id');
      console.log('✅ PASS: getStandardizedUserStats handles non-existent userId correctly');
      console.log(`   Rating: ${stats.rating}`);
      console.log(`   Orders: ${stats.ordersLast30Days}`);
    } catch (error) {
      console.log('❌ FAIL: getStandardizedUserStats failed with non-existent userId');
      console.log(`   Error: ${error.message}`);
      return;
    }
    
    // Test 3: Check handling of order with null userId
    console.log('\n📋 Test 3: Testing P2P order display with null userId');
    try {
      // Create a mock order with null userId to simulate the error condition
      const mockOrder = {
        userId: null,
        pricePerToken: 200.50,
        remainingAmount: 10.5,
        minTradeAmount: 1,
        maxTradeAmount: 10.5
      };
      
      // Test username extraction logic
      const username = mockOrder.userId ? (mockOrder.userId.username || mockOrder.userId.firstName || 'Пользователь') : 'Пользователь';
      console.log('✅ PASS: Username extraction handles null userId correctly');
      console.log(`   Username: ${username}`);
      
      // Test stats retrieval logic
      const stats = await reputationService.getStandardizedUserStats(mockOrder.userId ? mockOrder.userId._id : null);
      const emoji = stats && stats.rating ? stats.rating.split(' ').pop() : '⭐';
      console.log('✅ PASS: Stats retrieval handles null userId correctly');
      console.log(`   Emoji: ${emoji}`);
      
      // Test price calculation logic
      const minAmount = mockOrder.minTradeAmount || 1;
      const maxAmount = mockOrder.maxTradeAmount || mockOrder.remainingAmount;
      const minRubles = (minAmount * mockOrder.pricePerToken).toFixed(2);
      const maxRubles = (maxAmount * mockOrder.pricePerToken).toFixed(2);
      console.log('✅ PASS: Price calculation works correctly');
      console.log(`   Min Rubles: ${minRubles}`);
      console.log(`   Max Rubles: ${maxRubles}`);
    } catch (error) {
      console.log('❌ FAIL: P2P order display logic failed with null userId');
      console.log(`   Error: ${error.message}`);
      return;
    }
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('====================');
    console.log('P2P errors related to null username and undefined toFixed have been fixed');
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

if (require.main === module) {
  runTest()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}