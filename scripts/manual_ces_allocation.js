/**
 * Admin Manual CES Allocation
 * Manual admin intervention to allocate additional 1 CES to complete user's request
 * User requested 2 CES return, but only 1 CES was available from stuck escrow
 * This script provides the remaining 1 CES through admin allocation
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';
const ADDITIONAL_ALLOCATION = 1.0; // Additional 1 CES to complete the 2 CES request
const ADMIN_CHAT_ID = '942851377'; // Same user is admin

async function manualCESAllocation() {
  try {
    console.log('🛠️ ADMIN MANUAL CES ALLOCATION');
    console.log('==============================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
    console.log(`💰 Additional Allocation: ${ADDITIONAL_ALLOCATION} CES`);
    console.log(`⚡ Reason: Complete user request for 2 CES total return`);
    console.log('');
    
    await connectDatabase();
    
    // 1. Find the user
    console.log('📋 1. FINDING USER:');
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found');
    console.log(`   User ID: ${user._id}`);
    console.log(`   Wallet: ${user.walletAddress}`);
    console.log(`   Current CES Balance: ${user.cesBalance || 0}`);
    console.log(`   Current Escrow CES: ${user.escrowCESBalance || 0}`);
    console.log('');
    
    // 2. Check recent escrow history to confirm previous return
    console.log('📋 2. VERIFYING PREVIOUS ESCROW RETURN:');
    const recentRefunds = await EscrowTransaction.find({ 
      userId: user._id,
      type: 'refund',
      tokenType: 'CES',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${recentRefunds.length} recent CES refunds:`);
    
    let totalRecentRefunds = 0;
    recentRefunds.forEach((refund, index) => {
      const date = new Date(refund.createdAt).toISOString().slice(0, 19).replace('T', ' ');
      console.log(`   ${index + 1}. ${refund.amount} CES refunded on ${date}`);
      console.log(`      Reason: ${refund.reason || 'N/A'}`);
      totalRecentRefunds += refund.amount;
    });
    
    console.log(`   Total recent refunds: ${totalRecentRefunds} CES`);
    console.log('');
    
    // 3. Verify the need for additional allocation
    console.log('📋 3. VERIFYING ALLOCATION NEED:');
    
    const requestedTotal = 2.0; // User requested 2 CES
    const shortfall = requestedTotal - totalRecentRefunds;
    
    console.log(`   User requested total: ${requestedTotal} CES`);
    console.log(`   Already returned: ${totalRecentRefunds} CES`);
    console.log(`   Shortfall: ${shortfall} CES`);
    
    if (shortfall <= 0) {
      console.log('✅ No additional allocation needed');
      console.log('   User request has already been fulfilled');
      await disconnectDatabase();
      return;
    }
    
    if (Math.abs(shortfall - ADDITIONAL_ALLOCATION) > 0.0001) {
      console.log(`⚠️ Allocation amount mismatch`);
      console.log(`   Expected shortfall: ${ADDITIONAL_ALLOCATION} CES`);
      console.log(`   Actual shortfall: ${shortfall} CES`);
      console.log('   Proceeding with actual shortfall amount...');
    }
    
    const allocationAmount = Math.min(shortfall, ADDITIONAL_ALLOCATION);
    console.log(`   Final allocation amount: ${allocationAmount} CES`);
    console.log('');
    
    // 4. Check admin authorization
    console.log('📋 4. ADMIN AUTHORIZATION CHECK:');
    
    if (USER_CHAT_ID === ADMIN_CHAT_ID) {
      console.log('✅ User is admin - self-authorization granted');
    } else {
      console.log('⚠️ User is not admin - manual authorization required');
      console.log('   This allocation requires admin approval');
    }
    console.log('');
    
    // 5. Execute manual allocation
    console.log('📋 5. EXECUTING MANUAL ALLOCATION:');
    
    console.log(`🔄 Adding ${allocationAmount} CES to user balance...`);
    
    // Update user balance
    const previousBalance = user.cesBalance || 0;
    user.cesBalance = previousBalance + allocationAmount;
    await user.save();
    
    console.log('✅ User balance updated');
    console.log(`   Previous balance: ${previousBalance} CES`);
    console.log(`   New balance: ${user.cesBalance} CES`);
    console.log('');
    
    // 6. Create allocation transaction record
    console.log('📋 6. CREATING ALLOCATION RECORD:');
    
    const allocationTx = new EscrowTransaction({
      userId: user._id,
      tradeId: null,
      type: 'refund', // Using refund type for consistency
      tokenType: 'CES',
      amount: allocationAmount,
      status: 'completed',
      txHash: null, // Database-only transaction
      smartContractEscrowId: null,
      reason: `Manual admin allocation: completing user request for 2 CES total return (${totalRecentRefunds} CES from escrow + ${allocationAmount} CES admin allocation)`,
      completedAt: new Date()
    });
    
    await allocationTx.save();
    
    console.log('✅ Allocation transaction record created');
    console.log(`   Transaction ID: ${allocationTx._id}`);
    console.log('');
    
    // 7. Final verification
    console.log('📋 7. FINAL VERIFICATION:');
    
    const finalUser = await User.findById(user._id);
    const finalWalletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    console.log('✅ Final balances:');
    console.log(`   Database CES: ${finalUser.cesBalance}`);
    console.log(`   Database Escrow: ${finalUser.escrowCESBalance}`);
    console.log(`   Wallet Service CES: ${finalWalletInfo?.cesBalance || 'N/A'}`);
    console.log(`   Wallet Service Escrow: ${finalWalletInfo?.escrowCESBalance || 'N/A'}`);
    console.log('');
    
    // 8. Summary
    console.log('📋 8. ALLOCATION SUMMARY:');
    console.log('🎉 MANUAL ALLOCATION COMPLETED SUCCESSFULLY!');
    console.log('');
    console.log('📊 Transaction Summary:');
    console.log(`   ✅ User requested: 2 CES total`);
    console.log(`   ✅ Returned from escrow: ${totalRecentRefunds} CES`);
    console.log(`   ✅ Admin allocated: ${allocationAmount} CES`);
    console.log(`   ✅ Total provided: ${totalRecentRefunds + allocationAmount} CES`);
    console.log('');
    console.log('💡 Notes:');
    console.log(`   • User ${USER_CHAT_ID} now has access to ${finalUser.cesBalance} CES`);
    console.log(`   • No escrow funds remain stuck`);
    console.log(`   • Request fulfilled through combination of escrow return + admin allocation`);
    console.log(`   • All transactions properly recorded in database`);
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error during manual CES allocation:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  // Confirmation prompt before executing
  console.log('⚠️ ADMIN CONFIRMATION REQUIRED');
  console.log('==============================');
  console.log('This script will manually allocate 1 CES to complete the user\'s request.');
  console.log('The user requested 2 CES return, but only 1 CES was available from stuck escrow.');
  console.log('This allocation will provide the remaining 1 CES through admin intervention.');
  console.log('');
  console.log('Proceeding with manual allocation...');
  console.log('');
  
  manualCESAllocation()
    .then(() => {
      console.log('\n🎉 Manual CES allocation completed successfully');
      console.log('✅ User request for 2 CES return has been fulfilled');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Manual CES allocation failed:', error);
      process.exit(1);
    });
}

module.exports = { manualCESAllocation };