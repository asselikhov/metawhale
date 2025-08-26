/**
 * Smart Contract Escrow Release Script
 * Provides information for releasing 1.1 CES from smart contract escrow ID 7
 * for user 942851377 (wallet: 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d)
 */

const { User, EscrowTransaction, connectDatabase, disconnectDatabase } = require('../src/database/models');
const walletService = require('../src/services/walletService');
const smartContractService = require('../src/services/smartContractService');

const TARGET_CHAT_ID = '942851377';
const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const ESCROW_ID = 7;
const AMOUNT = 1.1;

async function checkAndPrepareEscrowRelease() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    console.log(`🔍 Checking smart contract escrow status for user ${TARGET_CHAT_ID}`);
    
    // Find user
    const user = await User.findOne({ chatId: TARGET_CHAT_ID });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ Found user: ${user.username} (${user.firstName})`);
    console.log(`   Wallet: ${user.walletAddress}`);
    
    // Verify wallet address matches
    if (user.walletAddress !== TARGET_WALLET) {
      console.log(`⚠️ Wallet address mismatch!`);
      console.log(`   Database: ${user.walletAddress}`);
      console.log(`   Expected: ${TARGET_WALLET}`);
      return;
    }
    
    // Check current blockchain balance
    const currentBalance = await walletService.getCESBalance(user.walletAddress);
    console.log(`💰 Current blockchain balance: ${currentBalance} CES`);
    console.log(`💰 Expected after release: ${currentBalance + AMOUNT} CES`);
    
    // Check smart contract escrow status
    console.log(`\n🔍 Checking smart contract escrow ID ${ESCROW_ID}...`);
    
    try {
      const escrowStatus = await smartContractService.canRefundEscrow(ESCROW_ID);
      
      if (escrowStatus.canRefund) {
        console.log(`✅ Escrow ${ESCROW_ID} can be refunded`);
        console.log(`   Status: ${escrowStatus.statusText}`);
        
        // Get detailed escrow information
        const escrowDetails = await smartContractService.getEscrowDetails(ESCROW_ID);
        console.log(`📋 Escrow details:`);
        console.log(`   Seller: ${escrowDetails.seller}`);
        console.log(`   Buyer: ${escrowDetails.buyer}`);
        console.log(`   Amount: ${escrowDetails.amount} CES`);
        console.log(`   Status: ${escrowDetails.status} (${smartContractService.getEscrowStatusText(escrowDetails.status)})`);
        
        // Verify amount matches
        if (Math.abs(parseFloat(escrowDetails.amount) - AMOUNT) < 0.0001) {
          console.log(`✅ Amount matches: ${escrowDetails.amount} CES = ${AMOUNT} CES`);
        } else {
          console.log(`⚠️ Amount mismatch: Expected ${AMOUNT} CES, found ${escrowDetails.amount} CES`);
        }
        
        // Verify seller address matches user wallet
        if (escrowDetails.seller.toLowerCase() === user.walletAddress.toLowerCase()) {
          console.log(`✅ Seller address matches user wallet`);
        } else {
          console.log(`⚠️ Seller address mismatch:`);
          console.log(`   Escrow seller: ${escrowDetails.seller}`);
          console.log(`   User wallet: ${user.walletAddress}`);
        }
        
      } else {
        console.log(`❌ Escrow ${ESCROW_ID} cannot be refunded`);
        console.log(`   Status: ${escrowStatus.statusText}`);
        if (escrowStatus.error) {
          console.log(`   Error: ${escrowStatus.error}`);
        }
      }
      
    } catch (escrowError) {
      console.error('❌ Error checking smart contract escrow:', escrowError.message);
    }
    
    // Find related escrow transactions
    console.log(`\n📋 Related escrow transactions:`);
    const escrowTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES',
      amount: AMOUNT
    }).sort({ createdAt: -1 }).limit(3);
    
    if (escrowTxs.length > 0) {
      escrowTxs.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.type.toUpperCase()}: ${tx.amount} CES`);
        console.log(`      Status: ${tx.status}`);
        console.log(`      Date: ${tx.createdAt.toISOString()}`);
        console.log(`      Reason: ${tx.reason || 'N/A'}`);
        console.log(`      Trade ID: ${tx.tradeId || 'N/A'}`);
        console.log(`      Smart Contract Escrow ID: ${tx.smartContractEscrowId || 'N/A'}`);
        console.log('      ---');
      });
    } else {
      console.log('   No related escrow transactions found');
    }
    
    console.log(`\n🛠️ MANUAL RELEASE INSTRUCTIONS:`);
    console.log(`\n1. SMART CONTRACT ADMIN ACTION REQUIRED:`);
    console.log(`   - Contract Address: ${process.env.ESCROW_CONTRACT_ADDRESS || 'Not configured'}`);
    console.log(`   - Function: refundEscrow(uint256 escrowId)`);
    console.log(`   - Parameter: escrowId = ${ESCROW_ID}`);
    console.log(`   - Expected Result: ${AMOUNT} CES released to ${user.walletAddress}`);
    
    console.log(`\n2. VERIFICATION STEPS:`);
    console.log(`   - Before: ${currentBalance} CES`);
    console.log(`   - After: ${currentBalance + AMOUNT} CES`);
    console.log(`   - User: ${TARGET_CHAT_ID} (${user.username || user.firstName})`);
    console.log(`   - Wallet: ${user.walletAddress}`);
    
    console.log(`\n3. DATABASE UPDATE AFTER RELEASE:`);
    console.log(`   - Update EscrowTransaction record to status: 'completed'`);
    console.log(`   - Reason: 'Manual admin intervention: Smart contract escrow released'`);
    
    console.log(`\n⚠️ IMPORTANT NOTES:`);
    console.log(`   - This requires smart contract administrator privileges`);
    console.log(`   - Transaction will be executed on Polygon network`);
    console.log(`   - Gas fees will be paid by the admin wallet`);
    console.log(`   - User will receive tokens directly to their wallet`);
    
  } catch (error) {
    console.error('❌ Error during escrow release preparation:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the preparation
if (require.main === module) {
  checkAndPrepareEscrowRelease()
    .then(() => {
      console.log('\n🎉 Escrow release preparation completed');
      console.log('📋 Please provide the above information to the smart contract administrator');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Escrow release preparation failed:', error);
      process.exit(1);
    });
}

module.exports = { checkAndPrepareEscrowRelease };