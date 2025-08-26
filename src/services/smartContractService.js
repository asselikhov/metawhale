/**
 * Smart Contract Service
 * Handles smart contract interactions for decentralized P2P escrow
 */

const { ethers } = require('ethers');
const config = require('../config/configuration');

// Ensure ethers providers are available
const providers = ethers.providers || ethers;
const utils = ethers.utils || ethers;

class SmartContractService {
  constructor() {
    this.provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    this.escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    
    // Enhanced escrow contract ABI
    this.escrowABI = [
      "function createEscrow(address seller, address buyer, uint256 amount, uint256 timelock) external returns (uint256)",
      "function releaseEscrow(uint256 escrowId) external",
      "function refundEscrow(uint256 escrowId) external",
      "function getEscrowDetails(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)",
      "function extendTimelock(uint256 escrowId, uint256 additionalTime) external",
      "function initiateDispute(uint256 escrowId) external",
      "function resolveDispute(uint256 escrowId, bool favorBuyer) external",
      "event EscrowCreated(uint256 indexed escrowId, address indexed seller, address indexed buyer, uint256 amount)",
      "event EscrowReleased(uint256 indexed escrowId)",
      "event EscrowRefunded(uint256 indexed escrowId)",
      "event DisputeInitiated(uint256 indexed escrowId)",
      "event DisputeResolved(uint256 indexed escrowId, bool favorBuyer)"
    ];
  }

  // Create smart contract escrow
  async createSmartEscrow(sellerPrivateKey, buyerAddress, amount, timelockMinutes = 30) {
    try {
      console.log(`🔐 Creating smart contract escrow: ${amount} CES, timelock: ${timelockMinutes} minutes`);

      if (!this.escrowContractAddress) {
        throw new Error('Escrow contract address not configured');
      }

      const wallet = new ethers.Wallet(sellerPrivateKey, this.provider);
      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, wallet);

      // Check allowance before creating escrow
      const cesTokenAddress = process.env.CES_TOKEN_ADDRESS || '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610';
      const erc20Abi = [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)"
      ];
      
