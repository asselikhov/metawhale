/**
 * Smart Contract Escrow Service
 * Handles interactions with smart contract-based escrow system
 */

const smartContractService = require('../../smartContractService');

class SmartContractEscrowService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  // Release tokens from smart contract escrow
  async releaseSmartEscrow(escrowId, sellerPrivateKey) {
    try {
      console.log(`🔐 Releasing smart contract escrow ${escrowId}`);
      return await smartContractService.releaseSmartEscrow(escrowId, sellerPrivateKey);
    } catch (error) {
      console.error('Error releasing smart contract escrow:', error);
      throw error;
    }
  }

  // Refund tokens from smart contract escrow
  async refundSmartEscrow(escrowId, userPrivateKey) {
    try {
      console.log(`🔐 Refunding smart contract escrow ${escrowId}`);
      return await smartContractService.refundSmartEscrow(escrowId, userPrivateKey);
    } catch (error) {
      console.error('Error refunding smart contract escrow:', error);
      throw error;
    }
  }

  // Check if escrow can be refunded
  async canRefundEscrow(escrowId) {
    try {
      console.log(`🔍 Checking refund status for smart contract escrow ${escrowId}`);
      return await smartContractService.canRefundEscrow(escrowId);
    } catch (error) {
      console.error('Error checking refund status for smart contract escrow:', error);
      return { canRefund: false, error: error.message };
    }
  }

  // Resolve escrow dispute in smart contract
  async resolveEscrowDispute(escrowId, favorBuyer, adminPrivateKey) {
    try {
      console.log(`⚖️ Resolving smart contract escrow dispute ${escrowId}, favor buyer: ${favorBuyer}`);
      return await smartContractService.resolveEscrowDispute(escrowId, favorBuyer, adminPrivateKey);
    } catch (error) {
      console.error('Error resolving smart contract escrow dispute:', error);
      throw error;
    }
  }

  // Initiate escrow dispute in smart contract
  async initiateEscrowDispute(escrowId, disputerPrivateKey) {
    try {
      console.log(`⚖️ Initiating smart contract escrow dispute ${escrowId}`);
      return await smartContractService.initiateEscrowDispute(escrowId, disputerPrivateKey);
    } catch (error) {
      console.error('Error initiating smart contract escrow dispute:', error);
      throw error;
    }
  }
}

module.exports = SmartContractEscrowService;