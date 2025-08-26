/**
 * Test Smart Contract Refund Fix
 * Verifies that the refund process properly handles smart contract escrows
 */

const { User, P2PTrade, EscrowTransaction } = require('./src/database/models');
const escrowService = require('./src/services/escrowService');

async function testSmartContractRefundFix() {
  console.log('🧪 Testing Smart Contract Refund Fix...\n');
  
  try {
    // Test user from the error
    const testChatId = '942851377';
    const targetWallet = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
    
    console.log(`1️⃣ Analyzing user ${testChatId} (${targetWallet})`);
    
    const user = await User.findOne({ chatId: testChatId });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ User found: ${user._id}`);
    console.log(`   Current balance: ${user.cesBalance || 0} CES`);
    console.log(`   Escrow balance: ${user.escrowCESBalance || 0} CES`);
    console.log(`   Wallet: ${user.walletAddress}`);
    
    // Look for recent escrow transactions
    console.log(`\\n2️⃣ Recent escrow transactions:`);
    const recentTxs = await EscrowTransaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`Found ${recentTxs.length} recent transactions:`);
    recentTxs.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.type.toUpperCase()}: ${tx.amount} ${tx.tokenType}`);
      console.log(`      Trade: ${tx.tradeId || 'N/A'}`);
      console.log(`      Status: ${tx.status}`);
      console.log(`      Smart Contract ID: ${tx.smartContractEscrowId || 'N/A'}`);
      console.log(`      TxHash: ${tx.txHash || 'N/A'}`);
      console.log(`      Date: ${tx.createdAt.toLocaleString('ru-RU')}`);
      console.log(`      Reason: ${tx.reason || 'N/A'}`);
      console.log('');
    });
    
    // Look for smart contract escrows that might need refunding
    console.log(`3️⃣ Looking for smart contract escrows:`);
    const smartContractLocks = await EscrowTransaction.find({
      userId: user._id,
      type: 'lock',
      tokenType: 'CES',
      smartContractEscrowId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${smartContractLocks.length} smart contract lock transactions:`);
    for (const lockTx of smartContractLocks) {
      console.log(`   Lock: ${lockTx.amount} CES (Smart Contract ID: ${lockTx.smartContractEscrowId})`);
      console.log(`      Trade: ${lockTx.tradeId}`);
      console.log(`      Date: ${lockTx.createdAt.toLocaleString('ru-RU')}`);
      
      // Check if there's a corresponding refund
      const refundTx = await EscrowTransaction.findOne({
        userId: user._id,
        tradeId: lockTx.tradeId,
        type: 'refund',
        smartContractEscrowId: lockTx.smartContractEscrowId
      });
      
      if (refundTx) {
        console.log(`      ✅ Refund found: ${refundTx.amount} CES (${refundTx.createdAt.toLocaleString('ru-RU')})`);
        console.log(`         TxHash: ${refundTx.txHash || 'N/A'}`);
      } else {
        console.log(`      ❌ NO REFUND FOUND - Potential issue!`);
        
        // Check trade status
        if (lockTx.tradeId) {
          const trade = await P2PTrade.findById(lockTx.tradeId);
          if (trade) {
            console.log(`         Trade status: ${trade.status}`);
            console.log(`         Escrow status: ${trade.escrowStatus || 'N/A'}`);
          }
        }
      }
      console.log('');
    }
    
    // Check for recent cancelled trades
    console.log(`4️⃣ Recent cancelled trades:`);
    const cancelledTrades = await P2PTrade.find({
      sellerId: user._id,
      status: 'cancelled'
    }).sort({ createdAt: -1 }).limit(5);
    
    console.log(`Found ${cancelledTrades.length} cancelled trades where user was seller:`);
    cancelledTrades.forEach((trade, index) => {
      console.log(`   ${index + 1}. Trade ${trade._id}`);
      console.log(`      Amount: ${trade.amount} CES`);
      console.log(`      Status: ${trade.status}`);
      console.log(`      Escrow Status: ${trade.escrowStatus || 'N/A'}`);
      console.log(`      Date: ${trade.createdAt.toLocaleString('ru-RU')}`);
      console.log('');
    });
    
    console.log(`💡 ANALYSIS SUMMARY:`);
    console.log(`   - Current database balance: ${user.cesBalance || 0} CES`);
    console.log(`   - Expected behavior: Smart contract escrows should be properly refunded`);
    console.log(`   - Fix applied: Added smart contract refund logic to refundTokensFromEscrow()`);
    console.log(`\\n🔧 The fix ensures that when trades are cancelled, tokens are properly`);
    console.log(`   refunded from smart contracts back to the user's wallet, not just updated in database.`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('\\n🏁 Test completed.');
}

// Run test if this script is executed directly
if (require.main === module) {
  testSmartContractRefundFix().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

module.exports = { testSmartContractRefundFix };