/**
 * Current Transaction Checker
 * Checks the status of the specific admin refund transaction
 */

const { ethers } = require('ethers');
const config = require('../src/config/configuration');
const walletService = require('../src/services/walletService');

const providers = ethers.providers || ethers;
const TX_HASH = '0x4014b398f4c878c11f2917053bcfdd2dc22a7f9a593a71c4fa96a9513be0e5ad';
const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function checkCurrentTransaction() {
  try {
    const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    console.log(`🔍 Checking transaction: ${TX_HASH}`);
    
    // Get transaction details
    const tx = await provider.getTransaction(TX_HASH);
    
    if (!tx) {
      console.log(`❌ Transaction not found or not yet propagated`);
      return;
    }
    
    console.log(`📋 Transaction Details:`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Gas Limit: ${tx.gasLimit?.toString()}`);
    console.log(`   Gas Price: ${ethers.utils.formatUnits(tx.gasPrice || 0, 'gwei')} Gwei`);
    console.log(`   Block Number: ${tx.blockNumber || 'Pending'}`);
    console.log(`   Nonce: ${tx.nonce}`);
    
    // Get transaction receipt if mined
    if (tx.blockNumber) {
      const receipt = await provider.getTransactionReceipt(TX_HASH);
      
      console.log(`\n📄 Transaction Receipt:`);
      console.log(`   Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Gas Used: ${receipt.gasUsed?.toString()}`);
      console.log(`   Block Number: ${receipt.blockNumber}`);
      console.log(`   Block Hash: ${receipt.blockHash}`);
      console.log(`   Transaction Index: ${receipt.transactionIndex}`);
      
      if (receipt.status === 1) {
        console.log(`\n🎉 TRANSACTION SUCCEEDED!`);
        
        // Check current balance
        console.log(`\n💰 Checking updated balance...`);
        const newBalance = await walletService.getCESBalance(TARGET_WALLET);
        console.log(`   Current CES balance: ${newBalance} CES`);
        
        if (newBalance >= 2.0) {
          console.log(`   ✅ SUCCESS: Balance is now ${newBalance} CES (expected ~2.0 CES)`);
        } else {
          console.log(`   ⚠️ WARNING: Balance is ${newBalance} CES, expected ~2.0 CES`);
        }
        
        // Check for events in the transaction
        if (receipt.logs && receipt.logs.length > 0) {
          console.log(`\n📋 Transaction Events:`);
          receipt.logs.forEach((log, index) => {
            console.log(`   ${index + 1}. Address: ${log.address}`);
            console.log(`      Topics: ${log.topics.length} topic(s)`);
            console.log(`      Data: ${log.data.length > 0 ? 'Present' : 'Empty'}`);
          });
        }
      } else {
        console.log(`\n❌ TRANSACTION FAILED on blockchain`);
      }
    } else {
      console.log(`\n⏳ Transaction is still pending...`);
      
      // Check mempool status
      try {
        const network = await provider.getNetwork();
        console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
        console.log(`   Gas Price: ${ethers.utils.formatUnits(tx.gasPrice || 0, 'gwei')} Gwei`);
        
        // Get current gas prices to compare
        const currentGasPrice = await provider.getGasPrice();
        console.log(`   Current network gas price: ${ethers.utils.formatUnits(currentGasPrice, 'gwei')} Gwei`);
        
        if (tx.gasPrice && currentGasPrice.gt(tx.gasPrice)) {
          console.log(`   ⚠️ Transaction gas price may be too low`);
        }
      } catch (error) {
        console.log(`   Could not get additional network info: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking transaction:', error);
  }
}

// Run the check
if (require.main === module) {
  checkCurrentTransaction()
    .then(() => {
      console.log('\n🎉 Transaction check completed');
    })
    .catch((error) => {
      console.error('\n💥 Transaction check failed:', error);
    });
}

module.exports = { checkCurrentTransaction };