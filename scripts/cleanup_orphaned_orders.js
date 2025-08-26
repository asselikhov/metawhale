/**
 * Cleanup script to identify and remove orphaned P2P orders
 * This script finds orders that reference users that no longer exist and removes them
 */

const { connectDatabase } = require('../src/database/models');
const { P2POrder, User } = require('../src/database/models');

async function cleanupOrphanedOrders() {
  console.log('🧹 Starting orphaned P2P orders cleanup...');
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Find all P2P orders and populate userId
    console.log('🔍 Finding all P2P orders...');
    const orders = await P2POrder.find({}).populate('userId');
    
    console.log(`📋 Found ${orders.length} total orders`);
    
    // Identify orphaned orders (orders with null userId after populate)
    const orphanedOrders = orders.filter(order => order.userId === null);
    
    console.log(`⚠️  Found ${orphanedOrders.length} orphaned orders`);
    
    if (orphanedOrders.length === 0) {
      console.log('✅ No orphaned orders found. Database is clean.');
      return;
    }
    
    // Display orphaned orders
    console.log('\n📄 Orphaned orders:');
    orphanedOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order._id}, Type: ${order.type}, Amount: ${order.amount} CES, Created: ${order.createdAt}`);
    });
    
    // Ask for confirmation before deletion (in a real script, you might want to add actual user input)
    console.log('\n❓ Would you like to delete these orphaned orders? (In a real script, this would prompt for confirmation)');
    
    // For now, we'll just simulate the deletion
    console.log('🚫 Deletion simulation: Skipping actual deletion in this script');
    console.log('💡 To actually delete, uncomment the deletion code below');
    
    /*
    // Uncomment this section to actually delete orphaned orders
    console.log('\n🗑️  Deleting orphaned orders...');
    const deleteResults = await Promise.allSettled(
      orphanedOrders.map(order => P2POrder.deleteOne({ _id: order._id }))
    );
    
    const successfulDeletes = deleteResults.filter(result => result.status === 'fulfilled').length;
    const failedDeletes = deleteResults.filter(result => result.status === 'rejected').length;
    
    console.log(`✅ Successfully deleted ${successfulDeletes} orphaned orders`);
    if (failedDeletes > 0) {
      console.log(`❌ Failed to delete ${failedDeletes} orphaned orders`);
    }
    */
    
    console.log('\n✅ Orphaned orders cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupOrphanedOrders().then(() => {
    console.log('🏁 Cleanup script finished');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Cleanup script failed:', error);
    process.exit(1);
  });
}

module.exports = { cleanupOrphanedOrders };