/**
 * Detailed Balance Investigation Script
 * Thoroughly checks the user's actual balance situation
 */

const { ethers } = require('ethers');
const { User, EscrowTransaction, connectDatabase, disconnectDatabase } = require('../src/database/models');
const config = require('../src/config/configuration');

const TARGET_CHAT_ID = '942851377';
const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const EXPECTED_REFUND = 1.1;

async function detailedBalanceInvestigation() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    console.log('🔍 DETAILED BALANCE INVESTIGATION');
    console.log('=====================================');
    
    // 1. Check user in database
    const user = await User.findOne({ chatId: TARGET_CHAT_ID });
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log(`👤 User found: ${user.username} (${user.firstName})`);
    console.log(`💳 Wallet address: ${user.walletAddress}`);
    
    // 2. Database balances
    console.log('\n💾 DATABASE BALANCES:');
    console.log(`   Available CES: ${user.cesBalance || 0}`);
    console.log(`   Escrowed CES: ${user.escrowCESBalance || 0}`);
    console.log(`   Total DB CES: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)}`);
    console.log(`   Last update: ${user.lastBalanceUpdate || 'Never'}`);
    
    // 3. Direct blockchain balance check
    console.log('\n🔗 BLOCKCHAIN BALANCE CHECK:');
    const provider = new ethers.providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    // Direct contract call
    const cesTokenAddress = config.wallet.cesContractAddress;
    const erc20Abi = ["function balanceOf(address account) view returns (uint256)"];
    const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);
    
    const balanceWei = await cesContract.balanceOf(TARGET_WALLET);
    const balanceFormatted = ethers.utils.formatEther(balanceWei);
    
    console.log(`   Contract address: ${cesTokenAddress}`);
    console.log(`   Raw balance (wei): ${balanceWei.toString()}`);
    console.log(`   Formatted balance: ${balanceFormatted} CES`);
    
    // 4. Check recent transactions to this wallet
    console.log('\n📋 RECENT INCOMING CES TRANSACTIONS:');
    
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 100); // Check last 100 blocks
    
    const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
    const toAddressTopic = ethers.utils.hexZeroPad(TARGET_WALLET, 32);
    
    const filter = {
      address: cesTokenAddress,
      topics: [transferTopic, null, toAddressTopic],
      fromBlock: fromBlock,
      toBlock: 'latest'
    };
    
    try {
      const logs = await provider.getLogs(filter);
      
      if (logs.length > 0) {
        console.log(`   Found ${logs.length} recent transfer(s):`);
        
        for (let i = logs.length - 1; i >= 0; i--) { // Show newest first
          const log = logs[i];
          const amount = ethers.utils.formatEther(log.data);
          const fromAddress = ethers.utils.getAddress('0x' + log.topics[1].slice(26));
          
          const block = await provider.getBlock(log.blockNumber);
          const timestamp = new Date(block.timestamp * 1000);
          
          console.log(`   📤 Amount: ${amount} CES`);
          console.log(`   📍 From: ${fromAddress}`);
          console.log(`   📦 Block: ${log.blockNumber}`);
          console.log(`   🕐 Time: ${timestamp.toISOString()}`);
          console.log(`   📄 Tx: ${log.transactionHash}`);
          console.log(`   ---`);
        }
      } else {
        console.log(`   ❌ No recent CES transfers found in last 100 blocks`);
      }
    } catch (logError) {
      console.error(`   ❌ Error checking transfer logs: ${logError.message}`);
    }
    
    // 5. Check smart contract escrow status
    console.log('\n🔒 SMART CONTRACT ESCROW STATUS:');
    try {
      const smartContractService = require('../src/services/smartContractService');
      const escrowStatus = await smartContractService.canRefundEscrow(7);
      
      console.log(`   Escrow ID 7 status: ${escrowStatus.statusText || 'Unknown'}`);
      console.log(`   Can refund: ${escrowStatus.canRefund ? 'Yes' : 'No'}`);
      
      if (escrowStatus.details) {
        console.log(`   Seller: ${escrowStatus.details.seller}`);
        console.log(`   Buyer: ${escrowStatus.details.buyer}`);
        console.log(`   Amount: ${escrowStatus.details.amount} CES`);
        console.log(`   Status code: ${escrowStatus.details.status}`);
      }
      
    } catch (escrowError) {
      console.error(`   ❌ Error checking escrow: ${escrowError.message}`);
    }
    
    // 6. Database escrow transactions
    console.log('\n📊 DATABASE ESCROW TRANSACTIONS:');
    const escrowTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES'
    }).sort({ createdAt: -1 }).limit(10);
    
    if (escrowTxs.length > 0) {
      console.log(`   Found ${escrowTxs.length} recent transaction(s):`);
      
      escrowTxs.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.type.toUpperCase()}: ${tx.amount} CES`);
        console.log(`      Status: ${tx.status}`);
        console.log(`      Date: ${tx.createdAt.toISOString()}`);
        console.log(`      Reason: ${tx.reason || 'N/A'}`);
        console.log(`      Trade ID: ${tx.tradeId || 'N/A'}`);
        console.log(`      Smart Contract Escrow ID: ${tx.smartContractEscrowId || 'N/A'}`);
        console.log(`      Tx Hash: ${tx.txHash || 'N/A'}`);
        console.log(`      ---`);
      });
    } else {
      console.log(`   ❌ No escrow transactions found`);
    }
    
    // 7. Summary and analysis
    console.log('\n📋 SUMMARY & ANALYSIS:');
    console.log('=====================================');
    
    const dbTotal = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
    const blockchainBalance = parseFloat(balanceFormatted);
    const difference = Math.abs(dbTotal - blockchainBalance);
    
    console.log(`💾 Database total: ${dbTotal} CES`);
    console.log(`🔗 Blockchain balance: ${blockchainBalance} CES`);
    console.log(`📊 Difference: ${difference.toFixed(4)} CES`);
    
    if (difference > 0.0001) {
      console.log(`⚠️ DISCREPANCY DETECTED!`);
      console.log(`   Database shows: ${dbTotal} CES`);
      console.log(`   Blockchain shows: ${blockchainBalance} CES`);
      
      if (blockchainBalance < 1.0) {
        console.log(`❌ PROBLEM: User still missing the 1.1 CES refund`);
        console.log(`   Expected: ${0.9 + EXPECTED_REFUND} CES`);
        console.log(`   Actual: ${blockchainBalance} CES`);
        console.log(`   Missing: ${(0.9 + EXPECTED_REFUND) - blockchainBalance} CES`);
      }
    } else {
      console.log(`✅ Database and blockchain balances match`);
    }
    
    // 8. Recommendations
    console.log('\n🛠️ RECOMMENDATIONS:');
    if (blockchainBalance < 1.5) {
      console.log(`❌ The 1.1 CES refund has NOT been successfully processed`);
      console.log(`📋 Next steps:`);
      console.log(`   1. Check if smart contract escrow ID 7 is still locked`);
      console.log(`   2. Verify admin transaction actually succeeded`);
      console.log(`   3. Re-execute smart contract refund if needed`);
    } else {
      console.log(`✅ Balance appears correct - 1.1 CES refund processed`);
    }
    
  } catch (error) {
    console.error('❌ Error during detailed investigation:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the investigation
if (require.main === module) {
  detailedBalanceInvestigation()
    .then(() => {
      console.log('\n🎉 Detailed balance investigation completed');
    })
    .catch((error) => {
      console.error('\n💥 Investigation failed:', error);
    });
}

module.exports = { detailedBalanceInvestigation };