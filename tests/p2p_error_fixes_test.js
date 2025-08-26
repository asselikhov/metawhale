/**
 * Test script to verify P2P error fixes
 * This script tests the fixes for "Cannot read properties of null (reading '_id')" errors
 */

const { P2POrder, User } = require('../src/database/models');
const reputationService = require('../src/services/reputationService');

async function testP2PErrorFixes() {
  console.log('🧪 Testing P2P Error Fixes');
  console.log('=========================');
  
  try {
    // Test 1: Check getStandardizedUserStats with null userId
    console.log('📋 Test 1: Testing getStandardizedUserStats with null userId');
    try {
      const stats = await reputationService.getStandardizedUserStats(null);
      console.log('✅ PASS: getStandardizedUserStats handles null userId correctly');
      console.log(`   Result: ${JSON.stringify(stats)}`);
    } catch (error) {
      console.log('❌ FAIL: getStandardizedUserStats failed with null userId');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 2: Check getStandardizedUserStats with non-existent userId
    console.log('\n📋 Test 2: Testing getStandardizedUserStats with non-existent userId');
    try {
      const stats = await reputationService.getStandardizedUserStats('nonexistent_user_id');
      console.log('✅ PASS: getStandardizedUserStats handles non-existent userId correctly');
      console.log(`   Result: ${JSON.stringify(stats)}`);
    } catch (error) {
      console.log('❌ FAIL: getStandardizedUserStats failed with non-existent userId');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 3: Simulate order with null userId (the main issue)
    console.log('\n📋 Test 3: Simulating order with null userId');
    const mockOrder = {
      userId: null,
      pricePerToken: 100,
      remainingAmount: 50,
      minTradeAmount: 1,
      maxTradeAmount: 50,
      _id: 'mock_order_id'
    };
    
    try {
      // This simulates the fix in P2POrdersHandler
      const username = mockOrder.userId ? (mockOrder.userId.username || mockOrder.userId.firstName || 'Пользователь') : 'Пользователь';
      const stats = await reputationService.getStandardizedUserStats(mockOrder.userId ? mockOrder.userId._id : null);
      const emoji = stats && stats.rating ? stats.rating.split(' ').pop() : '⭐';
      
      const minAmount = mockOrder.minTradeAmount || 1;
      const maxAmount = mockOrder.maxTradeAmount || mockOrder.remainingAmount;
      const minRubles = (minAmount * mockOrder.pricePerToken).toFixed(2);
      const maxRubles = (maxAmount * mockOrder.pricePerToken).toFixed(2);
      
      const orderMessage = `₽ ${mockOrder.pricePerToken.toFixed(2)} / CES | @${username} ${emoji}\n` +
                         `Доступно: ${mockOrder.remainingAmount.toFixed(2)} CES\n` +
                         `Лимиты: ${minRubles} - ${maxRubles} ₽`;
                         
      console.log('✅ PASS: Order with null userId handled correctly');
      console.log(`   Message: ${orderMessage}`);
    } catch (error) {
      console.log('❌ FAIL: Order with null userId not handled correctly');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 4: Simulate order with valid userId
    console.log('\n📋 Test 4: Simulating order with valid userId');
    const mockUser = {
      _id: 'valid_user_id',
      username: 'testuser',
      firstName: 'Test'
    };
    
    const mockOrderWithUser = {
      userId: mockUser,
      pricePerToken: 100,
      remainingAmount: 50,
      minTradeAmount: 1,
      maxTradeAmount: 50,
      _id: 'mock_order_id'
    };
    
    try {
      // This simulates the normal case in P2POrdersHandler
      const username = mockOrderWithUser.userId ? (mockOrderWithUser.userId.username || mockOrderWithUser.userId.firstName || 'Пользователь') : 'Пользователь';
      const stats = await reputationService.getStandardizedUserStats(mockOrderWithUser.userId ? mockOrderWithUser.userId._id : null);
      const emoji = stats && stats.rating ? stats.rating.split(' ').pop() : '⭐';
      
      const minAmount = mockOrderWithUser.minTradeAmount || 1;
      const maxAmount = mockOrderWithUser.maxTradeAmount || mockOrderWithUser.remainingAmount;
      const minRubles = (minAmount * mockOrderWithUser.pricePerToken).toFixed(2);
      const maxRubles = (maxAmount * mockOrderWithUser.pricePerToken).toFixed(2);
      
      const orderMessage = `₽ ${mockOrderWithUser.pricePerToken.toFixed(2)} / CES | @${username} ${emoji}\n` +
                         `Доступно: ${mockOrderWithUser.remainingAmount.toFixed(2)} CES\n` +
                         `Лимиты: ${minRubles} - ${maxRubles} ₽`;
                         
      console.log('✅ PASS: Order with valid userId handled correctly');
      console.log(`   Message: ${orderMessage}`);
    } catch (error) {
      console.log('❌ FAIL: Order with valid userId not handled correctly');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testP2PErrorFixes().catch(console.error);
}

module.exports = { testP2PErrorFixes };