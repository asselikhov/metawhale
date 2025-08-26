/**
 * Comprehensive Database Orders Cleanup Script
 * Handles escrow releases before deleting orders to prevent balance issues
 */

const mongoose = require('mongoose');
const { P2POrder, User, EscrowTransaction, connectDatabase, disconnectDatabase } = require('../src/database/models');

async function comprehensiveCleanupOrders() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    const statusesToDelete = ['active', 'partial', 'completed', 'cancelled', 'locked'];
    
    console.log('📊 Starting comprehensive order cleanup...');
    console.log(`🔍 Target statuses: ${statusesToDelete.join(', ')}`);
    
    // Step 1: Find all orders to be deleted
    const ordersToDelete = await P2POrder.find({
      status: { $in: statusesToDelete }
    }).populate('userId');
    
    console.log(`📋 Found ${ordersToDelete.length} orders to process`);
    
    if (ordersToDelete.length === 0) {
      console.log('✅ No orders found to delete');
      return;
    }
    
    // Step 2: Identify orders with locked escrow
    const ordersWithEscrow = ordersToDelete.filter(order => 
      order.escrowLocked && order.escrowAmount > 0
    );
    
    console.log(`🔒 Found ${ordersWithEscrow.length} orders with locked escrow`);
    
    // Step 3: Release escrow for orders that have locked tokens
    let escrowReleaseCount = 0;
    let escrowReleaseErrors = 0;
    
    if (ordersWithEscrow.length > 0) {
      console.log('🔓 Releasing escrow tokens...');
      
      for (const order of ordersWithEscrow) {
        try {
          const user = order.userId;
          if (!user) {
            console.log(`⚠️ Skipping order ${order._id}: User not found`);
            escrowReleaseErrors++;
            continue;
          }
          
          // Check if escrow was already released
          const existingRefund = await EscrowTransaction.findOne({
            userId: user._id,
            type: 'refund',
            amount: order.escrowAmount,
            reason: { $regex: /order.*cancel/i }
          });
          
          if (existingRefund) {
            console.log(`ℹ️ Escrow for order ${order._id} already released`);
            continue;
          }
          
          // Update user balances
          if (order.type === 'sell') {
            user.escrowCESBalance = Math.max(0, (user.escrowCESBalance || 0) - order.escrowAmount);
            user.cesBalance = (user.cesBalance || 0) + order.escrowAmount;
            
            await user.save();
            
            // Create escrow transaction record
            const escrowTx = new EscrowTransaction({
              userId: user._id,
              type: 'refund',
              tokenType: 'CES',
              amount: order.escrowAmount,
              status: 'completed',
              reason: `Order cleanup: Refunded from cancelled order ${order._id}`,
              completedAt: new Date()
            });
            
            await escrowTx.save();
            
            console.log(`✅ Released ${order.escrowAmount} CES for user ${user.chatId} (order ${order._id})`);
            escrowReleaseCount++;
          }
          
        } catch (error) {
          console.error(`❌ Error releasing escrow for order ${order._id}:`, error);
          escrowReleaseErrors++;
        }
      }
      
      console.log(`🔓 Escrow release summary: ${escrowReleaseCount} successful, ${escrowReleaseErrors} errors`);
    }
    
    // Step 4: Show statistics before deletion
    console.log('\n📈 Orders breakdown by status:');
    const statusCounts = {};
    ordersToDelete.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} orders`);
    });
    
    // Step 5: Delete orders
    console.log('\n🗑️ Deleting orders...');
    const deleteResult = await P2POrder.deleteMany({
      status: { $in: statusesToDelete }
    });
    
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} orders`);
    
    // Step 6: Verification
    const remainingCount = await P2POrder.countDocuments({
      status: { $in: statusesToDelete }
    });
    
    if (remainingCount === 0) {
      console.log('✅ All specified orders have been deleted successfully');
    } else {
      console.log(`⚠️ Warning: ${remainingCount} orders still remain`);
    }
    
    const totalRemaining = await P2POrder.countDocuments();
    console.log(`📊 Total orders remaining in database: ${totalRemaining}`);
    
    // Step 7: Summary
    console.log('\n📋 Cleanup Summary:');
    console.log(`   - Orders deleted: ${deleteResult.deletedCount}`);
    console.log(`   - Escrow releases: ${escrowReleaseCount}`);
    console.log(`   - Escrow errors: ${escrowReleaseErrors}`);
    console.log(`   - Orders remaining: ${totalRemaining}`);
    
  } catch (error) {
    console.error('❌ Error during comprehensive cleanup:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('🔌 Database connection closed');
  }
}

// Run the comprehensive cleanup
if (require.main === module) {
  comprehensiveCleanupOrders()
    .then(() => {
      console.log('🎉 Comprehensive cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Comprehensive cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { comprehensiveCleanupOrders };