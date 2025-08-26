/**
 * Safe Database Orders Cleanup Script
 * Shows order details and asks for confirmation before deletion
 */

const mongoose = require('mongoose');
const readline = require('readline');
const { P2POrder, connectDatabase, disconnectDatabase } = require('../src/database/models');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask user confirmation
function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

async function safeCleanupOrders() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    // Define statuses to delete
    const statusesToDelete = ['active', 'partial', 'completed', 'cancelled', 'locked'];
    
    console.log(`🔍 Finding orders with statuses: ${statusesToDelete.join(', ')}`);
    
    // Get orders to be deleted with user information
    const ordersToDelete = await P2POrder.find({
      status: { $in: statusesToDelete }
    }).populate('userId', 'chatId username firstName').sort({ createdAt: -1 });
    
    console.log(`📊 Found ${ordersToDelete.length} orders to delete`);
    
    if (ordersToDelete.length === 0) {
      console.log('✅ No orders found to delete');
      return;
    }
    
    // Show detailed breakdown
    console.log('\n📈 Orders breakdown by status:');
    const statusCounts = {};
    ordersToDelete.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} orders`);
    });
    
    // Show sample orders
    console.log('\n📋 Sample orders (first 10):');
    console.log('-----------------------------------');
    ordersToDelete.slice(0, 10).forEach((order, index) => {
      const user = order.userId ? `${order.userId.username || order.userId.firstName || order.userId.chatId}` : 'Unknown';
      console.log(`${index + 1}. ID: ${order._id}`);
      console.log(`   Type: ${order.type} | Status: ${order.status}`);
      console.log(`   Amount: ${order.amount} CES | Price: ₽${order.pricePerToken}`);
      console.log(`   User: ${user} | Created: ${order.createdAt.toISOString()}`);
      console.log(`   Escrow: ${order.escrowLocked ? `Locked (${order.escrowAmount} CES)` : 'Not locked'}`);
      console.log('-----------------------------------');
    });
    
    if (ordersToDelete.length > 10) {
      console.log(`... and ${ordersToDelete.length - 10} more orders`);
    }
    
    // Ask for confirmation
    console.log(`\n⚠️  WARNING: This will permanently delete ${ordersToDelete.length} orders from the database!`);
    console.log('This action cannot be undone.');
    
    const confirmDelete = await askConfirmation('\nDo you want to proceed with the deletion? (y/N): ');
    
    if (!confirmDelete) {
      console.log('❌ Deletion cancelled by user');
      return;
    }
    
    // Second confirmation for large deletions
    if (ordersToDelete.length > 50) {
      console.log(`\n🚨 You are about to delete ${ordersToDelete.length} orders!`);
      const finalConfirm = await askConfirmation('Are you absolutely sure? Type "yes" to confirm: ');
      
      if (!finalConfirm) {
        console.log('❌ Deletion cancelled by user');
        return;
      }
    }
    
    // Perform deletion
    console.log('\n🗑️ Deleting orders...');
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
    
    // Show final statistics
    const totalRemaining = await P2POrder.countDocuments();
    console.log(`📊 Total orders remaining in database: ${totalRemaining}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    rl.close();
    await disconnectDatabase();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
if (require.main === module) {
  safeCleanupOrders()
    .then(() => {
      console.log('🎉 Cleanup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { safeCleanupOrders };