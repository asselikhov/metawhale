/**
 * Dispute Escrow Service
 * Handles dispute resolution for escrow transactions
 */

const { User, P2PTrade } = require('../../../database/models');
const smartContractService = require('../../smartContractService');

class DisputeEscrowService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  // Manual dispute resolution
  async resolveDispute(tradeId, resolution, moderatorId, evidence = {}) {
    try {
      console.log(`⚖️ Resolving dispute for trade ${tradeId}, resolution: ${resolution}`);

      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');

      if (!trade) {
        throw new Error('Сделка не найдена');
      }

      if (trade.status !== 'disputed' && trade.status !== 'payment_made') {
        // Allow dispute resolution for payment_made status as well
        trade.status = 'disputed';
        trade.timeTracking.disputeInitiatedAt = new Date();
      }

      trade.moderatorId = moderatorId;
      
      // Store evidence if provided
      if (evidence.buyerEvidence || evidence.sellerEvidence) {
        trade.disputeEvidence = {
          buyer: evidence.buyerEvidence || [],
          seller: evidence.sellerEvidence || [],
          analyzedAt: new Date()
        };
      }

      if (resolution === 'buyer_wins') {
        // Check if using smart contract escrow
        if (this.parentService.useSmartContract && trade.smartContractEscrowId) {
          console.log('🔗 Using smart contract dispute resolution');
          const smartContractService = require('../../contract/SmartContractEscrowService');
          const contractService = new smartContractService(this.parentService);
          await contractService.resolveEscrowDispute(
            trade.smartContractEscrowId,
            true, // favorBuyer = true
            process.env.ADMIN_PRIVATE_KEY
          );
        } else {
          // Release tokens to buyer using traditional escrow
          await this.parentService.releaseTokensFromEscrow(
            trade.sellerId._id,
            tradeId,
            'CES',
            trade.amount,
            trade.buyerId._id
          );
        }

        trade.status = 'completed';
        trade.escrowStatus = 'released';
        trade.disputeResolution = 'buyer_wins';
        
        // Validate balances after resolution
        await this.validateBalancesAfterResolution(trade.buyerId._id, trade.sellerId._id);

      } else if (resolution === 'seller_wins') {
        // Check if using smart contract escrow
        if (this.parentService.useSmartContract && trade.smartContractEscrowId) {
          console.log('🔗 Using smart contract dispute resolution');
          const smartContractService = require('../../contract/SmartContractEscrowService');
          const contractService = new smartContractService(this.parentService);
          await contractService.resolveEscrowDispute(
            trade.smartContractEscrowId,
            false, // favorBuyer = false
            process.env.ADMIN_PRIVATE_KEY
          );
        } else {
          // Refund tokens to seller
          await this.parentService.refundTokensFromEscrow(
            trade.sellerId._id,
            tradeId,
            'CES',
            trade.amount,
            'Dispute resolved in favor of seller'
          );
        }

        trade.status = 'cancelled';
        trade.escrowStatus = 'returned';
        trade.disputeResolution = 'seller_wins';
        
        // Validate balances after resolution
        await this.validateBalancesAfterResolution(trade.sellerId._id, trade.buyerId._id);
        
      } else if (resolution === 'compromise') {
        // Handle compromise resolution - split tokens or partial refund
        const compromiseAmount = trade.amount * 0.5; // 50/50 split by default
        
        if (this.parentService.useSmartContract && trade.smartContractEscrowId) {
          throw new Error('Compromise resolution not yet supported for smart contract escrow');
        }
        
        // Split tokens between buyer and seller
        await this.parentService.releaseTokensFromEscrow(
          trade.sellerId._id,
          tradeId,
          'CES',
          compromiseAmount,
          trade.buyerId._id
        );
        
        await this.parentService.refundTokensFromEscrow(
          trade.sellerId._id,
          tradeId + '_compromise',
          'CES',
          trade.amount - compromiseAmount,
          'Compromise resolution - partial refund'
        );
        
        trade.status = 'completed';
        trade.escrowStatus = 'compromised';
        trade.disputeResolution = 'compromise';
        
        // Validate balances after resolution
        await this.validateBalancesAfterResolution(trade.buyerId._id, trade.sellerId._id);
        
      } else if (resolution === 'investigate') {
        // Extend investigation period
        trade.disputeReason = evidence.reason || 'Extended investigation required';
        trade.timeTracking.investigationExtendedAt = new Date();
        
        // Extend expiry by 7 days
        if (trade.timeTracking.expiresAt) {
          trade.timeTracking.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
        
        console.log('⏸️ Investigation period extended by 7 days');
      }

      trade.timeTracking.completedAt = new Date();
      await trade.save();

      console.log(`✅ Dispute resolved for trade ${tradeId}: ${resolution}`);
      return trade;

    } catch (error) {
      console.error('Error resolving dispute:', error);
      throw error;
    }
  }

  // Initiate dispute for a trade
  async initiateDispute(tradeId, disputerUserId, reason) {
    try {
      console.log(`⚖️ Initiating dispute for trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        throw new Error('Сделка не найдена');
      }
      
      // Verify disputer is participant
      const isParticipant = 
        trade.buyerId._id.toString() === disputerUserId.toString() ||
        trade.sellerId._id.toString() === disputerUserId.toString();
      
      if (!isParticipant) {
        throw new Error('Только участники сделки могут инициировать спор');
      }
      
      if (!['escrow_locked', 'payment_made', 'payment_pending'].includes(trade.status)) {
        throw new Error('Нельзя инициировать спор для этой сделки');
      }
      
      // Update trade status
      trade.status = 'disputed';
      trade.disputeReason = reason;
      trade.disputeInitiatorId = disputerUserId;
      trade.timeTracking.disputeInitiatedAt = new Date();
      
      // If smart contract escrow, initiate dispute there too
      if (this.parentService.useSmartContract && trade.smartContractEscrowId) {
        try {
          const smartContractService = require('../../contract/SmartContractEscrowService');
          const contractService = new smartContractService(this.parentService);
          const disputer = await User.findById(disputerUserId);
          
          if (disputer && disputer.privateKey) {
            await contractService.initiateEscrowDispute(
              trade.smartContractEscrowId,
              disputer.privateKey
            );
            console.log('⚖️ Dispute initiated in smart contract');
          }
        } catch (contractError) {
          console.warn('⚠️ Failed to initiate dispute in smart contract:', contractError.message);
        }
      }
      
      await trade.save();
      
      console.log(`✅ Dispute initiated for trade ${tradeId}`);
      return trade;
      
    } catch (error) {
      console.error('Error initiating dispute:', error);
      throw error;
    }
  }

  // Validate balances after dispute resolution
  async validateBalancesAfterResolution(userId1, userId2) {
    try {
      console.log('🔍 Validating balances after dispute resolution...');
      
      // Import balance validation service if available
      try {
        const balanceValidationService = require('../../validation/BalanceValidationService');
        const validationService = new balanceValidationService(this.parentService);
        await validationService.validateAfterEscrowOperation(userId1, 'dispute_resolution', 0, 'CES');
        await validationService.validateAfterEscrowOperation(userId2, 'dispute_resolution', 0, 'CES');
        console.log('✅ Balance validation completed successfully');
      } catch (validationError) {
        console.warn('⚠️ Balance validation service not available or failed:', validationError.message);
        
        // Manual balance check as fallback
        const user1 = await User.findById(userId1);
        const user2 = await User.findById(userId2);
        
        if (user1) {
          const totalBalance1 = (user1.cesBalance || 0) + (user1.escrowCESBalance || 0);
          console.log(`📈 User ${userId1} total balance: ${totalBalance1} CES`);
        }
        
        if (user2) {
          const totalBalance2 = (user2.cesBalance || 0) + (user2.escrowCESBalance || 0);
          console.log(`📈 User ${userId2} total balance: ${totalBalance2} CES`);
        }
      }
      
    } catch (error) {
      console.error('Error validating balances after dispute resolution:', error);
      // Don't throw - this is just for monitoring
    }
  }
}

module.exports = DisputeEscrowService;