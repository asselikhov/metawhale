/**
 * Escrow Service
 * Main coordinator for all escrow-related functionality
 * Handles secure escrow functionality for P2P trading
 * Provides maximum security for P2P exchanges with automated dispute resolution
 */

const { User } = require('../../database/models');
const config = require('../../config/configuration');
const CoreEscrowService = require('./core/CoreEscrowService');
const TimeoutEscrowService = require('./core/TimeoutEscrowService');
const StatisticsEscrowService = require('./core/StatisticsEscrowService');
const SmartContractEscrowService = require('./contract/SmartContractEscrowService');
const DisputeEscrowService = require('./dispute/DisputeEscrowService');

class EscrowService {
  constructor() {
    // Load timeout settings from configuration
    this.escrowTimeoutMinutes = config.escrow.timeoutMinutes;
    this.disputeTimeoutMinutes = config.escrow.disputeTimeoutMinutes;
    
    // Check smart contract configuration
    this.useSmartContract = config.escrow.useSmartContract;
    this.escrowContractAddress = config.escrow.contractAddress;
    
    // Initialize specialized services
    this.coreService = new CoreEscrowService(this);
    this.timeoutService = new TimeoutEscrowService(this);
    this.statisticsService = new StatisticsEscrowService(this);
    this.contractService = new SmartContractEscrowService(this);
    this.disputeService = new DisputeEscrowService(this);
    
    // Log current configuration
    this.logConfiguration();
  }

  // Log current escrow configuration
  logConfiguration() {
    console.log('\n🔧 Escrow Service Configuration:');
    console.log('================================');
    
    if (this.useSmartContract) {
      if (this.escrowContractAddress && this.escrowContractAddress !== '') {
        console.log('✅ SECURE MODE: Smart contract escrow ENABLED');
        console.log(`📋 Contract address: ${this.escrowContractAddress}`);
        console.log('🛡️ Tokens will be physically locked in smart contract');
        console.log('🚫 Users CANNOT bypass escrow security');
      } else {
        console.log('⚠️ WARNING: Smart contract enabled but no contract address!');
        console.log('❌ Falling back to DATABASE-ONLY mode (NOT SECURE)');
        this.useSmartContract = false;
      }
    } else {
      console.log('🚨 INSECURE MODE: Database-only escrow');
      console.log('⚠️ Users CAN bypass escrow by exporting private key');
      console.log('🔧 To enable secure mode: SET USE_SMART_CONTRACT_ESCROW=true');
    }
    
    console.log(`⏰ Escrow timeout: ${config.escrow.displayFormat.minutes(this.escrowTimeoutMinutes)}`);
    console.log(`⚖️ Dispute timeout: ${config.escrow.displayFormat.minutes(this.disputeTimeoutMinutes)}`);
    console.log('================================\n');
  }

  // Delegate methods to CoreEscrowService
  async lockTokensInEscrow(userId, tradeId, tokenType, amount) {
    return this.coreService.lockTokensInEscrow(userId, tradeId, tokenType, amount);
  }

  async releaseTokensFromEscrow(userId, tradeId, tokenType, amount, recipientId) {
    return this.coreService.releaseTokensFromEscrow(userId, tradeId, tokenType, amount, recipientId);
  }

  async refundTokensFromEscrow(userId, tradeId, tokenType, amount, reason = 'Trade cancelled') {
    return this.coreService.refundTokensFromEscrow(userId, tradeId, tokenType, amount, reason);
  }

  async updateEscrowTradeId(userId, tokenType, amount, tradeId) {
    return this.coreService.updateEscrowTradeId(userId, tokenType, amount, tradeId);
  }

  async linkEscrowToTrade(userId, tradeId, tokenType, amount) {
    return this.coreService.linkEscrowToTrade(userId, tradeId, tokenType, amount);
  }

  async checkEscrowBalance(userId, tokenType, amount) {
    return this.coreService.checkEscrowBalance(userId, tokenType, amount);
  }

  async getEscrowHistory(userId, limit = 10) {
    return this.coreService.getEscrowHistory(userId, limit);
  }

  // Delegate methods to TimeoutEscrowService
  async handleEscrowTimeout(tradeId) {
    return this.timeoutService.handleEscrowTimeout(tradeId);
  }

  // Delegate methods to StatisticsEscrowService
  async getEscrowStatistics() {
    return this.statisticsService.getEscrowStatistics();
  }

  // Delegate methods to DisputeEscrowService
  async resolveDispute(tradeId, resolution, moderatorId, evidence = {}) {
    return this.disputeService.resolveDispute(tradeId, resolution, moderatorId, evidence);
  }

  async initiateDispute(tradeId, disputerUserId, reason) {
    return this.disputeService.initiateDispute(tradeId, disputerUserId, reason);
  }
}

module.exports = EscrowService;
