/**
 * Refund User Escrow
 * Refund 1 CES from smart contract escrow ID 11 to user 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const USER_CHAT_ID = '942851377';
const ESCROW_ID = 11;
const AMOUNT = 1.0; // 1 CES

async function refundUserEscrow() {
  try {
    console.log('🔄 REFUND USER ESCROW');
    console.log('====================');
    console.log(`👤 User Chat ID: ${USER_CHAT_ID}`);
    console.log(`💳 Wallet: ${TARGET_WALLET}`);
    console.log(`🔒 Escrow ID: ${ESCROW_ID}`);
    console.log(`💰 Amount: ${AMOUNT} CES`);
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
    
    // 2. Verify escrow status
    console.log('🔍 2. VERIFYING ESCROW STATUS:');
    const escrowDetails = await smartContractService.getEscrowDetails(ESCROW_ID);
    const refundStatus = await smartContractService.canRefundEscrow(ESCROW_ID);
    
    console.log(`   Escrow Status: ${refundStatus.statusText} (${escrowDetails.status})`);
    console.log(`   Can Refund: ${refundStatus.canRefund}`);
    console.log(`   Amount: ${escrowDetails.amount} CES`);
    console.log(`   Seller: ${escrowDetails.seller}`);
    console.log(`   Buyer: ${escrowDetails.buyer}`);
    console.log('');
    
    if (!refundStatus.canRefund) {
      console.log('❌ Escrow cannot be refunded at this time');
      return;
    }
    
    if (escrowDetails.seller.toLowerCase() !== TARGET_WALLET.toLowerCase()) {
      console.log('❌ Escrow seller does not match user wallet');
      return;
    }
    
    // 3. Get user private key
    console.log('🔐 3. GETTING USER PRIVATE KEY:');
    const privateKey = await walletService.getUserPrivateKey(USER_CHAT_ID);
    if (!privateKey) {
      console.log('❌ Failed to get user private key');
      return;
    }
    console.log('✅ Private key obtained');
    console.log('');
    
    // 4. Refund escrow
    console.log('💸 4. REFUNDING ESCROW:');
    const refundResult = await smartContractService.refundSmartEscrow(
      ESCROW_ID,
      privateKey
    );
    
    if (!refundResult.success) {
      console.log('❌ Failed to refund escrow');
      console.log(`   Error: ${refundResult.error}`);
      return;
    }
    
    console.log('✅ Escrow refunded successfully');
    console.log(`   Transaction Hash: ${refundResult.txHash}`);
    console.log('');
    
    // 5. Update database
    console.log('💾 5. UPDATING DATABASE:');
    
    // Create escrow transaction record
    const escrowTransaction = new EscrowTransaction({
      userId: user._id,
      type: 'refund',
      tokenType: 'CES',
      amount: AMOUNT,
      status: 'completed',
      txHash: refundResult.txHash,
      smartContractEscrowId: ESCROW_ID,
      reason: 'Blockchain refund: CES tokens returned from smart contract escrow'
    });
    
    await escrowTransaction.save();
    console.log('✅ Escrow transaction record created');
    
    // Update user escrow balance
    // Only update if user has positive escrow balance
    if ((user.escrowCESBalance || 0) > 0) {
      user.escrowCESBalance = (user.escrowCESBalance || 0) - AMOUNT;
    } else {
      // If escrow balance is zero or negative, set it to zero
      user.escrowCESBalance = 0;
    }
    // Note: User's available balance will be automatically updated when they check their wallet
    await user.save();
    console.log('✅ User escrow balance updated');
    console.log(`   New Escrow CES Balance: ${user.escrowCESBalance || 0}`);
    console.log('');
    
    // 6. Verify the refund
    console.log('✅ 6. VERIFYING REFUND:');
    const newBalance = await walletService.getCESBalance(TARGET_WALLET);
    console.log(`   New Blockchain Balance: ${newBalance} CES`);
    
    // Get updated wallet info
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    console.log(`   Wallet Service CES Balance: ${walletInfo.cesBalance}`);
    console.log(`   Wallet Service Escrow CES: ${walletInfo.escrowCESBalance}`);
    console.log('');
    
    console.log('🎉 REFUND COMPLETE!');
    console.log('===================');
    console.log(`${AMOUNT} CES successfully returned to user's wallet`);
    console.log(`Transaction Hash: ${refundResult.txHash}`);
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Error refunding user escrow:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

if (require.main === module) {
  refundUserEscrow()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { refundUserEscrow };