/**
 * Script to delete all published P2P orders from the database
 * Run this script to clean up all existing orders
 */

const { connectDatabase, P2POrder, P2PTrade, isDatabaseConnected } = require('./src/database/models');

async function deleteAllP2POrders() {
  try {
    console.log('🗑️ Starting cleanup of all P2P orders...');
    
    // Connect to database
    if (!isDatabaseConnected()) {
      await connectDatabase();
    }
    
    // Get count of existing orders
    const orderCount = await P2POrder.countDocuments();
    const tradeCount = await P2PTrade.countDocuments();
    
    console.log(`📊 Found ${orderCount} P2P orders and ${tradeCount} P2P trades`);
    
    if (orderCount === 0 && tradeCount === 0) {
      console.log('✅ No orders or trades to delete');
      return;
    }
    
    // Delete all P2P orders
    const ordersResult = await P2POrder.deleteMany({});
    console.log(`🗑️ Deleted ${ordersResult.deletedCount} P2P orders`);
    
    // Delete all P2P trades
    const tradesResult = await P2PTrade.deleteMany({});
    console.log(`🗑️ Deleted ${tradesResult.deletedCount} P2P trades`);
    
    console.log('✅ Successfully cleaned up all P2P orders and trades!');
    
    // Verify cleanup
    const remainingOrders = await P2POrder.countDocuments();
    const remainingTrades = await P2PTrade.countDocuments();
    
    if (remainingOrders === 0 && remainingTrades === 0) {
      console.log('✅ Verification: Database is clean');
    } else {
      console.log(`⚠️ Warning: ${remainingOrders} orders and ${remainingTrades} trades still remain`);
    }
    
  } catch (error) {
    console.error('❌ Error deleting P2P orders:', error);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run the cleanup
deleteAllP2POrders();