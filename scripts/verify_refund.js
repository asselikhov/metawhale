/**
 * Balance Verification Script
 * Verifies the manual escrow refund was processed correctly
 */

const mongoose = require('mongoose');
const { User, EscrowTransaction, connectDatabase, disconnectDatabase } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function verifyRefund() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    console.log(`🔍 Verifying refund for wallet: ${TARGET_WALLET}`);
    
    // Find user by wallet address
    const user = await User.findOne({ walletAddress: TARGET_WALLET });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ Found user: ${user.chatId} (${user.username || user.firstName})`);
    
    // Get current database balances
    const dbAvailable = user.cesBalance || 0;
    const dbEscrowed = user.escrowCESBalance || 0;
    const dbTotal = dbAvailable + dbEscrowed;
    
    console.log(`💾 Database balances:`);
    console.log(`   - Available CES: ${dbAvailable}`);
    console.log(`   - Escrowed CES: ${dbEscrowed}`);
    console.log(`   - Total CES: ${dbTotal}`);
    
    // Get real blockchain balance
    let difference = 0;
    try {
      const blockchainBalance = await walletService.getCESBalance(user.walletAddress);
      console.log(`🔗 Blockchain balance: ${blockchainBalance} CES`);
      
      // Check if balances match
      difference = Math.abs(blockchainBalance - dbTotal);
      if (difference < 0.0001) {
        console.log('✅ Database and blockchain balances match perfectly!');
      } else {
        console.log(`⚠️ Balance discrepancy: ${difference.toFixed(4)} CES difference`);
        console.log(`   Database total: ${dbTotal} CES`);
        console.log(`   Blockchain: ${blockchainBalance} CES`);
      }
    } catch (error) {
      console.error('❌ Could not fetch blockchain balance:', error.message);
    }
    
    // Find recent escrow transactions for this user
    console.log(`📋 Recent escrow transactions:`);
    const recentTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES'
    }).sort({ createdAt: -1 }).limit(5);
    
    if (recentTxs.length === 0) {
      console.log('   No escrow transactions found');
    } else {
      recentTxs.forEach((tx, index) => {
        const date = tx.createdAt.toISOString().split('T')[0];
        const time = tx.createdAt.toISOString().split('T')[1].split('.')[0];
        console.log(`   ${index + 1}. ${tx.type.toUpperCase()}: ${tx.amount} CES`);
        console.log(`      Date: ${date} ${time}`);
        console.log(`      Status: ${tx.status}`);
        console.log(`      Reason: ${tx.reason || 'N/A'}`);
        console.log(`      ID: ${tx._id}`);
        console.log('      ---');
      });
    }
    
    // Find the manual refund transaction
    const manualRefund = await EscrowTransaction.findOne({
      userId: user._id,
      type: 'refund',
      amount: 1.1,
      reason: { $regex: /Manual intervention/i }
    }).sort({ createdAt: -1 });
    
    if (manualRefund) {
      console.log(`✅ Manual refund transaction found:`);
      console.log(`   - ID: ${manualRefund._id}`);
      console.log(`   - Amount: ${manualRefund.amount} CES`);
      console.log(`   - Status: ${manualRefund.status}`);
      console.log(`   - Date: ${manualRefund.createdAt.toISOString()}`);
      console.log(`   - Reason: ${manualRefund.reason}`);
    } else {
      console.log('❌ Manual refund transaction not found');
    }
    
    console.log(`\n🎯 Verification Summary:`);
    console.log(`   - User found: ✅`);
    console.log(`   - Available balance: ${dbAvailable} CES`);
    console.log(`   - Escrowed balance: ${dbEscrowed} CES`);
    console.log(`   - Manual refund recorded: ${manualRefund ? '✅' : '❌'}`);
    console.log(`   - Balance consistency: ${difference < 0.0001 ? '✅' : '⚠️'}`);
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('🔌 Database connection closed');
  }
}

// Run the verification
if (require.main === module) {
  verifyRefund()
    .then(() => {
      console.log('🎉 Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyRefund };