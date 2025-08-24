const mongoose = require('mongoose');
const { P2POrder, User } = require('./src/database/models');

async function createTestSellOrders() {
  try {
    await mongoose.connect('mongodb://localhost:27017/metawhale');
    
    console.log('Connected to database');
    
    // Create a test user first
    let testUser = await User.findOne({ chatId: 'test_seller' });
    if (!testUser) {
      testUser = new User({
        chatId: 'test_seller',
        username: 'test_seller',
        firstName: 'Test',
        lastName: 'Seller',
        walletAddress: '0x1234567890123456789012345678901234567890'
      });
      await testUser.save();
      console.log('Test user created');
    }
    
    // Create multiple test sell orders
    const testOrders = [
      {
        userId: testUser._id,
        type: 'sell',
        amount: 100,
        pricePerToken: 2.50,
        totalValue: 250,
        remainingAmount: 100,
        status: 'active',
        minTradeAmount: 10,
        maxTradeAmount: 100
      },
      {
        userId: testUser._id,
        type: 'sell',
        amount: 200,
        pricePerToken: 2.45,
        totalValue: 490,
        remainingAmount: 200,
        status: 'active',
        minTradeAmount: 20,
        maxTradeAmount: 200
      },
      {
        userId: testUser._id,
        type: 'sell',
        amount: 150,
        pricePerToken: 2.60,
        totalValue: 390,
        remainingAmount: 150,
        status: 'active',
        minTradeAmount: 15,
        maxTradeAmount: 150
      }
    ];
    
    // Delete existing test orders
    await P2POrder.deleteMany({ userId: testUser._id });
    
    // Create new test orders
    for (let i = 0; i < testOrders.length; i++) {
      const order = new P2POrder(testOrders[i]);
      await order.save();
      console.log(`Test sell order ${i+1} created: ${order.amount} CES at ₽${order.pricePerToken}`);
    }
    
    // Verify orders were created
    const sellOrders = await P2POrder.find({ 
      type: 'sell', 
      status: 'active',
      remainingAmount: { $gt: 0 }
    }).populate('userId');
    
    console.log(`\nVerification: Found ${sellOrders.length} active sell orders`);
    sellOrders.forEach((order, i) => {
      console.log(`Order ${i+1}: ${order.amount} CES at ₽${order.pricePerToken} - User: ${order.userId.firstName}`);
    });
    
    await mongoose.disconnect();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestSellOrders();