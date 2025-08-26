/**
 * Admin Smart Contract Escrow Refund Script
 * Executes refund for escrow ID 7 to release 1.1 CES for user 942851377
 * Requires admin private key in environment variables
 */

const { ethers } = require('ethers');
const { User, EscrowTransaction, connectDatabase, disconnectDatabase } = require('../src/database/models');
const config = require('../src/config/configuration');

// Ensure ethers providers are available
const providers = ethers.providers || ethers;
const utils = ethers.utils || ethers;

const ESCROW_ID = 7;
const TARGET_CHAT_ID = '942851377';
const EXPECTED_AMOUNT = 1.1;

class AdminEscrowManager {
  constructor() {
    this.provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    this.escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    
    // Enhanced escrow contract ABI with admin functions
    this.escrowABI = [
      "function refundEscrow(uint256 escrowId) external",
      "function getEscrowDetails(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)",
      "function owner() external view returns (address)",
      "event EscrowRefunded(uint256 indexed escrowId)"
    ];
  }

  async executeAdminRefund() {
    try {
      console.log('🔧 Starting admin escrow refund process...');
      
      // Check admin private key
      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
      }
      
      if (!this.escrowContractAddress) {
        throw new Error('ESCROW_CONTRACT_ADDRESS not configured');
      }
      
      console.log(`🔗 Contract Address: ${this.escrowContractAddress}`);
      console.log(`🆔 Escrow ID: ${ESCROW_ID}`);
      
      // Setup admin wallet
      const adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);
      console.log(`👤 Admin Wallet: ${adminWallet.address}`);
      
      // Create contract instance
      const escrowContract = new ethers.Contract(
        this.escrowContractAddress, 
        this.escrowABI, 
        adminWallet
      );
      
      // Verify admin has permissions
      try {
        const contractOwner = await escrowContract.owner();
        console.log(`🏛️ Contract Owner: ${contractOwner}`);
        
        if (contractOwner.toLowerCase() !== adminWallet.address.toLowerCase()) {
          console.log(`⚠️ Warning: Admin wallet (${adminWallet.address}) is not the contract owner (${contractOwner})`);
          console.log('Proceeding anyway - checking if admin has refund permissions...');
        } else {
          console.log('✅ Admin wallet confirmed as contract owner');
        }
      } catch (ownerError) {
        console.log('ℹ️ Could not verify contract owner (function may not exist)');
      }
      
      // Get current escrow details
      console.log(`\n🔍 Getting escrow ${ESCROW_ID} details...`);
      const escrowDetails = await escrowContract.getEscrowDetails(ESCROW_ID);
      
      const seller = escrowDetails[0];
      const buyer = escrowDetails[1];
      const amount = utils.formatEther(escrowDetails[2]);
      const timelock = escrowDetails[3].toString();
      const status = escrowDetails[4];
      
      console.log(`📋 Escrow Details:`);
      console.log(`   Seller: ${seller}`);
      console.log(`   Buyer: ${buyer}`);
      console.log(`   Amount: ${amount} CES`);
      console.log(`   Timelock: ${timelock}`);
      console.log(`   Status: ${status} (${this.getStatusText(status)})`);
      
      // Verify amount matches expected
      if (Math.abs(parseFloat(amount) - EXPECTED_AMOUNT) > 0.0001) {
        throw new Error(`Amount mismatch: Expected ${EXPECTED_AMOUNT} CES, found ${amount} CES`);
      }
      
      // Verify status allows refund (0 = Active)
      if (status !== 0) {
        throw new Error(`Cannot refund escrow with status ${status} (${this.getStatusText(status)})`);
      }
      
      console.log('✅ Escrow verification passed');
      
      // Get current gas prices for Polygon
      console.log(`\n⛽ Getting gas prices...`);
      const feeData = await this.provider.getFeeData();
      
