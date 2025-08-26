/**
 * Manual Token Recovery Script
 * Recovers missing tokens from smart contract escrow for user 942851377
 * This handles the case where tokens were locked in smart contract but not properly refunded
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade, EscrowTransaction } = require('./src/database/models');
const smartContractService = require('./src/services/smartContractService');
const walletService = require('./src/services/walletService');

const TARGET_USER_CHAT_ID = '942851377';
const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function recoverMissingTokens() {
  try {
    console.log('🔄 MANUAL TOKEN RECOVERY');
    console.log('========================');
    console.log(`🎯 Target User: ${TARGET_USER_CHAT_ID}`);
    console.log(`🎯 Target Wallet: ${TARGET_WALLET}`);
    console.log('');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Find user
    const user = await User.findOne({ chatId: TARGET_USER_CHAT_ID });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`\\n📊 Current User Status:`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Wallet: ${user.walletAddress}`);
    console.log(`   Current CES Balance: ${user.cesBalance || 0} CES`);
    console.log(`   Escrowed CES Balance: ${user.escrowCESBalance || 0} CES`);
    
    // Find smart contract escrows that might not have been properly refunded
    console.log(`\\n🔍 Searching for unrefunded smart contract escrows...`);
    
    // Look for recent lock transactions with smart contract IDs
    const lockTxs = await EscrowTransaction.find({
      userId: user._id,
      type: 'lock',
      tokenType: 'CES',
      smartContractEscrowId: { $exists: true, $ne: null },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${lockTxs.length} recent smart contract lock transactions:`);
    
    for (const lockTx of lockTxs) {
      console.log(`\\n📋 Lock Transaction: ${lockTx._id}`);
      console.log(`   Amount: ${lockTx.amount} CES`);
      console.log(`   Smart Contract ID: ${lockTx.smartContractEscrowId}`);
      console.log(`   Trade ID: ${lockTx.tradeId}`);
      console.log(`   Date: ${lockTx.createdAt.toLocaleString('ru-RU')}`);
      
      // Check if there's a corresponding refund
      const refundTx = await EscrowTransaction.findOne({
        userId: user._id,
        tradeId: lockTx.tradeId,
        type: 'refund',
        smartContractEscrowId: lockTx.smartContractEscrowId
      });
      
      if (refundTx && refundTx.txHash) {
        console.log(`   ✅ Smart contract refund found: ${refundTx.txHash}`);
      } else {
        console.log(`   ⚠️ Missing smart contract refund!`);
        
        // Check trade status
        const trade = await P2PTrade.findById(lockTx.tradeId);
        if (trade && trade.status === 'cancelled') {
          console.log(`   🔄 Trade was cancelled but smart contract refund is missing`);
          console.log(`   💡 Attempting manual smart contract refund...`);
          
          try {
            // Get user's private key
            const userPrivateKey = await walletService.getUserPrivateKey(user.chatId);
            
            // Check smart contract escrow status first
            console.log(`   🔍 Checking smart contract escrow status...`);
            const escrowDetails = await smartContractService.getEscrowDetails(lockTx.smartContractEscrowId);
            console.log(`   Smart Contract Status: ${escrowDetails.status} (0=Active, 1=Released, 2=Refunded, 3=Disputed)`);
            
            if (escrowDetails.status === 0) { // Active - needs refund
              console.log(`   🔄 Executing smart contract refund...`);
              
              const refundResult = await smartContractService.refundSmartEscrow(
                lockTx.smartContractEscrowId,
                userPrivateKey
              );
              
              console.log(`   ✅ Smart contract refund successful!`);
              console.log(`   📤 Transaction Hash: ${refundResult.txHash}`);
              
              // Update/create refund transaction record
              const newRefundTx = new EscrowTransaction({
                userId: user._id,
                tradeId: lockTx.tradeId,
                type: 'refund',
                tokenType: 'CES',
                amount: lockTx.amount,
                status: 'completed',
                txHash: refundResult.txHash,
                smartContractEscrowId: lockTx.smartContractEscrowId,
                reason: 'Manual recovery - smart contract refund was missing',
                completedAt: new Date()
              });
              
              await newRefundTx.save();
              console.log(`   📝 Refund transaction record created: ${newRefundTx._id}`);
              
            } else if (escrowDetails.status === 2) { // Already refunded in smart contract
              console.log(`   ✅ Smart contract shows already refunded`);
              console.log(`   📝 Creating missing database record...`);
              
              // Create missing refund transaction record
              const missingRefundTx = new EscrowTransaction({
                userId: user._id,
                tradeId: lockTx.tradeId,
                type: 'refund',
                tokenType: 'CES',
                amount: lockTx.amount,
                status: 'completed',
                smartContractEscrowId: lockTx.smartContractEscrowId,
                reason: 'Manual recovery - database record was missing for smart contract refund',
                completedAt: new Date()
              });
              
              await missingRefundTx.save();
              console.log(`   📝 Missing refund record created: ${missingRefundTx._id}`);
            } else {
              console.log(`   ⚠️ Smart contract escrow in unexpected status: ${escrowDetails.status}`);
            }
            
          } catch (refundError) {
            console.error(`   ❌ Manual refund failed:`, refundError.message);
          }
        }
      }
    }
    
    console.log(`\\n🎉 Recovery process completed!`);
    console.log(`\\n💡 Next steps:`);
    console.log(`   1. Check user's wallet balance on blockchain`);
    console.log(`   2. Update database balance if needed`);
    console.log(`   3. Test the fix with new trades to ensure it works correctly`);
    
  } catch (error) {
    console.error('❌ Recovery failed:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\\n✅ Database disconnected');
    }
  }
}

// Run recovery if this script is executed directly
if (require.main === module) {
  recoverMissingTokens().catch(error => {
    console.error('Recovery error:', error);
    process.exit(1);
  });
}

module.exports = { recoverMissingTokens };