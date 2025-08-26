/**
 * Script to investigate current escrow state and identify stuck transactions
 */

const { connectDatabase } = require('../src/database/models');
const { User, EscrowTransaction } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');

async function investigateEscrowState() {
  console.log('🔍 Investigating current escrow state...');
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Find the user
    const user = await User.findOne({ chatId: '942851377' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`   Wallet address: ${user.walletAddress}`);
    console.log(`   Available CES: ${user.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   Available POL: ${user.polBalance || 0}`);
    console.log(`   Escrowed POL: ${user.escrowPOLBalance || 0}`);
    
    // Find all escrow transactions for this user
    const escrowTransactions = await EscrowTransaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`\n📋 Found ${escrowTransactions.length} recent escrow transactions:`);
    
    for (const tx of escrowTransactions) {
      console.log(`\n--- Transaction ${tx._id} ---`);
      console.log(`   Type: ${tx.type}`);
      console.log(`   Token: ${tx.tokenType}`);
      console.log(`   Amount: ${tx.amount}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Trade ID: ${tx.tradeId || 'null'}`);
      console.log(`   Smart Contract Escrow ID: ${tx.smartContractEscrowId || 'null'}`);
      console.log(`   Created: ${tx.createdAt}`);
      console.log(`   Completed: ${tx.completedAt || 'null'}`);
      console.log(`   Reason: ${tx.reason || 'null'}`);
      
      // If this is a smart contract escrow, check its status
      if (tx.smartContractEscrowId) {
        try {
          console.log(`   🔍 Checking smart contract status...`);
          const details = await smartContractService.getEscrowDetails(tx.smartContractEscrowId);
          console.log(`      Status: ${smartContractService.getEscrowStatusText(details.status)} (${details.status})`);
          console.log(`      Amount: ${details.amount} CES`);
          console.log(`      Seller: ${details.seller}`);
          console.log(`      Buyer: ${details.buyer}`);
          
          const refundCheck = await smartContractService.canRefundEscrow(tx.smartContractEscrowId);
          console.log(`      Can refund: ${refundCheck.canRefund}`);
          console.log(`      Status text: ${refundCheck.statusText}`);
        } catch (error) {
          console.log(`      ❌ Error checking smart contract status: ${error.message}`);
        }
      }
    }
    
    // Check for any stuck escrow transactions (completed in DB but not actually refunded)
    const stuckEscrows = await EscrowTransaction.find({
      userId: user._id,
      type: 'refund',
      status: 'completed',
      smartContractEscrowId: { $exists: true, $ne: null }
    });
    
    console.log(`\n🔍 Found ${stuckEscrows.length} refund transactions with smart contract IDs:`);
    
    for (const tx of stuckEscrows) {
      console.log(`\n--- Stuck Refund Transaction ${tx._id} ---`);
      console.log(`   Smart Contract Escrow ID: ${tx.smartContractEscrowId}`);
      console.log(`   Amount: ${tx.amount}`);
      console.log(`   Created: ${tx.createdAt}`);
      
      // Check if the escrow was actually refunded
      if (tx.smartContractEscrowId) {
        try {
          const details = await smartContractService.getEscrowDetails(tx.smartContractEscrowId);
          console.log(`   Actual Status: ${smartContractService.getEscrowStatusText(details.status)} (${details.status})`);
          
          if (details.status !== 2) { // 2 = Refunded
            console.log(`   ⚠️  ESCROW NOT ACTUALLY REFUNDED - Status is ${details.status}`);
          } else {
            console.log(`   ✅ Escrow was properly refunded`);
          }
        } catch (error) {
          console.log(`   ❌ Error checking escrow status: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error investigating escrow state:', error);
  }
}

// Run the investigation
if (require.main === module) {
  investigateEscrowState().then(() => {
    console.log('\n🏁 Investigation completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Investigation failed:', error);
    process.exit(1);
  });
}

module.exports = { investigateEscrowState };