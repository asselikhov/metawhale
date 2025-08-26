/**
 * Script to diagnose escrow and order status
 * This script will check the status of escrow transactions and corresponding orders
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction, P2POrder } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');

async function diagnoseEscrowOrderStatus(userChatId) {
  try {
    console.log(`🔍 Diagnosing escrow and order status for user: ${userChatId}`);
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`   Wallet address: ${user.walletAddress}`);
    
    // Get all escrow transactions for this user
    const escrowTransactions = await EscrowTransaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    
    console.log(`\n📋 Found ${escrowTransactions.length} recent escrow transactions:`);
    
    for (const tx of escrowTransactions) {
      console.log(`\n--- Transaction ${tx._id} ---`);
      console.log(`   Type: ${tx.type}`);
      console.log(`   Token: ${tx.tokenType}`);
      console.log(`   Amount: ${tx.amount}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Trade ID: ${tx.tradeId}`);
      console.log(`   Smart Contract Escrow ID: ${tx.smartContractEscrowId}`);
      console.log(`   Created: ${tx.createdAt}`);
      console.log(`   Completed: ${tx.completedAt}`);
      console.log(`   Reason: ${tx.reason}`);
      
      // If this is a lock transaction with a smart contract ID, check the escrow status
      if (tx.type === 'lock' && tx.smartContractEscrowId) {
        try {
          console.log(`   🔍 Checking smart contract status...`);
          const details = await smartContractService.getEscrowDetails(tx.smartContractEscrowId);
          console.log(`      Status: ${smartContractService.getEscrowStatusText(details.status)} (${details.status})`);
          console.log(`      Amount: ${details.amount} CES`);
          console.log(`      Seller: ${details.seller}`);
          console.log(`      Buyer: ${details.buyer}`);
          
          // Check if escrow can be refunded
          const refundCheck = await smartContractService.canRefundEscrow(tx.smartContractEscrowId);
          console.log(`      Can refund: ${refundCheck.canRefund}`);
          console.log(`      Status text: ${refundCheck.statusText}`);
        } catch (error) {
          console.log(`      ❌ Error checking smart contract status: ${error.message}`);
        }
      }
      
      // If this transaction has a trade ID, check the trade status
      if (tx.tradeId) {
        try {
          const trade = await P2PTrade.findById(tx.tradeId);
          if (trade) {
            console.log(`      Trade status: ${trade.status}`);
          }
        } catch (error) {
          console.log(`      ❌ Error checking trade status: ${error.message}`);
        }
      }
      
      // If this transaction has an order ID, check the order status
      // We'll look for orders that might be related to this escrow
      if (tx.type === 'lock' && !tx.tradeId) {
        try {
          // Look for orders that might be related to this escrow
          const orders = await P2POrder.find({
            userId: user._id,
            createdAt: { $gte: new Date(tx.createdAt.getTime() - 60000) } // Within 1 minute
          }).sort({ createdAt: -1 }).limit(5);
          
          if (orders.length > 0) {
            console.log(`      Related orders:`);
            for (const order of orders) {
              console.log(`         Order ${order._id}: ${order.type} ${order.amount} CES, status: ${order.status}`);
              console.log(`         Escrow locked: ${order.escrowLocked}, Escrow amount: ${order.escrowAmount}`);
            }
          }
        } catch (error) {
          console.log(`      ❌ Error checking related orders: ${error.message}`);
        }
      }
    }
    
    // Check user's current balances
    console.log(`\n💰 User current balances:`);
    console.log(`   Available CES: ${user.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   Available POL: ${user.polBalance || 0}`);
    console.log(`   Escrowed POL: ${user.escrowPOLBalance || 0}`);
    
    return { success: true };
    
  } catch (error) {
    console.error(`❌ Error diagnosing escrow order status: ${error.message}`);
    console.error(error.stack);
    return { success: false, reason: error.message };
  }
}

// Main function
async function main() {
  console.log('🔍 Escrow and Order Status Diagnosis Script');
  console.log('========================================');
  
  try {
    // Connect to database first
    await connectDatabase();
    
    // Diagnose the user's escrow and order status
    const result = await diagnoseEscrowOrderStatus('942851377');
    
    if (result.success) {
      console.log('\n✅ Diagnosis completed successfully');
    } else {
      console.log(`\n❌ Diagnosis failed: ${result.reason}`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
  
  console.log('\n🏁 Script execution completed');
}

// Run the script if executed directly
if (require.main === module) {
  main().then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Script failed with error:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseEscrowOrderStatus };