/**
 * Smart Contract Service
 * Handles smart contract interactions for decentralized P2P escrow
 */

const { ethers } = require('ethers');
const config = require('../config/configuration');

class SmartContractService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.wallet.polygonRpcUrl);
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

      // Convert timelock to seconds
      const timelockSeconds = timelockMinutes * 60;
      
      // Convert amount to wei (assuming 18 decimals for CES)
      const amountWei = ethers.parseEther(amount.toString());

      // Create escrow transaction
      const tx = await escrowContract.createEscrow(
        wallet.address,
        buyerAddress,
        amountWei,
        timelockSeconds,
        {
          gasLimit: 300000,
          gasPrice: ethers.parseUnits('30', 'gwei')
        }
      );

      console.log(`⏳ Smart escrow transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
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

      const tx = await escrowContract.releaseEscrow(escrowId, {
        gasLimit: 200000,
        gasPrice: ethers.parseUnits('30', 'gwei')
      });

      console.log(`⏳ Escrow release transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();

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

      const tx = await escrowContract.refundEscrow(escrowId, {
        gasLimit: 200000,
        gasPrice: ethers.parseUnits('30', 'gwei')
      });

      console.log(`⏳ Escrow refund transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();

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
        amount: ethers.formatEther(details[2]),
        timelock: details[3].toString(),
        status: details[4] // 0: Active, 1: Released, 2: Refunded, 3: Disputed
      };

    } catch (error) {
      console.error('Error getting escrow details:', error);
      throw new Error(`Failed to get escrow details: ${error.message}`);
    }
  }

  // Initiate dispute for smart contract escrow
  async initiateEscrowDispute(escrowId, disputerPrivateKey) {
    try {
      console.log(`⚖️ Initiating dispute for escrow: ${escrowId}`);

      const wallet = new ethers.Wallet(disputerPrivateKey, this.provider);
      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, wallet);

      const tx = await escrowContract.initiateDispute(escrowId, {
        gasLimit: 150000,
        gasPrice: ethers.parseUnits('30', 'gwei')
      });

      console.log(`⏳ Dispute initiation transaction sent: ${tx.hash}`);
      
      await tx.wait();

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

      const tx = await escrowContract.resolveDispute(escrowId, favorBuyer, {
        gasLimit: 200000,
        gasPrice: ethers.parseUnits('30', 'gwei')
      });

      console.log(`⏳ Dispute resolution transaction sent: ${tx.hash}`);
      
      await tx.wait();

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

  // Monitor escrow events
  async monitorEscrowEvents(fromBlock = 'latest') {
    try {
      if (!this.escrowContractAddress) {
        console.log('⚠️ Escrow contract address not configured, skipping event monitoring');
        return;
      }

      const escrowContract = new ethers.Contract(this.escrowContractAddress, this.escrowABI, this.provider);

      // Listen for escrow events
      escrowContract.on('EscrowCreated', (escrowId, seller, buyer, amount, event) => {
        console.log(`🔐 Escrow Created: ID ${escrowId}, Amount: ${ethers.formatEther(amount)} CES`);
        this.handleEscrowCreated(escrowId, seller, buyer, amount);
      });

      escrowContract.on('EscrowReleased', (escrowId, event) => {
        console.log(`🔓 Escrow Released: ID ${escrowId}`);
        this.handleEscrowReleased(escrowId);
      });

      escrowContract.on('EscrowRefunded', (escrowId, event) => {
        console.log(`↩️ Escrow Refunded: ID ${escrowId}`);
        this.handleEscrowRefunded(escrowId);
      });

      escrowContract.on('DisputeInitiated', (escrowId, event) => {
        console.log(`⚖️ Dispute Initiated: Escrow ID ${escrowId}`);
        this.handleDisputeInitiated(escrowId);
      });

      escrowContract.on('DisputeResolved', (escrowId, favorBuyer, event) => {
        console.log(`⚖️ Dispute Resolved: Escrow ID ${escrowId}, Favor Buyer: ${favorBuyer}`);
        this.handleDisputeResolved(escrowId, favorBuyer);
      });

      console.log('👂 Started monitoring smart contract escrow events');

    } catch (error) {
      console.error('Error monitoring escrow events:', error);
    }
  }

  // Event handlers
  async handleEscrowCreated(escrowId, seller, buyer, amount) {
    // Update database with smart contract escrow details
    // This would integrate with the existing P2P trade system
  }

  async handleEscrowReleased(escrowId) {
    // Update trade status and user balances
  }

  async handleEscrowRefunded(escrowId) {
    // Update trade status and refund user
  }

  async handleDisputeInitiated(escrowId) {
    // Notify moderators and update trade status
  }

  async handleDisputeResolved(escrowId, favorBuyer) {
    // Update final trade outcome
  }

  // Estimate gas costs for escrow operations
  async estimateEscrowGasCosts() {
    try {
      if (!this.escrowContractAddress) {
        return null;
      }

      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = ethers.formatUnits(gasPrice, 'gwei');

      return {
        createEscrow: {
          gasLimit: 300000,
          gasPriceGwei: gasPriceGwei,
          estimatedCostEth: ethers.formatEther(gasPrice * BigInt(300000)),
          estimatedCostUsd: 0 // Would need ETH/USD price
        },
        releaseEscrow: {
          gasLimit: 200000,
          gasPriceGwei: gasPriceGwei,
          estimatedCostEth: ethers.formatEther(gasPrice * BigInt(200000))
        },
        refundEscrow: {
          gasLimit: 200000,
          gasPriceGwei: gasPriceGwei,
          estimatedCostEth: ethers.formatEther(gasPrice * BigInt(200000))
        }
      };

    } catch (error) {
      console.error('Error estimating gas costs:', error);
      return null;
    }
  }
}

module.exports = new SmartContractService();