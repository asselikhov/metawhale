/**
 * Test script to verify P2P order limit functionality
 * Each user should only be able to create 1 buy order and 1 sell order
 */

const { P2POrder, User } = require('./src/database/models');
const p2pService = require('./src/services/p2pService');

async function testOrderLimits() {
  console.log('🧪 Testing P2P Order Limits...\n');
  
  try {
    // Mock user data
    const testChatId = 'test_user_123';
    
    console.log('1️⃣ Testing Buy Order Limit...');
    
    // First buy order should succeed
    try {
      const buyOrder1 = await p2pService.createBuyOrder(testChatId, 10, 250, 1, 10);
      console.log('✅ First buy order created successfully');
    } catch (error) {
      console.log('❌ First buy order failed:', error.message);
    }
    
    // Second buy order should fail
    try {
      const buyOrder2 = await p2pService.createBuyOrder(testChatId, 5, 255, 1, 5);
      console.log('❌ Second buy order should have failed but succeeded');
    } catch (error) {
      console.log('✅ Second buy order correctly rejected:', error.message);
    }
    
    console.log('\n2️⃣ Testing Sell Order Limit...');
    
    // First sell order should succeed
    try {
      const sellOrder1 = await p2pService.createSellOrder(testChatId, 8, 252, ['bank_transfer'], 1, 8);
      console.log('✅ First sell order created successfully');
    } catch (error) {
      console.log('❌ First sell order failed:', error.message);
    }
    
    // Second sell order should fail
    try {
      const sellOrder2 = await p2pService.createSellOrder(testChatId, 3, 248, ['bank_transfer'], 1, 3);
      console.log('❌ Second sell order should have failed but succeeded');
    } catch (error) {
      console.log('✅ Second sell order correctly rejected:', error.message);
    }
    
    console.log('\n3️⃣ Checking Database State...');
    
    // Check how many active orders user has
    const user = await User.findOne({ chatId: testChatId });
    if (user) {
      const userOrders = await P2POrder.find({
        userId: user._id,
        status: { $in: ['active', 'partial'] }
      });
      
      const buyOrders = userOrders.filter(o => o.type === 'buy');
      const sellOrders = userOrders.filter(o => o.type === 'sell');
      
      console.log(`📊 User has ${buyOrders.length} active buy orders`);
      console.log(`📊 User has ${sellOrders.length} active sell orders`);
      
      if (buyOrders.length <= 1 && sellOrders.length <= 1) {
        console.log('✅ Order limits enforced correctly!');
      } else {
        console.log('❌ Order limits not enforced properly!');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('\n🏁 Test completed.');
}

// Run test if this script is executed directly
if (require.main === module) {
  testOrderLimits();
}

module.exports = { testOrderLimits };