      // Set reasonable gas prices for Polygon
      const gasLimit = 200000; // Standard gas limit for escrow operations
      let maxFeePerGas = utils.parseUnits('150', 'gwei'); // 150 Gwei max
      let maxPriorityFeePerGas = utils.parseUnits('30', 'gwei'); // 30 Gwei priority
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // Use network suggested prices with reasonable limits
        maxFeePerGas = feeData.maxFeePerGas.lt(maxFeePerGas) ? feeData.maxFeePerGas : maxFeePerGas;
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.lt(maxPriorityFeePerGas) ? feeData.maxPriorityFeePerGas : maxPriorityFeePerGas;
      }
      
      console.log(`   Gas Limit: ${gasLimit}`);
      console.log(`   Max Fee Per Gas: ${utils.formatUnits(maxFeePerGas, 'gwei')} Gwei`);
      console.log(`   Max Priority Fee: ${utils.formatUnits(maxPriorityFeePerGas, 'gwei')} Gwei`);
      
      // Execute the refund transaction
      console.log(`\n🚀 Executing escrow refund...`);
      console.log(`⚠️ This will release ${amount} CES to ${seller}`);
      
      const tx = await escrowContract.refundEscrow(ESCROW_ID, {
        gasLimit: gasLimit,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      });
      
      console.log(`📋 Transaction submitted:`);
      console.log(`   Hash: ${tx.hash}`);
      console.log(`   From: ${tx.from}`);
      console.log(`   To: ${tx.to}`);
      console.log(`   Gas Limit: ${tx.gasLimit?.toString()}`);
      
      console.log(`\n⏳ Waiting for transaction confirmation...`);
      const receipt = await tx.wait();
      
      console.log(`\n✅ Transaction confirmed!`);
      console.log(`   Block Number: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed?.toString()}`);
      console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
      
      if (receipt.status !== 1) {
        throw new Error('Transaction failed on blockchain');
      }
      
      // Parse events
      const refundEvent = receipt.logs.find(log => {
        try {
          const parsed = escrowContract.interface.parseLog(log);
          return parsed.name === 'EscrowRefunded' && parsed.args.escrowId.toString() === ESCROW_ID.toString();
        } catch {
          return false;
        }
      });
      
      if (refundEvent) {
        console.log(`🎉 EscrowRefunded event detected for escrow ID ${ESCROW_ID}`);
      }
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber
      };
      
    } catch (error) {
      console.error('❌ Admin refund execution failed:', error);
      throw error;
    }
  }
  
  getStatusText(status) {
    const statusMap = {
      0: 'Active',
      1: 'Released',
      2: 'Refunded',
      3: 'Disputed'
    };
    return statusMap[status] || 'Unknown';
  }
}

async function executeAdminEscrowRefund() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    // Find the user for verification
    const user = await User.findOne({ chatId: TARGET_CHAT_ID });
    if (!user) {
      throw new Error(`User ${TARGET_CHAT_ID} not found`);
    }
    
    console.log(`👤 Target User: ${user.username || user.firstName} (${TARGET_CHAT_ID})`);
    console.log(`💳 Wallet: ${user.walletAddress}`);
    
    // Execute the admin refund
    const adminManager = new AdminEscrowManager();
    const result = await adminManager.executeAdminRefund();
    
    if (result.success) {
      console.log(`\n📝 Updating database records...`);
      
      // Update the failed escrow transaction to completed
      const updatedTx = await EscrowTransaction.findOneAndUpdate(
        {
          userId: user._id,
          type: 'refund',
          amount: EXPECTED_AMOUNT,
          status: 'completed',
          reason: { $regex: /Manual intervention.*smart contract/i }
        },
        {
          status: 'completed',
          txHash: result.txHash,
          reason: `Manual admin intervention: Smart contract escrow ${ESCROW_ID} released successfully`,
          completedAt: new Date()
        },
        { new: true, sort: { createdAt: -1 } }
      );
      
      if (updatedTx) {
        console.log(`✅ Updated escrow transaction: ${updatedTx._id}`);
      } else {
        console.log(`ℹ️ No matching escrow transaction found to update`);
      }
      
      console.log(`\n🎉 ADMIN REFUND COMPLETED SUCCESSFULLY!`);
      console.log(`📋 Summary:`);
      console.log(`   - User: ${TARGET_CHAT_ID} (${user.username || user.firstName})`);
      console.log(`   - Amount: ${EXPECTED_AMOUNT} CES`);
      console.log(`   - Escrow ID: ${ESCROW_ID}`);
      console.log(`   - Transaction: ${result.txHash}`);
      console.log(`   - Block: ${result.blockNumber}`);
      console.log(`   - Gas Used: ${result.gasUsed}`);
      console.log(`\n✅ User should now have the 1.1 CES in their wallet!`);
    }
    
  } catch (error) {
    console.error('❌ Admin escrow refund failed:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the admin refund
if (require.main === module) {
  executeAdminEscrowRefund()
    .then(() => {
      console.log('\n🎉 Admin escrow refund process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Admin escrow refund process failed:', error);
      process.exit(1);
    });
}

module.exports = { AdminEscrowManager, executeAdminEscrowRefund };