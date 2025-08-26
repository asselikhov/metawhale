/**
 * Database Orders Cleanup Script
 * Deletes all P2P orders with status: cancelled, completed, active, partial, locked
 */

const mongoose = require('mongoose');
const { P2POrder, connectDatabase, disconnectDatabase } = require('../src/database/models');

async function cleanupOrders() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    // Define statuses to delete
    const statusesToDelete = ['active', 'partial', 'completed', 'cancelled', 'locked'];
    
    console.log(`🔍 Finding orders with statuses: ${statusesToDelete.join(', ')}`);
    
    // Get count before deletion
    const totalCount = await P2POrder.countDocuments({
      status: { $in: statusesToDelete }
    });
    
    console.log(`📊 Found ${totalCount} orders to delete`);
    
    if (totalCount === 0) {
      console.log('✅ No orders found to delete');
      return;
    }
    
    // Get detailed breakdown by status
    console.log('📈 Orders breakdown by status:');
    for (const status of statusesToDelete) {
      const count = await P2POrder.countDocuments({ status });
      if (count > 0) {
        console.log(`   - ${status}: ${count} orders`);
      }
    }
    
    // Delete orders
    console.log('🗑️ Deleting orders...');
    const deleteResult = await P2POrder.deleteMany({
      status: { $in: statusesToDelete }
    });
    
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} orders`);
    
    // Verify deletion
    const remainingCount = await P2POrder.countDocuments({
      status: { $in: statusesToDelete }
    });
    
    if (remainingCount === 0) {
      console.log('✅ All specified orders have been deleted successfully');
    } else {
      console.log(`⚠️ Warning: ${remainingCount} orders still remain`);
    }
    
    // Show remaining orders (if any)
    const totalRemaining = await P2POrder.countDocuments();
    console.log(`📊 Total orders remaining in database: ${totalRemaining}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupOrders()
    .then(() => {
      console.log('🎉 Cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOrders };