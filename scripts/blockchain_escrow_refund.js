/**
 * Blockchain Escrow Refund Script
 * Properly refund 2 CES tokens from smart contract escrows 9 and 10
 * This script executes actual blockchain transactions to return the tokens
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';
const ESCROW_IDS = [9, 10]; // Both escrows contain 1 CES each

async function executeBlockchainEscrowRefund() {
  try {
    console.log('🔧 BLOCKCHAIN ESCROW REFUND EXECUTION');
    console.log('=====================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
    console.log(`🔒 Escrows to refund: ${ESCROW_IDS.join(', ')}`);
    console.log('🎯 Objective: Execute blockchain transactions to return 2 CES tokens');
    console.log('');
    
    await connectDatabase();
    
    // 1. Find and verify user
    console.log('📋 1. USER VERIFICATION:');
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
    
    // 2. Get user's private key
    console.log('📋 2. GETTING USER PRIVATE KEY:');
    try {
      const userPrivateKey = await walletService.getUserPrivateKey(USER_CHAT_ID);
      if (!userPrivateKey) {
        console.log('❌ Failed to get user private key');
        return;
      }
      console.log('✅ User private key retrieved successfully');
      console.log('');
    } catch (error) {
      console.log('❌ Error getting private key:', error.message);
      return;
    }
    
    // 3. Verify each escrow before refunding
    console.log('📋 3. PRE-REFUND VERIFICATION:');
    
    const validEscrows = [];
    let totalExpectedCES = 0;
    
    for (const escrowId of ESCROW_IDS) {
      console.log(`🔍 Verifying Escrow ID ${escrowId}:`);
      
      try {
        const escrowStatus = await smartContractService.canRefundEscrow(escrowId);
        
        if (escrowStatus.error) {
          console.log(`   ❌ Error: ${escrowStatus.error}`);
          continue;
        }
        
        if (!escrowStatus.canRefund) {
          console.log(`   ❌ Cannot refund: ${escrowStatus.statusText}`);
          continue;
        }
        
        const details = escrowStatus.details;
        console.log(`   ✅ Can refund: ${details.amount} CES`);
        console.log(`   📊 Status: ${escrowStatus.statusText}`);
        console.log(`   👤 Seller: ${details.seller}`);
        console.log(`   👤 Buyer: ${details.buyer}`);
        
        // Verify seller matches our user
        if (details.seller.toLowerCase() !== TARGET_WALLET.toLowerCase()) {
          console.log(`   ❌ Seller mismatch: Expected ${TARGET_WALLET}, Got ${details.seller}`);
          continue;
        }
        
        validEscrows.push({
          escrowId: escrowId,
          amount: parseFloat(details.amount),
          details: details
        });
        
        totalExpectedCES += parseFloat(details.amount);
        
      } catch (error) {
        console.log(`   ❌ Error verifying escrow ${escrowId}: ${error.message}`);
      }
      
      console.log('');
    }
    
    if (validEscrows.length === 0) {
      console.log('❌ No valid escrows found to refund');
      await disconnectDatabase();
      return;
    }
    
    console.log(`✅ Found ${validEscrows.length} valid escrows containing ${totalExpectedCES} CES total`);
    console.log('');
    
    // 4. Execute blockchain refunds
    console.log('📋 4. EXECUTING BLOCKCHAIN REFUNDS:');
    
    const userPrivateKey = await walletService.getUserPrivateKey(USER_CHAT_ID);
    const refundResults = [];
    let totalRefundedCES = 0;
    
    for (const escrow of validEscrows) {
      console.log(`🔄 Refunding Escrow ID ${escrow.escrowId} (${escrow.amount} CES):`);
      
      try {
        const refundResult = await smartContractService.refundSmartEscrow(
          escrow.escrowId,
          userPrivateKey
        );
        
        if (refundResult.success) {
          console.log(`   ✅ Blockchain refund successful!`);
          console.log(`   📋 Transaction Hash: ${refundResult.txHash}`);
          console.log(`   ⛽ Gas Used: ${refundResult.gasUsed}`);
          
          refundResults.push({
            escrowId: escrow.escrowId,
            amount: escrow.amount,
            txHash: refundResult.txHash,
            gasUsed: refundResult.gasUsed,
            success: true
          });
          
          totalRefundedCES += escrow.amount;
          
        } else {
          console.log(`   ❌ Blockchain refund failed`);
          refundResults.push({
            escrowId: escrow.escrowId,
            amount: escrow.amount,
            success: false,
            error: 'Blockchain refund failed'
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Error refunding escrow ${escrow.escrowId}: ${error.message}`);
        refundResults.push({
          escrowId: escrow.escrowId,
          amount: escrow.amount,
          success: false,
          error: error.message
        });
      }
      
      console.log('');
    }
    
    // 5. Update database records
    console.log('📋 5. UPDATING DATABASE RECORDS:');
    
    const successfulRefunds = refundResults.filter(r => r.success);
    
    if (successfulRefunds.length > 0) {
      // Update user balance
      const previousBalance = user.cesBalance || 0;
      user.cesBalance = previousBalance + totalRefundedCES;
      await user.save();
      
      console.log(`✅ Updated user CES balance:`);
      console.log(`   Previous: ${previousBalance} CES`);
      console.log(`   Added: ${totalRefundedCES} CES`);
      console.log(`   New: ${user.cesBalance} CES`);
      console.log('');
      
      // Create database transaction records
      for (const refund of successfulRefunds) {
        const escrowTx = new EscrowTransaction({
          userId: user._id,
          tradeId: null,
          type: 'refund',
          tokenType: 'CES',
          amount: refund.amount,
          status: 'completed',
          txHash: refund.txHash,
          smartContractEscrowId: refund.escrowId.toString(),
          reason: `Blockchain refund: CES tokens returned from smart contract escrow ${refund.escrowId}`,
          completedAt: new Date()
        });
        
        await escrowTx.save();
        
        console.log(`✅ Created database record for escrow ${refund.escrowId}: ${refund.amount} CES`);
      }
      
    } else {
      console.log('❌ No successful refunds to record in database');
    }
    
    console.log('');
    
    // 6. Final verification and summary
    console.log('📋 6. FINAL VERIFICATION AND SUMMARY:');
    console.log('=====================================');
    
    const finalUser = await User.findById(user._id);
    
    console.log('📊 Final Results:');
    console.log(`   User CES Balance: ${finalUser.cesBalance} CES`);
    console.log(`   Total Refunded: ${totalRefundedCES} CES`);
    console.log(`   Successful Refunds: ${successfulRefunds.length}/${validEscrows.length}`);
    console.log('');
    
    console.log('📋 Refund Summary:');
    refundResults.forEach((result, index) => {
      console.log(`   ${index + 1}. Escrow ID ${result.escrowId}: ${result.amount} CES`);
      if (result.success) {
        console.log(`      ✅ SUCCESS - TX: ${result.txHash}`);
      } else {
        console.log(`      ❌ FAILED - ${result.error}`);
      }
    });
    
    console.log('');
    
    // Check if user's request is now fulfilled
    if (totalRefundedCES >= 2.0) {
      console.log('🎉 SUCCESS: User request fully satisfied!');
      console.log(`✅ Requested: 2 CES`);
      console.log(`✅ Delivered: ${totalRefundedCES} CES`);
      console.log('✅ All tokens returned via blockchain transactions');
      console.log('✅ User can now access their CES tokens');
    } else {
      console.log('⚠️ Partial success:');
      console.log(`   Requested: 2 CES`);
      console.log(`   Delivered: ${totalRefundedCES} CES`);
      console.log(`   Remaining: ${2.0 - totalRefundedCES} CES`);
      
      if (successfulRefunds.length < validEscrows.length) {
        console.log('   Some refunds failed - manual intervention may be needed');
      }
    }
    
    // 7. Post-refund escrow verification
    console.log('');
    console.log('📋 7. POST-REFUND ESCROW VERIFICATION:');
    console.log('======================================');
    
    for (const escrowId of ESCROW_IDS) {
      try {
        const escrowStatus = await smartContractService.canRefundEscrow(escrowId);
        if (escrowStatus.details) {
          console.log(`🔍 Escrow ID ${escrowId}: Status ${escrowStatus.statusText} (${escrowStatus.details.status})`);
          if (escrowStatus.details.status === 2) {
            console.log(`   ✅ Confirmed refunded in smart contract`);
          } else if (escrowStatus.details.status === 0) {
            console.log(`   ⚠️ Still active - refund may have failed`);
          }
        }
      } catch (error) {
        console.log(`🔍 Escrow ID ${escrowId}: Error checking status - ${error.message}`);
      }
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error executing blockchain escrow refund:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  executeBlockchainEscrowRefund()
    .then(() => {
      console.log('\n🎉 Blockchain escrow refund execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Blockchain escrow refund failed:', error);
      process.exit(1);
    });
}

module.exports = { executeBlockchainEscrowRefund };