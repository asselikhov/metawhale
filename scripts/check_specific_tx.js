/**
 * Specific Transaction Checker
 * Checks the status of specific transaction hashes from the admin refund
 */

const { ethers } = require('ethers');
const config = require('../src/config/configuration');

const providers = ethers.providers || ethers;

// Transaction hashes from the output
const TX_HASHES = [
  '0x79489d135ae0b61e927c69b177eadd6af8e78be76aa51faa333268f52a168a40',
  '0x1475f552ca08ee717720c2dbdd6f0295c96ec628ec510ab1d40632cd79d5fa8d'
];

async function checkSpecificTransactions() {
  try {
    const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    console.log('🔍 Checking specific transaction hashes...');
    
    for (const txHash of TX_HASHES) {
      console.log(`\n📋 Checking transaction: ${txHash}`);
      
      try {
        // Get transaction details
        const tx = await provider.getTransaction(txHash);
        
        if (!tx) {
          console.log(`❌ Transaction not found or not yet mined`);
          continue;
        }
        
        console.log(`   📤 From: ${tx.from}`);
        console.log(`   📥 To: ${tx.to}`);
        console.log(`   ⛽ Gas Limit: ${tx.gasLimit?.toString()}`);
        console.log(`   💰 Value: ${ethers.utils.formatEther(tx.value)} MATIC`);
        console.log(`   📦 Block Number: ${tx.blockNumber || 'Pending'}`);
        
        // Get transaction receipt if mined
        if (tx.blockNumber) {
          const receipt = await provider.getTransactionReceipt(txHash);
          
          console.log(`   ✅ Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
          console.log(`   ⛽ Gas Used: ${receipt.gasUsed?.toString()}`);
          console.log(`   💸 Effective Gas Price: ${ethers.utils.formatUnits(receipt.effectiveGasPrice || 0, 'gwei')} Gwei`);
          
          if (receipt.status === 1) {
            console.log(`   🎉 Transaction succeeded!`);
            
            // Check for events
            if (receipt.logs && receipt.logs.length > 0) {
              console.log(`   📋 Events: ${receipt.logs.length} log(s) emitted`);
            }
          } else {
            console.log(`   ❌ Transaction failed on blockchain`);
          }
        } else {
          console.log(`   ⏳ Transaction pending...`);
        }
        
      } catch (txError) {
        console.log(`   ❌ Error checking transaction: ${txError.message}`);
      }
    }
    
    // Also check current balance again
    console.log(`\n💰 Checking current balance...`);
    const walletService = require('../src/services/walletService');
    const balance = await walletService.getCESBalance('0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d');
    console.log(`   Current CES balance: ${balance} CES`);
    
  } catch (error) {
    console.error('❌ Error checking specific transactions:', error);
  }
}

// Run the check
if (require.main === module) {
  checkSpecificTransactions()
    .then(() => {
      console.log('\n🎉 Specific transaction check completed');
    })
    .catch((error) => {
      console.error('\n💥 Specific transaction check failed:', error);
    });
}

module.exports = { checkSpecificTransactions };