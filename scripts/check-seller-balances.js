/**
 * Script to check seller's current balances
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const SELLER_CHAT_ID = '942851377'; // Алексей chat ID from the logs

async function checkSellerBalances() {
  try {
    console.log('🔍 CHECKING SELLER BALANCES');
    console.log('==========================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Find the seller user
    console.log(`\n🔍 Looking for seller user with chatId ${SELLER_CHAT_ID}...`);
    const seller = await User.findOne({ chatId: SELLER_CHAT_ID });
    
    if (!seller) {
      console.log('❌ Seller user not found');
      return;
    }
    
    console.log(`\n👤 SELLER DETAILS:`);
    console.log(`   - Name: ${seller.firstName} (${seller.chatId})`);
    console.log(`   - Wallet: ${seller.walletAddress}`);
    
    // Check database balances
    console.log(`\n💰 DATABASE BALANCES:`);
    console.log(`   - CES Balance: ${seller.cesBalance || 0} CES`);
    console.log(`   - Escrow CES Balance: ${seller.escrowCESBalance || 0} CES`);
    console.log(`   - Total DB Balance: ${(seller.cesBalance || 0) + (seller.escrowCESBalance || 0)} CES`);
    
    // Check real blockchain balance
    if (seller.walletAddress) {
      console.log(`\n🔗 BLOCKCHAIN BALANCE:`);
      try {
        const realBalance = await walletService.getCESBalance(seller.walletAddress);
        console.log(`   - Real CES Balance: ${realBalance.toFixed(4)} CES`);
      } catch (error) {
        console.log(`   - Error checking real balance: ${error.message}`);
      }
    }
    
    // Check for any active escrow transactions
    console.log(`\n📋 ESCROW TRANSACTIONS:`);
    const { EscrowTransaction } = require('../src/database/models');
    const escrowTxs = await EscrowTransaction.find({
      userId: seller._id,
      tokenType: 'CES'
    }).sort({ createdAt: -1 }).limit(10);
    
    if (escrowTxs.length === 0) {
      console.log(`   - No escrow transactions found`);
    } else {
      escrowTxs.forEach((tx, index) => {
        const date = tx.createdAt.toLocaleString('ru-RU');
        console.log(`   ${index + 1}. ${date} | ${tx.type.toUpperCase()}: ${tx.amount} CES (${tx.status})`);
        if (tx.reason) {
          console.log(`      Reason: ${tx.reason}`);
        }
        if (tx.smartContractEscrowId) {
          console.log(`      Smart Contract Escrow ID: ${tx.smartContractEscrowId}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking seller balances:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  checkSellerBalances().catch(console.error);
}

module.exports = { checkSellerBalances };