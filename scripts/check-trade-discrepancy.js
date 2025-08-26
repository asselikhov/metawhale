/**
 * Script to check trade details and discrepancy
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { P2PTrade, User } = require('../src/database/models');

const SELLER_CHAT_ID = '942851377'; // Алексей chat ID from the logs

async function checkTradeDiscrepancy() {
  try {
    console.log('🔍 CHECKING TRADE DISCREPANCY');
    console.log('===========================');
    
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
    
    // Find the active trade
    console.log(`\n🔍 Looking for trade with payment_made status...`);
    const trade = await P2PTrade.findOne({
      sellerId: seller._id,
      status: 'payment_made'
    }).populate('buyerId').populate('sellerId');
    
    if (!trade) {
      console.log('❌ No trade with payment_made status found');
      return;
    }
    
    console.log(`\n📋 TRADE DETAILS:`);
    console.log(`   - Trade ID: ${trade._id}`);
    console.log(`   - Status: ${trade.status}`);
    console.log(`   - Amount: ${trade.amount} CES`);
    console.log(`   - Price per token: ${trade.pricePerToken} ₽/CES`);
    console.log(`   - Total value: ₽${trade.totalValue}`);
    console.log(`   - Buyer: ${trade.buyerId.firstName} (${trade.buyerId.chatId})`);
    console.log(`   - Seller: ${trade.sellerId.firstName} (${trade.sellerId.chatId})`);
    
    // Check seller's current escrow balance
    console.log(`\n💰 SELLER CURRENT ESCROW BALANCE:`);
    console.log(`   - Database escrow balance: ${seller.escrowCESBalance || 0} CES`);
    
    // The discrepancy:
    // - Trade amount: 1.1 CES
    // - Seller escrow balance: 0.9 CES
    // - Missing: 0.2 CES
    
    console.log(`\n❌ DISCREPANCY:`);
    console.log(`   - Trade amount: ${trade.amount} CES`);
    console.log(`   - Seller escrow balance: ${seller.escrowCESBalance || 0} CES`);
    console.log(`   - Missing amount: ${(trade.amount - (seller.escrowCESBalance || 0)).toFixed(4)} CES`);
    
    // Check if there are any other active trades that might be using escrow
    console.log(`\n🔍 CHECKING OTHER ACTIVE TRADES:`);
    const otherTrades = await P2PTrade.find({
      sellerId: seller._id,
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made'] },
      _id: { $ne: trade._id }
    }).populate('buyerId');
    
    if (otherTrades.length === 0) {
      console.log(`   - No other active trades found`);
    } else {
      otherTrades.forEach((otherTrade, index) => {
        console.log(`   ${index + 1}. Trade ${otherTrade._id}: ${otherTrade.amount} CES (${otherTrade.status})`);
        console.log(`      Buyer: ${otherTrade.buyerId.firstName} (${otherTrade.buyerId.chatId})`);
      });
    }
    
    // Check escrow transactions for this specific trade
    console.log(`\n📋 ESCROW TRANSACTIONS FOR THIS TRADE:`);
    const { EscrowTransaction } = require('../src/database/models');
    const escrowTxs = await EscrowTransaction.find({
      userId: seller._id,
      tradeId: trade._id
    }).sort({ createdAt: 1 });
    
    if (escrowTxs.length === 0) {
      console.log(`   - No escrow transactions found for this trade`);
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
    
    // Solution approach:
    // Since we're missing 0.2 CES, we need to adjust the trade amount
    // to match what we actually have in escrow (0.9 CES)
    console.log(`\n💡 SOLUTION:`);
    console.log(`   We need to adjust the trade amount from ${trade.amount} CES to ${seller.escrowCESBalance || 0} CES`);
    console.log(`   This will allow the escrow release to proceed with the available funds.`);
    
  } catch (error) {
    console.error('❌ Error checking trade discrepancy:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  checkTradeDiscrepancy().catch(console.error);
}

module.exports = { checkTradeDiscrepancy };