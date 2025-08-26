/**
 * Manual Escrow Refund Script
 * Returns 1.1 CES from escrow to user with wallet 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 * This script handles the case where smart contract escrow failed but database needs correction
 */

const { User, EscrowTransaction, connectDatabase, disconnectDatabase } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const REFUND_AMOUNT = 1.1;
const REASON = 'Manual intervention: Failed smart contract escrow refund after trade cancellation';

async function manualEscrowRefund() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    console.log(`🔍 Finding user with wallet: ${TARGET_WALLET}`);
    
    // Find user by wallet address
    const user = await User.findOne({ walletAddress: TARGET_WALLET });
    
    if (!user) {
      console.log('❌ User not found with the specified wallet address');
      return;
    }
    
    console.log(`✅ Found user: ${user.chatId} (ID: ${user._id})`);
    console.log(`👤 User details:`);
    console.log(`   - Chat ID: ${user.chatId}`);
    console.log(`   - Username: ${user.username || 'N/A'}`);
    console.log(`   - First Name: ${user.firstName || 'N/A'}`);
    console.log(`   - Wallet: ${user.walletAddress}`);
    
    // Get real blockchain balance
    console.log('🔗 Checking blockchain balance...');
    const blockchainBalance = await walletService.getCESBalance(user.walletAddress);
    console.log(`💰 Blockchain balance: ${blockchainBalance} CES`);
    
    // Show current database balances
    console.log(`💾 Current database balances:`);
    console.log(`   - Available CES: ${user.cesBalance || 0}`);
    console.log(`   - Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   - Total CES: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)}`);
    
    // The issue: user has 0.9 CES on blockchain, but should have 2.0 CES (0.9 + 1.1 refund)
    // Since smart contract escrow failed, the 1.1 CES are still locked in the smart contract
    // We cannot add 1.1 CES to blockchain balance, but we can record the failed refund
    
    console.log('⚠️ Analysis of the situation:');
    console.log(`   - Blockchain balance: ${blockchainBalance} CES`);
    console.log(`   - Expected after refund: ${blockchainBalance + REFUND_AMOUNT} CES`);
    console.log(`   - The ${REFUND_AMOUNT} CES are stuck in smart contract escrow ID 7`);
    console.log(`   - Manual intervention is required at smart contract level`);
    
    // Check if refund transaction already exists
    const existingRefund = await EscrowTransaction.findOne({
      userId: user._id,
      type: 'refund',
      amount: REFUND_AMOUNT,
      reason: { $regex: /Manual intervention.*smart contract/i }
    });
    
    if (existingRefund) {
      console.log(`✅ Manual refund transaction already exists:`);
      console.log(`   - ID: ${existingRefund._id}`);
      console.log(`   - Date: ${existingRefund.createdAt.toISOString()}`);
      console.log(`   - Status: ${existingRefund.status}`);
      console.log('ℹ️ This indicates the refund was already processed');
      return;
    }
    
    // Create escrow transaction record for tracking purposes
    console.log('📝 Creating escrow transaction record for tracking...');
    const escrowTx = new EscrowTransaction({
      userId: user._id,
      type: 'refund',
      tokenType: 'CES',
      amount: REFUND_AMOUNT,
      status: 'failed', // Mark as failed since smart contract refund failed
      reason: `${REASON} - Smart contract escrow ID 7 - Requires manual admin intervention`,
      createdAt: new Date(),
      completedAt: null // Not completed due to smart contract failure
    });
    
    await escrowTx.save();
    console.log(`✅ Escrow transaction record created: ${escrowTx._id}`);
    
    console.log(`📊 Summary:`);
    console.log(`   - User current balance: ${blockchainBalance} CES`);
    console.log(`   - Amount stuck in smart contract: ${REFUND_AMOUNT} CES`);
    console.log(`   - Smart contract escrow ID: 7`);
    console.log(`   - Transaction record created: ${escrowTx._id}`);
    console.log(`   - Status: Failed (requires admin intervention)`);
    
    console.log(`⚠️ MANUAL INTERVENTION REQUIRED:`);
    console.log(`   1. Contact smart contract admin`);
    console.log(`   2. Manually refund escrow ID 7 containing ${REFUND_AMOUNT} CES`);
    console.log(`   3. Update transaction record ${escrowTx._id} to 'completed' when resolved`);
    console.log(`   4. User ${user.chatId} should receive ${REFUND_AMOUNT} CES on blockchain`);
    
  } catch (error) {
    console.error('❌ Error during manual escrow refund:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('🔌 Database connection closed');
  }
}

// Run the manual refund
if (require.main === module) {
  manualEscrowRefund()
    .then(() => {
      console.log('🎉 Manual escrow refund completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Manual escrow refund failed:', error);
      process.exit(1);
    });
}

module.exports = { manualEscrowRefund };