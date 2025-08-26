/**
 * Admin Emergency Escrow Override Script
 * Handles emergency escrow refunds with admin privileges
 */

require('dotenv').config();

const { ethers } = require('ethers');
const { connectDatabase, disconnectDatabase } = require('../src/database/models');

// Ensure ethers providers are available
const providers = ethers.providers || ethers;
const utils = ethers.utils || ethers;

class AdminEscrowOverride {
  constructor() {
    this.provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    this.escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    
    // Extended ABI with admin functions
    this.escrowABI = [
      "function getEscrowDetails(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)",
      "function refundEscrow(uint256 escrowId) external",
      "function adminRefundEscrow(uint256 escrowId) external", // Admin override
      "function owner() external view returns (address)",
      "function extendTimelock(uint256 escrowId, uint256 additionalTime) external",
      "function emergencyRefund(uint256 escrowId) external", // Emergency function
      "event EscrowRefunded(uint256 indexed escrowId)"
    ];
  }

  async checkAdminAccess() {
    try {
      console.log('🔐 CHECKING ADMIN ACCESS');
      console.log('========================');
      
      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not found');
      }
      
      const adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);
      console.log(`👤 Admin Address: ${adminWallet.address}`);
      
      const escrowContract = new ethers.Contract(
        this.escrowContractAddress,
        this.escrowABI,
        this.provider
      );
      
      try {
        const contractOwner = await escrowContract.owner();
        console.log(`🏢 Contract Owner: ${contractOwner}`);
        
        const isOwner = adminWallet.address.toLowerCase() === contractOwner.toLowerCase();
        console.log(`✅ Is Admin Owner: ${isOwner ? 'Yes' : 'No'}`);
        
        return {
          adminAddress: adminWallet.address,
          contractOwner: contractOwner,
          isOwner: isOwner,
          adminWallet: adminWallet
        };
        
      } catch (ownerError) {
        console.log('⚠️ Cannot check contract owner (function may not exist)');
        return {
          adminAddress: adminWallet.address,
          adminWallet: adminWallet
        };
      }
      
    } catch (error) {
      console.error('❌ Admin access check failed:', error);
      throw error;
    }
  }

  async forceRefundWithHighGas() {
    try {
      console.log('\\n🚀 ATTEMPTING FORCE REFUND WITH HIGH GAS');
      console.log('==========================================');
      
      const ESCROW_ID = 8;
      const adminInfo = await this.checkAdminAccess();
      
      const escrowContract = new ethers.Contract(
        this.escrowContractAddress,
        this.escrowABI,
        adminInfo.adminWallet
      );
      
      // Get very high gas price (5x network price)
      const networkGasPrice = await this.provider.getGasPrice();
      const ultraHighGasPrice = networkGasPrice.mul(500).div(100); // 500% of network price
      
      console.log(`⛽ Network Gas Price: ${utils.formatUnits(networkGasPrice, 'gwei')} Gwei`);
      console.log(`🚀 Ultra High Gas Price: ${utils.formatUnits(ultraHighGasPrice, 'gwei')} Gwei`);
      
      // First try admin refund if available
      try {
        console.log('\\n🔧 Trying adminRefundEscrow()...');
        
        const adminTx = await escrowContract.adminRefundEscrow(ESCROW_ID, {
          gasLimit: 500000,
          gasPrice: ultraHighGasPrice
        });
        
        console.log(`📋 Admin refund transaction: ${adminTx.hash}`);
        const adminReceipt = await adminTx.wait();
        
        if (adminReceipt.status === 1) {
          console.log('✅ Admin refund successful!');
          return {
            success: true,
            method: 'adminRefundEscrow',
            txHash: adminTx.hash,
            receipt: adminReceipt
          };
        }
        
      } catch (adminError) {
        console.log(`⚠️ Admin refund failed: ${adminError.message}`);
      }
      
      // Try emergency refund
      try {
        console.log('\\n🆘 Trying emergencyRefund()...');
        
        const emergencyTx = await escrowContract.emergencyRefund(ESCROW_ID, {
          gasLimit: 500000,
          gasPrice: ultraHighGasPrice
        });
        
        console.log(`📋 Emergency refund transaction: ${emergencyTx.hash}`);
        const emergencyReceipt = await emergencyTx.wait();
        
        if (emergencyReceipt.status === 1) {
          console.log('✅ Emergency refund successful!');
          return {
            success: true,
            method: 'emergencyRefund',
            txHash: emergencyTx.hash,
            receipt: emergencyReceipt
          };
        }
        
      } catch (emergencyError) {
        console.log(`⚠️ Emergency refund failed: ${emergencyError.message}`);
      }
      
      // Try regular refund with extreme gas
      try {
        console.log('\\n💪 Trying regular refund with extreme gas...');
        
        const regularTx = await escrowContract.refundEscrow(ESCROW_ID, {
          gasLimit: 800000, // Very high gas limit
          gasPrice: ultraHighGasPrice
        });
        
        console.log(`📋 Regular refund transaction: ${regularTx.hash}`);
        const regularReceipt = await regularTx.wait();
        
        if (regularReceipt.status === 1) {
          console.log('✅ Regular refund with high gas successful!');
          return {
            success: true,
            method: 'refundEscrow',
            txHash: regularTx.hash,
            receipt: regularReceipt
          };
        }
        
      } catch (regularError) {
        console.log(`❌ Regular refund failed: ${regularError.message}`);
        throw regularError;
      }
      
      throw new Error('All refund methods failed');
      
    } catch (error) {
      console.error('❌ Force refund failed:', error);
      throw error;
    }
  }

  async manualDatabaseSync() {
    try {
      console.log('\\n🔄 MANUAL DATABASE SYNC');
      console.log('========================');
      
      await connectDatabase();
      const { EscrowTransaction, P2PTrade, User } = require('../src/database/models');
      
      const ESCROW_ID = 8;
      const TRADE_ID = '68adc80204dc62f8f6fbb4a4';
      const AMOUNT = 1.5;
      
      // Find the lock transaction
      const lockTx = await EscrowTransaction.findOne({
        tradeId: TRADE_ID,
        type: 'lock',
        smartContractEscrowId: String(ESCROW_ID)
      });
      
      if (!lockTx) {
        throw new Error('Lock transaction not found');
      }
      
      console.log(`📝 Found lock transaction: ${lockTx.amount} CES`);
      
      // Find the user
      const user = await User.findById(lockTx.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      console.log(`👤 User ${user.chatId} before sync:`);
      console.log(`   Available: ${user.cesBalance} CES`);
      console.log(`   Escrowed: ${user.escrowCESBalance} CES`);
      
      // Check if refund already exists
      const existingRefund = await EscrowTransaction.findOne({
        tradeId: TRADE_ID,
        type: 'refund',
        smartContractEscrowId: String(ESCROW_ID)
      });
      
      if (existingRefund) {
        console.log('⚠️ Refund transaction already exists');
        return { success: true, message: 'Already refunded' };
      }
      
      // Sync the balances
      user.escrowCESBalance = Math.max(0, user.escrowCESBalance - AMOUNT);
      user.cesBalance += AMOUNT;
      
      await user.save();
      
      console.log(`✅ User ${user.chatId} after sync:`);
      console.log(`   Available: ${user.cesBalance} CES`);
      console.log(`   Escrowed: ${user.escrowCESBalance} CES`);
      
      // Create manual refund record
      const manualRefundTx = new EscrowTransaction({
        userId: lockTx.userId,
        tradeId: TRADE_ID,
        type: 'refund',
        tokenType: 'CES',
        amount: AMOUNT,
        status: 'completed',
        txHash: null, // No blockchain transaction
        smartContractEscrowId: String(ESCROW_ID),
        reason: 'Manual admin intervention - emergency escrow cancellation',
        completedAt: new Date()
      });
      
      await manualRefundTx.save();
      console.log(`📝 Created manual refund record: ${manualRefundTx._id}`);
      
      // Update trade status
      const trade = await P2PTrade.findById(TRADE_ID);
      if (trade) {
        trade.status = 'cancelled';
        trade.escrowStatus = 'returned';
        trade.disputeReason = 'Emergency admin cancellation - refund completed';
        trade.cancelledAt = new Date();
        
        await trade.save();
        console.log(`✅ Trade cancelled successfully`);
      }
      
      return {
        success: true,
        userBalance: user.cesBalance,
        escrowBalance: user.escrowCESBalance,
        refundTxId: manualRefundTx._id
      };
      
    } catch (error) {
      console.error('❌ Manual database sync failed:', error);
      throw error;
    }
  }
}

