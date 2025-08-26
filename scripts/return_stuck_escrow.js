/**
 * Return Stuck Escrow Funds
 * Return 1 CES stuck in escrow for wallet 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');
const escrowService = require('../src/services/escrowService');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';
const STUCK_AMOUNT = 1.0; // 1 CES

async function returnStuckEscrow() {
  try {
    console.log('🔧 RETURNING STUCK ESCROW FUNDS');
    console.log('===============================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
    console.log(`💰 Stuck Amount: ${STUCK_AMOUNT} CES`);
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
    
    // 2. Check current wallet balance
    console.log('📋 2. CHECKING CURRENT BALANCES:');
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    if (walletInfo && walletInfo.hasWallet) {
      console.log('✅ Wallet accessible');
      console.log(`   Real CES Balance: ${walletInfo.cesBalance}`);
      console.log(`   Available CES: ${walletInfo.availableCESBalance}`);
      console.log(`   Escrow CES: ${walletInfo.escrowCESBalance}`);
      
      if (walletInfo.escrowCESBalance <= 0) {
        console.log('⚠️ No CES currently in escrow according to wallet service');
        console.log('   This might mean the escrow is only tracked in database');
      }
    } else {
      console.log('❌ Cannot access wallet info');
    }
    console.log('');
    
    // 3. Check escrow transactions
    console.log('📋 3. CHECKING ESCROW TRANSACTIONS:');
    const escrowTransactions = await EscrowTransaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`Found ${escrowTransactions.length} escrow transactions:`);
    
    let activeEscrowAmount = 0;
    let pendingRefunds = [];
    
    escrowTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.type.toUpperCase()} - ${tx.amount} ${tx.tokenType}`);
      console.log(`      Status: ${tx.status}`);
      console.log(`      Trade: ${tx.tradeId || 'N/A'}`);
      console.log(`      Date: ${tx.createdAt}`);
      console.log(`      Reason: ${tx.reason || 'N/A'}`);
      
      if (tx.type === 'lock' && tx.status === 'completed' && tx.tokenType === 'CES') {
        // Check if this escrow was ever released or refunded
        const matchingRelease = escrowTransactions.find(releaseTx => 
          releaseTx.tradeId === tx.tradeId && 
          (releaseTx.type === 'release' || releaseTx.type === 'refund') &&
          releaseTx.amount === tx.amount
        );
        
        if (!matchingRelease) {
          activeEscrowAmount += tx.amount;
          pendingRefunds.push(tx);
          console.log(`      ⚠️ UNRELEASED ESCROW: ${tx.amount} CES`);
        }
      }
      console.log('');
    });
    
    console.log(`Total unreleased escrow: ${activeEscrowAmount} CES`);
    console.log(`Pending refunds: ${pendingRefunds.length}`);
    console.log('');
    
    // 4. Determine what to refund
    console.log('📋 4. DETERMINING REFUND STRATEGY:');
    
    if (activeEscrowAmount <= 0) {
      console.log('⚠️ No active escrow found in transaction history');
      console.log('');
      
      // Check if user database shows escrow balance
      if (user.escrowCESBalance > 0) {
        console.log(`💡 Database shows ${user.escrowCESBalance} CES in escrow`);
        console.log('   This appears to be a database inconsistency');
        console.log('   Proceeding with manual database correction...');
        
        // Manual database correction
        const amountToRefund = Math.min(user.escrowCESBalance, STUCK_AMOUNT);
        
        user.escrowCESBalance -= amountToRefund;
        user.cesBalance += amountToRefund;
        await user.save();
        
        // Create a corrective escrow transaction record
        const escrowTx = new EscrowTransaction({
          userId: user._id,
          tradeId: null,
          type: 'refund',
          tokenType: 'CES',
          amount: amountToRefund,
          status: 'completed',
          txHash: null,
          reason: 'Manual correction: returning stuck escrow funds - database inconsistency fix',
          completedAt: new Date()
        });
        
        await escrowTx.save();
        
        console.log('✅ Manual database correction completed');
        console.log(`   Refunded: ${amountToRefund} CES`);
        console.log(`   New CES Balance: ${user.cesBalance}`);
        console.log(`   New Escrow Balance: ${user.escrowCESBalance}`);
        
      } else {
        console.log('❌ No escrow balance found in database either');
        console.log('   Cannot proceed with refund');
      }
      
    } else {
      console.log(`✅ Found ${activeEscrowAmount} CES in active escrow`);
      console.log('   Proceeding with proper escrow refund...');
      
      // Use proper escrow service to refund
      for (const pendingEscrow of pendingRefunds) {
        try {
          console.log(`🔄 Refunding escrow from trade ${pendingEscrow.tradeId || 'N/A'}: ${pendingEscrow.amount} CES`);
          
          const refundResult = await escrowService.refundTokensFromEscrow(
            user._id,
            pendingEscrow.tradeId,
            'CES',
            pendingEscrow.amount,
            'Manual admin refund: stuck escrow funds returned'
          );
          
          if (refundResult.success) {
            console.log('✅ Escrow refund successful');
            console.log(`   TX Hash: ${refundResult.txHash || 'Database only'}`);
            console.log(`   New Balance: ${refundResult.newBalance}`);
            console.log(`   New Escrow: ${refundResult.escrowBalance}`);
          } else {
            console.log('❌ Escrow refund failed');
          }
          
        } catch (refundError) {
          console.log('❌ Escrow refund error:', refundError.message);
          
          // If automated refund fails, try manual correction
          console.log('🔧 Attempting manual correction...');
          
          if (user.escrowCESBalance >= pendingEscrow.amount) {
            user.escrowCESBalance -= pendingEscrow.amount;
            user.cesBalance += pendingEscrow.amount;
            await user.save();
            
            // Create corrective transaction record
            const escrowTx = new EscrowTransaction({
              userId: user._id,
              tradeId: pendingEscrow.tradeId,
              type: 'refund',
              tokenType: 'CES',
              amount: pendingEscrow.amount,
              status: 'completed',
              txHash: null,
              reason: 'Manual admin correction: automated refund failed, manual database fix applied',
              completedAt: new Date()
            });
            
            await escrowTx.save();
            
            console.log('✅ Manual correction completed');
          }
        }
      }
    }
    
    // 5. Final verification
    console.log('📋 5. FINAL VERIFICATION:');
    
    const finalUser = await User.findById(user._id);
    const finalWalletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    console.log('✅ Final balances:');
    console.log(`   Database CES: ${finalUser.cesBalance}`);
    console.log(`   Database Escrow: ${finalUser.escrowCESBalance}`);
    console.log(`   Wallet Service CES: ${finalWalletInfo.cesBalance}`);
    console.log(`   Wallet Service Escrow: ${finalWalletInfo.escrowCESBalance}`);
    console.log('');
    
    if (finalUser.escrowCESBalance <= 0) {
      console.log('🎉 SUCCESS: No more stuck escrow funds!');
      console.log('   User can now access all their CES tokens');
    } else {
      console.log('⚠️ Some escrow funds still remain');
      console.log('   Further investigation may be needed');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error returning stuck escrow:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  returnStuckEscrow()
    .then(() => {
      console.log('\n🎉 Escrow return process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Escrow return failed:', error);
      process.exit(1);
    });
}

module.exports = { returnStuckEscrow };