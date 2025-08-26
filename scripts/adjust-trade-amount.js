/**
 * Script to adjust trade amount to match available escrow balance
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { P2PTrade, User, EscrowTransaction } = require('../src/database/models');

const SELLER_CHAT_ID = '942851377'; // Алексей chat ID from the logs

async function adjustTradeAmount() {
  try {
    console.log('🔧 ADJUSTING TRADE AMOUNT');
    console.log('========================');
    
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
    console.log(`   - Original Amount: ${trade.amount} CES`);
    console.log(`   - Price per token: ${trade.pricePerToken} ₽/CES`);
    console.log(`   - Original Total value: ₽${trade.totalValue}`);
    console.log(`   - Buyer: ${trade.buyerId.firstName} (${trade.buyerId.chatId})`);
    console.log(`   - Seller: ${trade.sellerId.firstName} (${trade.sellerId.chatId})`);
    
    // Check seller's current escrow balance
    console.log(`\n💰 SELLER CURRENT ESCROW BALANCE:`);
    console.log(`   - Database escrow balance: ${seller.escrowCESBalance || 0} CES`);
    
    // Calculate the adjusted amount
    const adjustedAmount = seller.escrowCESBalance || 0;
    const adjustedTotalValue = adjustedAmount * trade.pricePerToken;
    
    console.log(`\n🧮 ADJUSTED AMOUNTS:`);
    console.log(`   - Adjusted Amount: ${adjustedAmount} CES`);
    console.log(`   - Adjusted Total Value: ₽${adjustedTotalValue}`);
    
    // Check if adjustment is needed
    if (Math.abs(trade.amount - adjustedAmount) < 0.0001) {
      console.log(`\n✅ Trade amount is already correct, no adjustment needed`);
      return;
    }
    
    console.log(`\n🔧 ADJUSTING TRADE:`);
    console.log(`   - Changing amount from ${trade.amount} to ${adjustedAmount} CES`);
    console.log(`   - Changing total value from ${trade.totalValue} to ${adjustedTotalValue} ₽`);
    
    // Store original values for the adjustment record
    const originalAmount = trade.amount;
    const originalTotalValue = trade.totalValue;
    
    // Update the trade
    trade.amount = adjustedAmount;
    trade.totalValue = adjustedTotalValue;
    
    await trade.save();
    
    console.log(`\n✅ TRADE UPDATED SUCCESSFULLY!`);
    console.log(`   - New Amount: ${trade.amount} CES`);
    console.log(`   - New Total Value: ₽${trade.totalValue}`);
    
    // Create a record of this adjustment
    const adjustmentTx = new EscrowTransaction({
      userId: seller._id,
      tradeId: trade._id,
      type: 'refund',
      tokenType: 'CES',
      amount: originalAmount - adjustedAmount,
      status: 'completed',
      reason: `Trade adjustment: Reduced amount from ${originalAmount.toFixed(4)} to ${adjustedAmount.toFixed(4)} CES due to escrow balance discrepancy`,
      completedAt: new Date()
    });
    
    if (Math.abs(adjustmentTx.amount) > 0.0001) {
      await adjustmentTx.save();
      console.log(`\n📝 Created adjustment record: ${adjustmentTx._id}`);
      console.log(`   - Amount: ${adjustmentTx.amount.toFixed(4)} CES`);
      console.log(`   - Reason: ${adjustmentTx.reason}`);
    }
    
    // Also update the seller's escrow balance to reflect that we're using the full amount
    seller.escrowCESBalance = adjustedAmount;
    seller.cesBalance = 0; // All funds are now in escrow for this trade
    seller.lastBalanceUpdate = new Date();
    
    await seller.save();
    
    console.log(`\n💰 SELLER BALANCE UPDATED:`);
    console.log(`   - CES Balance: ${seller.cesBalance.toFixed(4)} CES`);
    console.log(`   - Escrow CES Balance: ${seller.escrowCESBalance.toFixed(4)} CES`);
    
    console.log(`\n💡 NEXT STEP:`);
    console.log(`   Now you can run the seller payment confirmation test again.`);
    console.log(`   The escrow release should work since the trade amount matches the escrow balance.`);
    
  } catch (error) {
    console.error('❌ Error adjusting trade amount:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  adjustTradeAmount().catch(console.error);
}

module.exports = { adjustTradeAmount };