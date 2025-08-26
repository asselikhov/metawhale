/**
 * Emergency Escrow Fix Script
 * Diagnoses and fixes escrow ID 8 that is causing transaction failures
 */

require('dotenv').config();

const { ethers } = require('ethers');
const { connectDatabase, disconnectDatabase } = require('../src/database/models');

// Ensure ethers providers are available
const providers = ethers.providers || ethers;
const utils = ethers.utils || ethers;

class EmergencyEscrowFixer {
  constructor() {
    this.provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    this.escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    
    this.escrowABI = [
      "function getEscrowDetails(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)",
      "function refundEscrow(uint256 escrowId) external",
      "function owner() external view returns (address)",
      "event EscrowRefunded(uint256 indexed escrowId)"
    ];
  }

  async diagnoseEscrow() {
    try {
      console.log('🔍 EMERGENCY ESCROW DIAGNOSIS');
      console.log('=============================');
      
      await connectDatabase();
      const { EscrowTransaction, P2PTrade, User } = require('../src/database/models');
      
      const ESCROW_ID = 8;
      const TRADE_ID = '68adc80204dc62f8f6fbb4a4';
      
      // 1. Check database state
      console.log('\\n📊 DATABASE STATE:');
      
      const trade = await P2PTrade.findById(TRADE_ID)
        .populate('sellerId buyerId');
      
      if (trade) {
        console.log(`   Trade ID: ${trade._id}`);
        console.log(`   Status: ${trade.status}`);
        console.log(`   Escrow Status: ${trade.escrowStatus}`);
        console.log(`   Amount: ${trade.amount} CES`);
        console.log(`   Seller: ${trade.sellerId.chatId} (${trade.sellerId.username || trade.sellerId.firstName})`);
        console.log(`   Buyer: ${trade.buyerId.chatId} (${trade.buyerId.username || trade.buyerId.firstName})`);
      } else {
        console.log(`   ❌ Trade ${TRADE_ID} not found`);
        return;
      }
      
      // 2. Check escrow transactions
      const escrowTxs = await EscrowTransaction.find({
        tradeId: TRADE_ID,
        smartContractEscrowId: String(ESCROW_ID)
      }).sort({ createdAt: 1 });
      
      console.log(`\\n🔒 ESCROW TRANSACTIONS (Smart Contract ID ${ESCROW_ID}):`);
      for (const tx of escrowTxs) {
        console.log(`   - ${tx.type}: ${tx.amount} ${tx.tokenType}, Status: ${tx.status}`);
        console.log(`     Created: ${tx.createdAt.toISOString()}`);
        console.log(`     Reason: ${tx.reason}`);
        if (tx.txHash) {
          console.log(`     TxHash: ${tx.txHash}`);
        }
      }
      
      // 3. Check smart contract state
      console.log('\\n🔗 SMART CONTRACT STATE:');
      if (!this.escrowContractAddress) {
        console.log('   ❌ Escrow contract address not configured');
        return;
      }
      
      const escrowContract = new ethers.Contract(
        this.escrowContractAddress, 
        this.escrowABI, 
        this.provider
      );
      
      try {
        const details = await escrowContract.getEscrowDetails(ESCROW_ID);
        
        console.log(`   Seller: ${details[0]}`);
        console.log(`   Buyer: ${details[1]}`);
        console.log(`   Amount: ${utils.formatEther(details[2])} CES`);
        console.log(`   Timelock: ${details[3].toString()}`);
        console.log(`   Status: ${details[4]} (0=Active, 1=Released, 2=Refunded, 3=Disputed)`);
        
        const currentTime = Math.floor(Date.now() / 1000);
        const timelockExpired = currentTime > parseInt(details[3].toString());
        
        console.log(`   Current Time: ${currentTime}`);
        console.log(`   Timelock Expired: ${timelockExpired ? 'Yes' : 'No'}`);
        
        // 4. Check if escrow can be refunded
        if (details[4] === 0) { // Active
          if (timelockExpired) {
            console.log('   ✅ Escrow can be refunded (Active + Timelock expired)');
          } else {
            console.log('   ⚠️ Escrow is Active but timelock not expired yet');
          }
        } else if (details[4] === 1) {
          console.log('   ❌ Escrow already released - cannot refund');
        } else if (details[4] === 2) {
          console.log('   ❌ Escrow already refunded');
        } else {
          console.log('   ❌ Escrow in disputed state');
        }
        
      } catch (contractError) {
        console.error(`   ❌ Error reading smart contract: ${contractError.message}`);
      }
      
      // 5. Check current gas prices
      console.log('\\n⛽ NETWORK CONDITIONS:');
      try {
        const gasPrice = await this.provider.getGasPrice();
        const gasPriceGwei = utils.formatUnits(gasPrice, 'gwei');
        
        console.log(`   Current Gas Price: ${gasPriceGwei} Gwei`);
        console.log(`   Recommended Gas Price: ${Math.ceil(parseFloat(gasPriceGwei) * 1.5)} Gwei`);
        
        const latestBlock = await this.provider.getBlock('latest');
        console.log(`   Latest Block: ${latestBlock.number}`);
        console.log(`   Block Time: ${new Date(latestBlock.timestamp * 1000).toISOString()}`);
        
      } catch (gasError) {
        console.error(`   ❌ Error checking gas: ${gasError.message}`);
      }
      
      return {
        trade,
        escrowTxs,
        escrowId: ESCROW_ID
      };
      
    } catch (error) {
      console.error('❌ Diagnosis failed:', error);
      throw error;
    }
  }