      const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, this.provider);
      const amountWei = utils.parseEther(amount.toString());
      
      // Check balance
      const balance = await cesContract.balanceOf(wallet.address);
      if (balance.lt(amountWei)) {
        throw new Error(`Insufficient CES balance. Available: ${utils.formatEther(balance)}, required: ${amount}`);
      }
      
      // Check allowance
      const allowance = await cesContract.allowance(wallet.address, this.escrowContractAddress);
      if (allowance.lt(amountWei)) {
        throw new Error(`Insufficient allowance. Current: ${utils.formatEther(allowance)} CES, required: ${amount} CES. Please approve tokens first.`);
      }
      
      console.log(`✅ Allowance check passed: ${utils.formatEther(allowance)} >= ${amount} CES`);

      // Convert timelock to seconds
      const timelockSeconds = timelockMinutes * 60;

      // Get current gas fees and adjust them with higher premium for faster confirmation
      const feeData = await this.provider.getFeeData();
      console.log(`   Current maxFeePerGas: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} Gwei`);
      console.log(`   Current maxPriorityFeePerGas: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} Gwei`);

      // Create escrow transaction with enhanced gas settings for faster confirmation
      const tx = await escrowContract.createEscrow(
        wallet.address,
        buyerAddress,
        amountWei,
        timelockSeconds,
        {
          gasLimit: 500000, // Standard gas limit
          maxFeePerGas: feeData.maxFeePerGas.mul(300).div(100), // 200% higher max fee for faster processing
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(300).div(100) // 200% higher priority fee
        }
      );

      console.log(`⏳ Smart escrow transaction sent: ${tx.hash}`);
      
      // Wait for confirmation with shorter timeout and better error handling
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000)
        )
      ]);
      
      // Parse escrow creation event to get escrow ID
      const escrowCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = escrowContract.interface.parseLog(log);
          return parsed && parsed.name === 'EscrowCreated';
        } catch {
          return false;
        }
      });

      if (!escrowCreatedEvent) {
        throw new Error('Escrow creation event not found');
      }

      const parsedEvent = escrowContract.interface.parseLog(escrowCreatedEvent);
      const escrowId = parsedEvent.args.escrowId.toString();

      console.log(`✅ Smart contract escrow created: ID ${escrowId}, TX: ${tx.hash}`);

      return {
        success: true,
        escrowId: escrowId,
        txHash: tx.hash,
        contractAddress: this.escrowContractAddress,
        timelock: timelockSeconds,
        expiresAt: new Date(Date.now() + timelockMinutes * 60 * 1000)
      };

    } catch (error) {
      console.error('Error creating smart contract escrow:', error);
      throw new Error(`Smart contract escrow failed: ${error.message}`);
    }
  }

  // Release smart contract escrow
  async releaseSmartEscrow(escrowId, releaserPrivateKey) {
    try {
      console.log(`🔓 Releasing smart contract escrow: ${escrowId}`);

      const wallet = new ethers.Wallet(releaserPrivateKey, this.provider);
      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, wallet);

      // Get current gas fees and adjust them with higher premium for faster confirmation
      const feeData = await this.provider.getFeeData();
      console.log(`   Current maxFeePerGas: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} Gwei`);
      console.log(`   Current maxPriorityFeePerGas: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} Gwei`);

      const tx = await escrowContract.releaseEscrow(escrowId, {
        gasLimit: 500000, // Standard gas limit
        maxFeePerGas: feeData.maxFeePerGas.mul(300).div(100), // 200% higher max fee for faster processing
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(300).div(100) // 200% higher priority fee
      });

      console.log(`⏳ Escrow release transaction sent: ${tx.hash}`);
      
      // Wait for confirmation with shorter timeout and better error handling
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000)
        )
      ]);

      console.log(`✅ Smart contract escrow released: ${escrowId}`);

      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error('Error releasing smart contract escrow:', error);
      throw new Error(`Escrow release failed: ${error.message}`);
    }
  }

  // Refund smart contract escrow
  async refundSmartEscrow(escrowId, refunderPrivateKey) {
    try {
      console.log(`↩️ Refunding smart contract escrow: ${escrowId}`);

      const wallet = new ethers.Wallet(refunderPrivateKey, this.provider);
      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, wallet);

      // Get current gas fees and adjust them with higher premium for faster confirmation
      const feeData = await this.provider.getFeeData();
      console.log(`   Current maxFeePerGas: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} Gwei`);
      console.log(`   Current maxPriorityFeePerGas: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} Gwei`);
      
      const tx = await escrowContract.refundEscrow(escrowId, {
        gasLimit: 500000, // Standard gas limit
        maxFeePerGas: feeData.maxFeePerGas.mul(300).div(100), // 200% higher max fee for faster processing
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(300).div(100) // 200% higher priority fee
      });

      console.log(`⏳ Escrow refund transaction sent: ${tx.hash}`);
      
      // Wait for confirmation with shorter timeout and better error handling
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000)
        )
      ]);

      console.log(`✅ Smart contract escrow refunded: ${escrowId}`);

      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error('Error refunding smart contract escrow:', error);
      throw new Error(`Escrow refund failed: ${error.message}`);
    }
  }

  // Get escrow details from smart contract
  async getEscrowDetails(escrowId) {
    try {
      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, this.provider);
      
      const details = await escrowContract.getEscrowDetails(escrowId);
      
      return {
        seller: details[0],
        buyer: details[1],
        amount: utils.formatEther(details[2]),
        timelock: details[3].toString(),
        status: details[4] // 0: Active, 1: Released, 2: Refunded, 3: Disputed
      };

    } catch (error) {
      console.error('Error getting escrow details:', error);
      throw new Error(`Failed to get escrow details: ${error.message}`);
    }
  }

  // Check if escrow can be refunded
  async canRefundEscrow(escrowId) {
    try {
      const details = await this.getEscrowDetails(escrowId);
      
      // Status 0 = Active, can be refunded
      // Status 1 = Released, cannot be refunded  
      // Status 2 = Already refunded
      // Status 3 = Disputed
      
      return {
        canRefund: details.status === 0,
        status: details.status,
        statusText: this.getEscrowStatusText(details.status),
        details: details
      };
      
    } catch (error) {
      console.error('Error checking escrow refund status:', error);
      return {
        canRefund: false,
        error: error.message
      };
    }
  }

  // Get human-readable status text
  getEscrowStatusText(status) {
    const statusMap = {
      0: 'Active',
      1: 'Released', 
      2: 'Refunded',
      3: 'Disputed'
    };
    return statusMap[status] || 'Unknown';
  }

  // Initiate dispute for smart contract escrow
  async initiateEscrowDispute(escrowId, disputerPrivateKey) {
    try {
      console.log(`⚖️ Initiating dispute for escrow: ${escrowId}`);

      const wallet = new ethers.Wallet(disputerPrivateKey, this.provider);
      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, wallet);

      // Get current gas fees and adjust them with higher premium for faster confirmation
      const feeData = await this.provider.getFeeData();
      console.log(`   Current maxFeePerGas: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} Gwei`);
      console.log(`   Current maxPriorityFeePerGas: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} Gwei`);

      const tx = await escrowContract.initiateDispute(escrowId, {
        gasLimit: 500000, // Standard gas limit
        maxFeePerGas: feeData.maxFeePerGas.mul(300).div(100), // 200% higher max fee for faster processing
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(300).div(100) // 200% higher priority fee
      });

      console.log(`⏳ Dispute initiation transaction sent: ${tx.hash}`);
      
      // Wait for confirmation with shorter timeout
      await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000)
        )
      ]);

      console.log(`✅ Dispute initiated for escrow: ${escrowId}`);

      return {
        success: true,
        txHash: tx.hash
      };

    } catch (error) {
      console.error('Error initiating escrow dispute:', error);
      throw new Error(`Dispute initiation failed: ${error.message}`);
    }
  }

  // Resolve dispute (moderator only)
  async resolveEscrowDispute(escrowId, favorBuyer, moderatorPrivateKey) {
    try {
      console.log(`⚖️ Resolving dispute for escrow: ${escrowId}, favor buyer: ${favorBuyer}`);

      const wallet = new ethers.Wallet(moderatorPrivateKey, this.provider);
      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, wallet);

      // Get current gas fees and adjust them with higher premium for faster confirmation
      const feeData = await this.provider.getFeeData();
      console.log(`   Current maxFeePerGas: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} Gwei`);
      console.log(`   Current maxPriorityFeePerGas: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} Gwei`);

      const tx = await escrowContract.resolveDispute(escrowId, favorBuyer, {
        gasLimit: 500000, // Standard gas limit
        maxFeePerGas: feeData.maxFeePerGas.mul(300).div(100), // 200% higher max fee for faster processing
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(300).div(100) // 200% higher priority fee
      });

      console.log(`⏳ Dispute resolution transaction sent: ${tx.hash}`);
      
      // Wait for confirmation with shorter timeout
      await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000)
        )
      ]);

      console.log(`✅ Dispute resolved for escrow: ${escrowId}`);

      return {
        success: true,
        txHash: tx.hash,
        resolution: favorBuyer ? 'buyer' : 'seller'
      };

    } catch (error) {
      console.error('Error resolving escrow dispute:', error);
      throw new Error(`Dispute resolution failed: ${error.message}`);
    }
  }
}

module.exports = new SmartContractService();