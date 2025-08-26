/**
 * Investigate User Smart Contract Escrows
 * Find all smart contract escrow IDs that contain CES tokens for user 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 * This script will help identify which escrows need to be refunded at the blockchain level
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';

async function investigateUserSmartEscrows() {
  try {
    console.log('🔍 INVESTIGATING USER SMART CONTRACT ESCROWS');
    console.log('============================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
    console.log('🎯 Objective: Find CES tokens stuck in smart contract escrows');
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
    
    // 2. Find all escrow transactions with smart contract IDs
    console.log('📋 2. FINDING ALL SMART CONTRACT ESCROW TRANSACTIONS:');
    const smartContractEscrows = await EscrowTransaction.find({
      userId: user._id,
      type: 'lock',
      tokenType: 'CES',
      status: 'completed',
      smartContractEscrowId: { $exists: true, $ne: null }
    }).sort({ createdAt: 1 });
    
    console.log(`Found ${smartContractEscrows.length} smart contract escrow lock transactions:`);
    console.log('');
    
    if (smartContractEscrows.length === 0) {
      console.log('❌ No smart contract escrows found for this user');
      await disconnectDatabase();
      return;
    }
    
    // 3. Check each smart contract escrow status
    console.log('📋 3. CHECKING SMART CONTRACT ESCROW STATUS:');
    
    const activeEscrows = [];
    let totalLockedCES = 0;
    
    for (const escrowTx of smartContractEscrows) {
      const escrowId = escrowTx.smartContractEscrowId;
      const amount = escrowTx.amount;
      const date = new Date(escrowTx.createdAt).toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`🔍 Checking Smart Contract Escrow ID: ${escrowId}`);
      console.log(`   Amount: ${amount} CES`);
      console.log(`   Created: ${date}`);
      console.log(`   Trade ID: ${escrowTx.tradeId || 'N/A'}`);
      
      try {
        // Check if this escrow was already refunded in database
        const refundTx = await EscrowTransaction.findOne({
          userId: user._id,
          type: 'refund',
          smartContractEscrowId: escrowId,
          status: 'completed'
        });
        
        if (refundTx) {
          console.log(`   📄 Database shows this escrow was refunded on ${new Date(refundTx.createdAt).toISOString().slice(0, 19).replace('T', ' ')}`);
        } else {
          console.log(`   📄 No database refund record found`);
        }
        
        // Check actual smart contract status
        const escrowStatus = await smartContractService.canRefundEscrow(escrowId);
        
        if (escrowStatus.error) {
          console.log(`   ❌ Error checking escrow: ${escrowStatus.error}`);
        } else {
          console.log(`   🔒 Smart Contract Status: ${escrowStatus.statusText}`);
          console.log(`   🔄 Can Refund: ${escrowStatus.canRefund ? 'YES' : 'NO'}`);
          
          if (escrowStatus.details) {
            console.log(`   📊 Details:`);
            console.log(`      Seller: ${escrowStatus.details.seller}`);
            console.log(`      Buyer: ${escrowStatus.details.buyer}`);
            console.log(`      Amount: ${escrowStatus.details.amount} CES`);
            console.log(`      Status Code: ${escrowStatus.details.status}`);
            
            // Verify amount matches
            const contractAmount = parseFloat(escrowStatus.details.amount);
            const dbAmount = amount;
            
            if (Math.abs(contractAmount - dbAmount) > 0.0001) {
              console.log(`      ⚠️ AMOUNT MISMATCH: Contract=${contractAmount}, DB=${dbAmount}`);
            } else {
              console.log(`      ✅ Amount matches database record`);
            }
            
            // Check if seller is our user
            if (escrowStatus.details.seller.toLowerCase() === TARGET_WALLET.toLowerCase()) {
              console.log(`      ✅ Seller matches user wallet`);
            } else {
              console.log(`      ⚠️ Seller mismatch: Expected=${TARGET_WALLET}, Actual=${escrowStatus.details.seller}`);
            }
          }
          
          // If status is 0 (Active), this escrow still contains tokens
          if (escrowStatus.details && escrowStatus.details.status === 0) {
            console.log(`   🚨 TOKENS STILL LOCKED IN SMART CONTRACT!`);
            activeEscrows.push({
              escrowId: escrowId,
              amount: amount,
              contractAmount: parseFloat(escrowStatus.details.amount),
              createdAt: escrowTx.createdAt,
              tradeId: escrowTx.tradeId,
              details: escrowStatus.details,
              canRefund: escrowStatus.canRefund
            });
            totalLockedCES += parseFloat(escrowStatus.details.amount);
          } else if (escrowStatus.details && escrowStatus.details.status === 2) {
            console.log(`   ✅ Already refunded in smart contract`);
          } else if (escrowStatus.details && escrowStatus.details.status === 1) {
            console.log(`   ✅ Already released to buyer`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Error checking escrow ${escrowId}: ${error.message}`);
      }
      
      console.log('');
    }
    
    // 4. Summary of findings
    console.log('📋 4. INVESTIGATION SUMMARY:');
    console.log('============================');
    
    if (activeEscrows.length === 0) {
      console.log('✅ No active smart contract escrows found');
      console.log('   All escrows have been properly refunded or released');
    } else {
      console.log(`🚨 FOUND ${activeEscrows.length} ACTIVE SMART CONTRACT ESCROWS:`);
      console.log(`💰 Total CES locked: ${totalLockedCES} CES`);
      console.log('');
      
      activeEscrows.forEach((escrow, index) => {
        console.log(`${index + 1}. Smart Contract Escrow ID: ${escrow.escrowId}`);
        console.log(`   Amount: ${escrow.contractAmount} CES`);
        console.log(`   Created: ${new Date(escrow.createdAt).toISOString().slice(0, 19).replace('T', ' ')}`);
        console.log(`   Trade ID: ${escrow.tradeId || 'N/A'}`);
        console.log(`   Can Refund: ${escrow.canRefund ? 'YES' : 'NO'}`);
        console.log(`   Seller: ${escrow.details.seller}`);
        console.log(`   Buyer: ${escrow.details.buyer}`);
        console.log('');
      });
    }
    
    // 5. Action plan
    console.log('📋 5. RECOMMENDED ACTION PLAN:');
    console.log('==============================');
    
    if (activeEscrows.length > 0) {
      console.log('🔧 BLOCKCHAIN REFUND REQUIRED:');
      console.log('');
      console.log('The following smart contract escrows need to be refunded:');
      
      activeEscrows.forEach((escrow, index) => {
        console.log(`${index + 1}. Escrow ID ${escrow.escrowId}: ${escrow.contractAmount} CES`);
      });
      
      console.log('');
      console.log('📝 Next steps:');
      console.log('1. Use smartContractService.refundSmartEscrow() for each active escrow');
      console.log('2. Execute with user\'s private key');
      console.log('3. Update database escrow transactions');
      console.log('4. Verify user balance is correctly updated');
      console.log('');
      console.log('⚠️ IMPORTANT: These are actual blockchain transactions required');
      console.log('   Database-only fixes will not return the tokens to the user');
      
    } else {
      console.log('✅ No blockchain action required');
      console.log('   All smart contract escrows have been properly handled');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error investigating smart contract escrows:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  investigateUserSmartEscrows()
    .then(() => {
      console.log('\n🎉 Investigation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateUserSmartEscrows };