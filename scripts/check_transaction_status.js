/**
 * Transaction Status Checker
 * Checks the status of the admin refund transaction
 */

const { ethers } = require('ethers');
const config = require('../src/config/configuration');
const walletService = require('../src/services/walletService');

// Use the same provider configuration
const providers = ethers.providers || ethers;
const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function checkTransactionAndBalance() {
  try {
    const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    console.log('🔍 Checking latest transactions and balance...');
    
    // Get current balance
    const currentBalance = await walletService.getCESBalance(TARGET_WALLET);
    console.log(`💰 Current CES balance: ${currentBalance} CES`);
    
    // Get latest block number
    const latestBlock = await provider.getBlockNumber();
    console.log(`📦 Latest block: ${latestBlock}`);
    
    // Check recent transactions to the wallet
    console.log(`\n🔍 Checking recent incoming transactions to ${TARGET_WALLET}...`);
    
    // Get transaction history (last 10 blocks)
    const fromBlock = Math.max(0, latestBlock - 10);
    
    try {
      // Check for CES token transfers to the wallet
      const cesContractAddress = config.wallet.cesContractAddress;
      const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
      const toAddressTopic = ethers.utils.hexZeroPad(TARGET_WALLET, 32);
      
      const filter = {
        address: cesContractAddress,
        topics: [transferTopic, null, toAddressTopic],
        fromBlock: fromBlock,
        toBlock: 'latest'
      };
      
      const logs = await provider.getLogs(filter);
      
      if (logs.length > 0) {
        console.log(`📋 Found ${logs.length} recent CES transfer(s):`);
        
        for (const log of logs) {
          const tx = await provider.getTransaction(log.transactionHash);
          const receipt = await provider.getTransactionReceipt(log.transactionHash);
          
          // Decode the transfer amount
          const amount = ethers.utils.formatEther(log.topics[3]);
          
          console.log(`   📤 Transaction: ${log.transactionHash}`);
          console.log(`   📦 Block: ${log.blockNumber}`);
          console.log(`   💰 Amount: ${amount} CES`);
          console.log(`   ✅ Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
          console.log(`   ⛽ Gas Used: ${receipt.gasUsed?.toString()}`);
          console.log(`   ---`);
        }
      } else {
        console.log(`ℹ️ No recent CES transfers found in last 10 blocks`);
      }
      
    } catch (logError) {
      console.error('Error checking transaction logs:', logError.message);
    }
    
    // Also check for any pending transactions
    console.log(`\n🔍 Checking mempool for pending transactions...`);
    try {
      const pendingBlock = await provider.getBlock('pending');
      console.log(`📋 Pending transactions: ${pendingBlock.transactions.length}`);
    } catch (pendingError) {
      console.log('ℹ️ Could not check pending transactions');
    }
    
    // Final balance check
    console.log(`\n📊 Final Results:`);
    console.log(`   💰 Current balance: ${currentBalance} CES`);
    console.log(`   🎯 Expected balance: 2.0 CES`);
    
    if (currentBalance >= 2.0) {
      console.log(`   ✅ SUCCESS: Balance increased! Refund completed.`);
    } else if (currentBalance > 0.9) {
      console.log(`   🔄 PARTIAL: Balance increased but not to expected amount.`);
    } else {
      console.log(`   ⏳ PENDING: Balance unchanged - transaction may still be processing.`);
    }
    
  } catch (error) {
    console.error('❌ Error checking transaction status:', error);
  }
}

// Run the check
if (require.main === module) {
  checkTransactionAndBalance()
    .then(() => {
      console.log('\n🎉 Transaction status check completed');
    })
    .catch((error) => {
      console.error('\n💥 Transaction status check failed:', error);
    });
}

module.exports = { checkTransactionAndBalance };