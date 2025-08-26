/**
 * Comprehensive Escrow Analysis
 * Check all escrow transactions for wallet 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 * Determine if additional CES tokens need to be returned to reach 2 CES total
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';
const REQUESTED_RETURN_AMOUNT = 2.0; // User requested 2 CES

async function checkAllEscrowTransactions() {
  try {
    console.log('🔍 COMPREHENSIVE ESCROW ANALYSIS');
    console.log('================================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
    console.log(`📋 Requested Return: ${REQUESTED_RETURN_AMOUNT} CES`);
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
    
    // 2. Get all escrow transactions for this user
    console.log('📋 2. ALL ESCROW TRANSACTIONS:');
    const allEscrowTransactions = await EscrowTransaction.find({ userId: user._id })
      .sort({ createdAt: 1 }) // Sort chronologically
      .lean();
    
    console.log(`Found ${allEscrowTransactions.length} total escrow transactions:`);
    console.log('');
    
    let totalLocked = 0;
    let totalReleased = 0;
    let totalRefunded = 0;
    let unresolvedLocks = [];
    
    allEscrowTransactions.forEach((tx, index) => {
      const date = new Date(tx.createdAt).toISOString().slice(0, 19).replace('T', ' ');
      console.log(`${index + 1}. ${tx.type.toUpperCase()} - ${tx.amount} ${tx.tokenType}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Date: ${date}`);
      console.log(`   Trade: ${tx.tradeId || 'N/A'}`);
      console.log(`   Smart Contract ID: ${tx.smartContractEscrowId || 'N/A'}`);
      console.log(`   Reason: ${tx.reason || 'N/A'}`);
      
      if (tx.tokenType === 'CES') {
        if (tx.type === 'lock' && tx.status === 'completed') {
          totalLocked += tx.amount;
          unresolvedLocks.push(tx);
        } else if (tx.type === 'release' && tx.status === 'completed') {
          totalReleased += tx.amount;
          // Remove corresponding lock from unresolved
          unresolvedLocks = unresolvedLocks.filter(lock => 
            !(lock.tradeId === tx.tradeId && lock.amount === tx.amount)
          );
        } else if (tx.type === 'refund' && tx.status === 'completed') {
          totalRefunded += tx.amount;
          // Remove corresponding lock from unresolved
          unresolvedLocks = unresolvedLocks.filter(lock => 
            !(lock.tradeId === tx.tradeId && lock.amount === tx.amount)
          );
        }
      }
      console.log('');
    });
    
    // 3. Calculate balances
    console.log('📋 3. ESCROW BALANCE CALCULATION:');
    console.log(`   Total CES Locked: ${totalLocked}`);
    console.log(`   Total CES Released: ${totalReleased}`);
    console.log(`   Total CES Refunded: ${totalRefunded}`);
    console.log(`   Net Outstanding: ${totalLocked - totalReleased - totalRefunded}`);
    console.log(`   Unresolved Locks: ${unresolvedLocks.length}`);
    console.log('');
    
    // 4. Show unresolved locks
    if (unresolvedLocks.length > 0) {
      console.log('📋 4. UNRESOLVED ESCROW LOCKS:');
      unresolvedLocks.forEach((lock, index) => {
        const date = new Date(lock.createdAt).toISOString().slice(0, 19).replace('T', ' ');
        console.log(`   ${index + 1}. ${lock.amount} CES locked on ${date}`);
        console.log(`      Trade: ${lock.tradeId || 'N/A'}`);
        console.log(`      Smart Contract ID: ${lock.smartContractEscrowId || 'N/A'}`);
        console.log(`      Reason: ${lock.reason || 'N/A'}`);
      });
      console.log('');
    }
    
    // 5. Current wallet balance check
    console.log('📋 5. CURRENT WALLET STATUS:');
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    
    if (walletInfo && walletInfo.hasWallet) {
      console.log('✅ Wallet accessible');
      console.log(`   Real CES Balance: ${walletInfo.cesBalance}`);
      console.log(`   Available CES: ${walletInfo.availableCESBalance}`);
      console.log(`   Escrow CES: ${walletInfo.escrowCESBalance}`);
    } else {
      console.log('❌ Cannot access wallet info');
    }
    console.log('');
    
    // 6. Analysis and recommendations
    console.log('📋 6. ANALYSIS & RECOMMENDATIONS:');
    
    const currentUnresolvedAmount = unresolvedLocks.reduce((sum, lock) => sum + lock.amount, 0);
    const alreadyReturnedToday = totalRefunded; // Assumes recent refunds are from today's script execution
    
    console.log(`   Currently stuck in escrow: ${currentUnresolvedAmount} CES`);
    console.log(`   Already returned today: ${alreadyReturnedToday} CES`);
    console.log(`   Requested total return: ${REQUESTED_RETURN_AMOUNT} CES`);
    console.log('');
    
    if (alreadyReturnedToday >= REQUESTED_RETURN_AMOUNT) {
      console.log('✅ ANALYSIS: Request already fulfilled');
      console.log(`   The requested ${REQUESTED_RETURN_AMOUNT} CES has already been returned.`);
      console.log(`   No further action needed.`);
    } else if (currentUnresolvedAmount === 0) {
      console.log('⚠️ ANALYSIS: No stuck escrow found');
      console.log(`   There are currently no CES tokens stuck in escrow.`);
      console.log(`   Only ${alreadyReturnedToday} CES was available to return.`);
      
      if (REQUESTED_RETURN_AMOUNT > alreadyReturnedToday) {
        const shortfall = REQUESTED_RETURN_AMOUNT - alreadyReturnedToday;
        console.log(`   Shortfall: ${shortfall} CES`);
        console.log(`   This might require manual investigation or admin intervention.`);
      }
    } else {
      const additionalToReturn = Math.min(
        currentUnresolvedAmount,
        REQUESTED_RETURN_AMOUNT - alreadyReturnedToday
      );
      
      if (additionalToReturn > 0) {
        console.log('🔧 ANALYSIS: Additional action needed');
        console.log(`   Need to return additional: ${additionalToReturn} CES`);
        console.log(`   Available stuck amount: ${currentUnresolvedAmount} CES`);
        console.log('');
        console.log('📋 RECOMMENDED ACTION:');
        console.log(`   Run return_stuck_escrow.js again with amount: ${additionalToReturn} CES`);
        console.log(`   This will complete the user's request for ${REQUESTED_RETURN_AMOUNT} CES total.`);
      } else {
        console.log('✅ ANALYSIS: Request fulfilled');
        console.log(`   The total requested ${REQUESTED_RETURN_AMOUNT} CES has been returned.`);
      }
    }
    
    console.log('');
    console.log('📋 7. FINAL SUMMARY:');
    console.log(`   User's current CES balance: ${user.cesBalance || 0}`);
    console.log(`   User's current escrow: ${user.escrowCESBalance || 0}`);
    console.log(`   Wallet service CES: ${walletInfo?.cesBalance || 0}`);
    console.log(`   Total CES returned to user: ${alreadyReturnedToday}`);
    console.log(`   Outstanding escrow amount: ${currentUnresolvedAmount}`);
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error analyzing escrow transactions:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  checkAllEscrowTransactions()
    .then(() => {
      console.log('\n🎉 Escrow analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Escrow analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { checkAllEscrowTransactions };