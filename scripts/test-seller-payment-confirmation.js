/**
 * Test script to simulate seller confirming payment receipt
 * This script tests the next step in the P2P flow
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { P2PTrade, User } = require('../src/database/models');
const P2PService = require('../src/services/p2pService');

const SELLER_CHAT_ID = '942851377'; // Алексей chat ID from the logs

async function testSellerPaymentConfirmation() {
  try {
    console.log('🧪 TESTING SELLER PAYMENT CONFIRMATION FLOW');
    console.log('=========================================');
    
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
    
    console.log(`✅ Found seller: ${seller.firstName} (${seller.chatId})`);
    
    // Find active trade for the seller where payment has been made
    console.log(`\n🔍 Looking for trade with payment_made status for seller ${seller._id}...`);
    const trade = await P2PTrade.findOne({
      sellerId: seller._id,
      status: 'payment_made'
    }).populate('buyerId').populate('sellerId');
    
    if (!trade) {
      console.log('❌ No trade with payment_made status found for seller');
      console.log('Looking for any active trade...');
      
      const activeTrade = await P2PTrade.findOne({
        sellerId: seller._id,
        status: { $in: ['escrow_locked', 'payment_pending', 'payment_made'] }
      }).populate('buyerId').populate('sellerId');
      
      if (!activeTrade) {
        console.log('❌ No active trade found for seller');
        return;
      }
      
      console.log(`\n📋 FOUND ACTIVE TRADE:`);
      console.log(`   - Trade ID: ${activeTrade._id}`);
      console.log(`   - Status: ${activeTrade.status}`);
      console.log(`   - Amount: ${activeTrade.amount} CES`);
      console.log(`   - Value: ₽${activeTrade.totalValue}`);
      console.log(`   - Buyer: ${activeTrade.buyerId.firstName} (${activeTrade.buyerId.chatId})`);
      console.log(`   - Seller: ${activeTrade.sellerId.firstName} (${activeTrade.sellerId.chatId})`);
      
      return;
    }
    
    console.log(`\n📋 FOUND TRADE WITH PAYMENT_MADE STATUS:`);
    console.log(`   - Trade ID: ${trade._id}`);
    console.log(`   - Status: ${trade.status}`);
    console.log(`   - Amount: ${trade.amount} CES`);
    console.log(`   - Value: ₽${trade.totalValue}`);
    console.log(`   - Buyer: ${trade.buyerId.firstName} (${trade.buyerId.chatId})`);
    console.log(`   - Seller: ${trade.sellerId.firstName} (${trade.sellerId.chatId})`);
    
    // Test the confirmPaymentReceived method
    console.log(`\n🔄 Testing confirmPaymentReceived method...`);
    const result = await P2PService.confirmPaymentReceived(trade._id.toString(), SELLER_CHAT_ID);
    
    if (result.success) {
      console.log('✅ SUCCESS: Payment confirmed by seller');
      
      // Check updated trade status
      const updatedTrade = await P2PTrade.findById(trade._id);
      console.log(`\n📋 UPDATED TRADE STATUS: ${updatedTrade.status}`);
    } else {
      console.log(`❌ ERROR: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  testSellerPaymentConfirmation().catch(console.error);
}

module.exports = { testSellerPaymentConfirmation };