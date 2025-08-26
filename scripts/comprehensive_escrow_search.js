/**
 * Comprehensive Smart Contract Escrow Search
 * Check multiple escrow IDs to find ALL CES tokens belonging to user's wallet
 * User reported 2 CES stuck, but we only found 1 CES in escrow ID 10
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function comprehensiveEscrowSearch() {
  try {
    console.log('🔍 COMPREHENSIVE SMART CONTRACT ESCROW SEARCH');
    console.log('==============================================');
    console.log(`💳 Target Wallet: ${TARGET_WALLET}`);
    console.log('🎯 Objective: Find ALL CES tokens in any smart contract escrow for this wallet');
    console.log('');
    
    await connectDatabase();
    
    console.log('📋 CHECKING ESCROW IDs 1-20:');
    console.log('============================');
    
    const foundEscrows = [];
    let totalFoundCES = 0;
    
    // Check escrow IDs 1 through 20 (expand range if needed)
    for (let escrowId = 1; escrowId <= 20; escrowId++) {
      try {
        console.log(`🔍 Checking Escrow ID ${escrowId}...`);
        
        const escrowStatus = await smartContractService.canRefundEscrow(escrowId);
        
        if (escrowStatus.error) {
          console.log(`   ❌ Error: ${escrowStatus.error}`);
          continue;
        }
        
        if (!escrowStatus.details) {
          console.log(`   ❌ No details available`);
          continue;
        }
        
        const details = escrowStatus.details;
        console.log(`   📊 Status: ${escrowStatus.statusText} (${details.status})`);
        console.log(`   💰 Amount: ${details.amount} CES`);
        console.log(`   👤 Seller: ${details.seller}`);
        console.log(`   👤 Buyer: ${details.buyer}`);
        
        // Check if seller or buyer matches our target wallet
        const sellerMatch = details.seller.toLowerCase() === TARGET_WALLET.toLowerCase();
        const buyerMatch = details.buyer.toLowerCase() === TARGET_WALLET.toLowerCase();
        
        if (sellerMatch || buyerMatch) {
          console.log(`   🎯 MATCH FOUND! ${sellerMatch ? 'Seller' : 'Buyer'} matches target wallet`);
          
          // Only count active escrows (status 0)
          if (details.status === 0) {
            console.log(`   🚨 ACTIVE ESCROW - CES TOKENS LOCKED!`);
            foundEscrows.push({
              escrowId: escrowId,
              amount: parseFloat(details.amount),
              status: details.status,
              statusText: escrowStatus.statusText,
              seller: details.seller,
              buyer: details.buyer,
              userRole: sellerMatch ? 'seller' : 'buyer',
              canRefund: escrowStatus.canRefund
            });
            totalFoundCES += parseFloat(details.amount);
          } else if (details.status === 1) {
            console.log(`   ✅ Released (tokens already transferred to buyer)`);
          } else if (details.status === 2) {
            console.log(`   ✅ Refunded (tokens already returned to seller)`);
          } else if (details.status === 3) {
            console.log(`   ⚖️ Disputed (manual resolution needed)`);
          }
        } else {
          console.log(`   ➖ No match (different wallet addresses)`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error checking escrow ${escrowId}: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Summary
    console.log('📋 COMPREHENSIVE SEARCH SUMMARY:');
    console.log('=================================');
    
    if (foundEscrows.length === 0) {
      console.log('❌ No active escrows found for target wallet');
      console.log('   This suggests either:');
      console.log('   - The tokens have already been refunded/released');
      console.log('   - The escrows are in higher ID ranges (above 20)');
      console.log('   - There might be a different issue');
    } else {
      console.log(`🚨 FOUND ${foundEscrows.length} ACTIVE ESCROWS for target wallet:`);
      console.log(`💰 Total CES found: ${totalFoundCES} CES`);
      console.log('');
      
      foundEscrows.forEach((escrow, index) => {
        console.log(`${index + 1}. Escrow ID ${escrow.escrowId}:`);
        console.log(`   Amount: ${escrow.amount} CES`);
        console.log(`   User Role: ${escrow.userRole}`);
        console.log(`   Status: ${escrow.statusText}`);
        console.log(`   Can Refund: ${escrow.canRefund ? 'YES' : 'NO'}`);
        console.log(`   Seller: ${escrow.seller}`);
        console.log(`   Buyer: ${escrow.buyer}`);
        console.log('');
      });
      
      // Analysis
      console.log('📊 ANALYSIS:');
      if (totalFoundCES < 2.0) {
        console.log(`⚠️ Found ${totalFoundCES} CES but user reported 2 CES stuck`);
        console.log(`   Missing: ${2.0 - totalFoundCES} CES`);
        console.log('   Recommendations:');
        console.log('   1. Check higher escrow ID ranges (21-50)');
        console.log('   2. Verify if some tokens were already properly returned');
        console.log('   3. Check if user has tokens in multiple transactions');
      } else if (totalFoundCES >= 2.0) {
        console.log(`✅ Found ${totalFoundCES} CES - matches or exceeds user's report`);
      }
    }
    
    // Detailed action plan for refunds
    if (foundEscrows.length > 0) {
      console.log('📋 REFUND ACTION PLAN:');
      console.log('======================');
      
      const refundableEscrows = foundEscrows.filter(e => e.canRefund && e.userRole === 'seller');
      
      if (refundableEscrows.length > 0) {
        console.log('🔧 ESCROWS THAT CAN BE REFUNDED:');
        refundableEscrows.forEach((escrow, index) => {
          console.log(`${index + 1}. Escrow ID ${escrow.escrowId}: ${escrow.amount} CES`);
          console.log(`   Command: smartContractService.refundSmartEscrow(${escrow.escrowId}, userPrivateKey)`);
        });
        
        console.log('');
        console.log('📝 Implementation steps:');
        console.log('1. Get user private key using walletService.getUserPrivateKey()');
        console.log('2. Execute refund for each escrow ID');
        console.log('3. Update database with refund transactions');
        console.log('4. Verify user balance updates');
      }
      
      const buyerEscrows = foundEscrows.filter(e => e.userRole === 'buyer');
      if (buyerEscrows.length > 0) {
        console.log('');
        console.log('⚠️ ESCROWS WHERE USER IS BUYER:');
        buyerEscrows.forEach((escrow, index) => {
          console.log(`${index + 1}. Escrow ID ${escrow.escrowId}: ${escrow.amount} CES`);
          console.log(`   Note: User is buyer - tokens should be released by seller, not refunded`);
        });
      }
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error in comprehensive escrow search:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  comprehensiveEscrowSearch()
    .then(() => {
      console.log('\n🎉 Comprehensive search completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Search failed:', error);
      process.exit(1);
    });
}

module.exports = { comprehensiveEscrowSearch };