  async emergencyRefund() {
    try {
      console.log('\\n🚨 EMERGENCY REFUND EXECUTION');
      console.log('===============================');
      
      const ESCROW_ID = 8;
      
      // Check admin private key
      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
      }
      
      console.log('✅ Admin private key found');
      
      // Create admin wallet
      const adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);
      console.log(`🔑 Admin address: ${adminWallet.address}`);
      
      // Create contract instance
      const escrowContract = new ethers.Contract(
        this.escrowContractAddress,
        this.escrowABI,
        adminWallet
      );
      
      // Check escrow details one more time
      const details = await escrowContract.getEscrowDetails(ESCROW_ID);
      
      if (details[4] !== 0) { // Not Active
        throw new Error(`Escrow is not active (status: ${details[4]})`);
      }
      
      console.log(`🔍 Refunding escrow ${ESCROW_ID}:`);
      console.log(`   Amount: ${utils.formatEther(details[2])} CES`);
      console.log(`   Seller: ${details[0]}`);
      
      // Get current gas prices with premium
      const gasPrice = await this.provider.getGasPrice();
      const premiumGasPrice = gasPrice.mul(200).div(100); // 200% of current price
      
      console.log(`⛽ Using premium gas price: ${utils.formatUnits(premiumGasPrice, 'gwei')} Gwei`);
      
      // Execute refund with high gas price
      const tx = await escrowContract.refundEscrow(ESCROW_ID, {
        gasLimit: 300000, // Increased gas limit
        gasPrice: premiumGasPrice
      });
      
      console.log(`📋 Emergency refund transaction submitted:`);
      console.log(`   Hash: ${tx.hash}`);
      console.log(`   Gas Price: ${tx.gasPrice ? utils.formatUnits(tx.gasPrice, 'gwei') : 'N/A'} Gwei`);
      console.log(`   Gas Limit: ${tx.gasLimit?.toString()}`);
      
      console.log(`\\n⏳ Waiting for confirmation...`);
      const receipt = await tx.wait();
      
