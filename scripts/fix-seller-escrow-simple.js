/**
 * Simple script to fix seller's escrow balance discrepancy
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../src/database/models');

const SELLER_CHAT_ID = '942851377'; // Алексей chat ID from the logs

async function fixSellerEscrowBalance() {
  try {
    console.log('🔧 FIXING SELLER ESCROW BALANCE (SIMPLE VERSION)');
    console.log('==============================================');
    
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
    console.log(`\n💰 CURRENT DATABASE BALANCES:`);
    console.log(`   - CES Balance: ${seller.cesBalance || 0} CES`);
    console.log(`   - Escrow CES Balance: ${seller.escrowCESBalance || 0} CES`);
    console.log(`   - Total DB Balance: ${(seller.cesBalance || 0) + (seller.escrowCESBalance || 0)} CES`);
    
    // Based on our previous checks:
    // - Real blockchain balance: 0.9 CES
    // - Database escrow balance: 1.1 CES
    // - This is impossible, so we need to adjust
    
    // Set the escrow balance to the real amount we have
    // Since we have 0.9 CES in wallet and 1.1 CES "locked" in escrow,
    // we should adjust the escrow balance to 0.9 CES and available to 0 CES
    
    const realBalance = 0.9;
    const correctedEscrowBalance = 0.9; // Match the real balance
    const correctedAvailableBalance = 0.0; // Nothing available since all is in escrow
    
    console.log(`\n🧮 CORRECTED BALANCES:`);
    console.log(`   - Real Balance: ${realBalance.toFixed(4)} CES`);
    console.log(`   - Corrected Escrow Balance: ${correctedEscrowBalance.toFixed(4)} CES`);
    console.log(`   - Corrected Available Balance: ${correctedAvailableBalance.toFixed(4)} CES`);
    
    // Update the seller's balances
    seller.cesBalance = correctedAvailableBalance;
    seller.escrowCESBalance = correctedEscrowBalance;
    seller.lastBalanceUpdate = new Date();
    
    await seller.save();
    
    console.log(`\n✅ BALANCES UPDATED SUCCESSFULLY!`);
    console.log(`   - New CES Balance: ${seller.cesBalance.toFixed(4)} CES`);
    console.log(`   - New Escrow CES Balance: ${seller.escrowCESBalance.toFixed(4)} CES`);
    console.log(`   - Total Balance: ${(seller.cesBalance + seller.escrowCESBalance).toFixed(4)} CES`);
    
  } catch (error) {
    console.error('❌ Error fixing seller escrow balances:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  fixSellerEscrowBalance().catch(console.error);
}

module.exports = { fixSellerEscrowBalance };