async function main() {
  const override = new AdminEscrowOverride();
  
  try {
    console.log('🚨 ADMIN EMERGENCY ESCROW OVERRIDE');
    console.log('===================================');
    
    // Check timelock status first
    console.log('\\n🕐 CHECKING TIMELOCK STATUS...');
    const escrowContract = new ethers.Contract(
      override.escrowContractAddress,
      override.escrowABI,
      override.provider
    );
    
    const details = await escrowContract.getEscrowDetails(8);
    const currentTime = Math.floor(Date.now() / 1000);
    const timelockExpired = currentTime > parseInt(details[3].toString());
    
    console.log(`Current Time: ${currentTime}`);
    console.log(`Timelock: ${details[3].toString()}`);
    console.log(`Timelock Expired: ${timelockExpired ? 'Yes' : 'No'}`);
    console.log(`Time remaining: ${timelockExpired ? 0 : parseInt(details[3].toString()) - currentTime} seconds`);
    
    if (!timelockExpired) {
      console.log('\\n⏰ TIMELOCK NOT EXPIRED YET');
      console.log('The smart contract escrow cannot be refunded until timelock expires.');
      console.log('Options:');
      console.log('1. Wait for timelock to expire naturally');
      console.log('2. Perform manual database-only refund (emergency option)');
      
      console.log('\\n🚨 PROCEEDING WITH MANUAL DATABASE REFUND...');
      console.log('This will sync the database without blockchain transaction.');
      
      const syncResult = await override.manualDatabaseSync();
      
      if (syncResult.success) {
        console.log('\\n✅ EMERGENCY DATABASE SYNC COMPLETED');
        console.log('=====================================');
        console.log('⚠️ Note: Smart contract still holds the tokens until timelock expires');
        console.log('💡 Users can now cancel trades normally in the interface');
        console.log('🔄 When timelock expires, admin should run proper blockchain refund');
        return;
      }
    }
    
    // If timelock expired, try blockchain refund
    console.log('\\n🚀 ATTEMPTING BLOCKCHAIN REFUND...');
    const refundResult = await override.forceRefundWithHighGas();
    
    if (refundResult.success) {
      await override.manualDatabaseSync();
      
      console.log('\\n🎉 FULL EMERGENCY OVERRIDE COMPLETED!');
      console.log('======================================');
      console.log(`✅ Blockchain refund: ${refundResult.txHash}`);
      console.log('✅ Database synchronized');
      console.log('✅ Trade cancelled');
    }
    
  } catch (error) {
    console.error('\\n💥 Emergency override failed:', error);
    
    // Last resort - manual database sync
    console.log('\\n🆘 LAST RESORT: MANUAL DATABASE SYNC');
    try {
      await override.manualDatabaseSync();
      console.log('✅ Manual sync completed as fallback');
    } catch (syncError) {
      console.error('❌ Manual sync also failed:', syncError);
    }
    
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = AdminEscrowOverride;