      console.log(`\\n✅ Emergency refund successful!`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed?.toString()}`);
      console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
      
      if (receipt.status !== 1) {
        throw new Error('Transaction failed on blockchain');
      }
      
      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt
      };
      
    } catch (error) {
      console.error('❌ Emergency refund failed:', error);
      throw error;
    }
  }

  async syncDatabase(txHash) {
    try {
      console.log('\\n🔄 SYNCING DATABASE');
      console.log('===================');
      
      const { EscrowTransaction, P2PTrade, User } = require('../src/database/models');
      
      const ESCROW_ID = 8;
      const TRADE_ID = '68adc80204dc62f8f6fbb4a4';
      
      // Find the original lock transaction
      const lockTx = await EscrowTransaction.findOne({
        tradeId: TRADE_ID,
        type: 'lock',
        smartContractEscrowId: String(ESCROW_ID)
      });
      
      if (!lockTx) {
        throw new Error('Original lock transaction not found');
      }
      
      console.log(`📝 Found lock transaction: ${lockTx.amount} CES`);
      
      // Update user balances
      const user = await User.findById(lockTx.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      console.log(`👤 User ${user.chatId} current balances:`);
      console.log(`   Available: ${user.cesBalance} CES`);
      console.log(`   Escrowed: ${user.escrowCESBalance} CES`);
      
      // Move funds from escrow back to available
      user.escrowCESBalance = Math.max(0, user.escrowCESBalance - lockTx.amount);
      user.cesBalance += lockTx.amount;
      
      await user.save();
      
      console.log(`✅ Updated user balances:`);
      console.log(`   Available: ${user.cesBalance} CES`);
      console.log(`   Escrowed: ${user.escrowCESBalance} CES`);
      
      // Create refund transaction record
      const refundTx = new EscrowTransaction({
        userId: lockTx.userId,
        tradeId: TRADE_ID,
        type: 'refund',
        tokenType: 'CES',
        amount: lockTx.amount,
        status: 'completed',
        txHash: txHash,
        smartContractEscrowId: String(ESCROW_ID),
        reason: 'Emergency admin refund - escrow cancellation failure resolved',
        completedAt: new Date()
      });
      
      await refundTx.save();
      console.log(`📝 Created refund transaction record: ${refundTx._id}`);
      
      // Update trade status
      const trade = await P2PTrade.findById(TRADE_ID);
      if (trade) {
        trade.status = 'cancelled';
        trade.escrowStatus = 'returned';
        trade.disputeReason = 'Emergency admin intervention - refund successful';
        trade.cancelledAt = new Date();
        
        await trade.save();
        console.log(`✅ Updated trade status to cancelled`);
      }
      
      return {
        success: true,
        userBalance: user.cesBalance,
        escrowBalance: user.escrowCESBalance
      };
      
    } catch (error) {
      console.error('❌ Database sync failed:', error);
      throw error;
    }
  }
}

async function main() {
  const fixer = new EmergencyEscrowFixer();
  
  try {
    // 1. Diagnose the problem
    const diagnosis = await fixer.diagnoseEscrow();
    
    console.log('\\n🤔 RECOMMENDATION:');
    if (diagnosis.trade && diagnosis.trade.status !== 'cancelled') {
      console.log('   The escrow needs to be refunded and trade cancelled');
      
      // Ask for confirmation
      console.log('\\n⚠️ This will execute an emergency admin refund');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 2. Execute emergency refund
      const refundResult = await fixer.emergencyRefund();
      
      // 3. Sync database
      await fixer.syncDatabase(refundResult.txHash);
      
      console.log('\\n🎉 EMERGENCY FIX COMPLETED SUCCESSFULLY!');
      console.log('=========================================');
      console.log('✅ Smart contract escrow refunded');
      console.log('✅ Database synchronized');
      console.log('✅ Trade cancelled properly');
      console.log('\\nUsers should now be able to cancel trades normally.');
      
    } else {
      console.log('   Trade is already cancelled - no action needed');
    }
    
  } catch (error) {
    console.error('\\n💥 Emergency fix failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = EmergencyEscrowFixer;