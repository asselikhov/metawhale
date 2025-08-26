/**
 * Script to fix seller's balance discrepancy
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, EscrowTransaction } = require('../src/database/models');

const SELLER_CHAT_ID = '942851377'; // Алексей chat ID from the logs

async function fixSellerBalance() {
  try {
    console.log('🔧 FIXING SELLER BALANCE DISCREPANCY');
    console.log('====================================');
    
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
    
    // Check current balances
    console.log(`\n💰 CURRENT BALANCES:`);
    console.log(`   - CES Balance: ${seller.cesBalance || 0} CES`);
    console.log(`   - Escrow CES Balance: ${seller.escrowCESBalance || 0} CES`);
    console.log(`   - Total DB Balance: ${(seller.cesBalance || 0) + (seller.escrowCESBalance || 0)} CES`);
    
    // Calculate what the balances should be
    const realBalance = 0.9; // From our previous check
    const expectedEscrowBalance = 1.1; // From the active trade
    const expectedAvailableBalance = Math.max(0, realBalance - expectedEscrowBalance);
    
    console.log(`\n🧮 CALCULATED CORRECT BALANCES:`);
    console.log(`   - Real Blockchain Balance: ${realBalance} CES`);
    console.log(`   - Expected Escrow Balance: ${expectedEscrowBalance} CES`);
    console.log(`   - Expected Available Balance: ${expectedAvailableBalance} CES`);
    
    // Check if adjustment is needed
    const currentEscrow = seller.escrowCESBalance || 0;
    const currentAvailable = seller.cesBalance || 0;
    
    if (Math.abs(currentEscrow - expectedEscrowBalance) < 0.0001 && 
        Math.abs(currentAvailable - expectedAvailableBalance) < 0.0001) {
      console.log(`\n✅ Balances are already correct, no adjustment needed`);
      return;
    }
    
    console.log(`\n🔧 ADJUSTING BALANCES:`);
    console.log(`   - Changing available balance from ${currentAvailable} to ${expectedAvailableBalance}`);
    console.log(`   - Changing escrow balance from ${currentEscrow} to ${expectedEscrowBalance}`);
    
    // Update the seller's balances
    seller.cesBalance = expectedAvailableBalance;
    seller.escrowCESBalance = expectedEscrowBalance;
    seller.lastBalanceUpdate = new Date();
    
    await seller.save();
    
    console.log(`\n✅ BALANCES UPDATED SUCCESSFULLY!`);
    console.log(`   - New CES Balance: ${seller.cesBalance} CES`);
    console.log(`   - New Escrow CES Balance: ${seller.escrowCESBalance} CES`);
    console.log(`   - Total Balance: ${seller.cesBalance + seller.escrowCESBalance} CES`);
    
    // Create a record of this adjustment
    const adjustmentTx = new EscrowTransaction({
      userId: seller._id,
      tradeId: null,
      type: 'refund',
      tokenType: 'CES',
      amount: expectedAvailableBalance - currentAvailable,
      status: 'completed',
      reason: `Balance correction: Adjusted available balance from ${currentAvailable} to ${expectedAvailableBalance} CES`,
      completedAt: new Date()
    });
    
    if (Math.abs(adjustmentTx.amount) > 0.0001) {
      await adjustmentTx.save();
      console.log(`\n📝 Created adjustment record: ${adjustmentTx._id}`);
      console.log(`   - Amount: ${adjustmentTx.amount.toFixed(4)} CES`);
      console.log(`   - Reason: ${adjustmentTx.reason}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing seller balances:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  fixSellerBalance().catch(console.error);
}

module.exports = { fixSellerBalance };