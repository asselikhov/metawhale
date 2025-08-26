/**
 * Test script to simulate buyer clicking "Платёж выполнен"
 * This script tests the fix for the payment confirmation issue
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { P2PTrade, User } = require('../src/database/models');
const P2PService = require('../src/services/p2pService');

const BUYER_CHAT_ID = '2131340103'; // Liveliness chat ID from the logs

async function testBuyerPaymentCompleted() {
  try {
    console.log('🧪 TESTING BUYER PAYMENT COMPLETED FLOW');
    console.log('=====================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Find the buyer user
    console.log(`\n🔍 Looking for buyer user with chatId ${BUYER_CHAT_ID}...`);
    const buyer = await User.findOne({ chatId: BUYER_CHAT_ID });
    
    if (!buyer) {
      console.log('❌ Buyer user not found');
      return;
    }
    
    console.log(`✅ Found buyer: ${buyer.firstName} (${buyer.chatId})`);
    
    // Find active trade for the buyer
    console.log(`\n🔍 Looking for active trade for buyer ${buyer._id}...`);
    const trade = await P2PTrade.findOne({
      buyerId: buyer._id,
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made'] }
    }).populate('buyerId').populate('sellerId');
    
    if (!trade) {
      console.log('❌ No active trade found for buyer');
      return;
    }
    
    console.log(`\n📋 FOUND TRADE:`);
    console.log(`   - Trade ID: ${trade._id}`);
    console.log(`   - Status: ${trade.status}`);
    console.log(`   - Amount: ${trade.amount} CES`);
    console.log(`   - Value: ₽${trade.totalValue}`);
    console.log(`   - Buyer: ${trade.buyerId.firstName} (${trade.buyerId.chatId})`);
    console.log(`   - Seller: ${trade.sellerId.firstName} (${trade.sellerId.chatId})`);
    
    // Test the markPaymentMade method
    console.log(`\n🔄 Testing markPaymentMade method...`);
    const result = await P2PService.markPaymentMade(trade._id.toString(), BUYER_CHAT_ID);
    
    if (result.success) {
      console.log('✅ SUCCESS: Payment marked as made by buyer');
      
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
  testBuyerPaymentCompleted().catch(console.error);
}

module.exports = { testBuyerPaymentCompleted };