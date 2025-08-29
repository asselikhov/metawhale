/**
 * Timeout Escrow Service
 * Handles timeout processing for escrow transactions
 */

const { P2PTrade } = require('../../../database/models');

class TimeoutEscrowService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  // Automated escrow timeout handler
  async handleEscrowTimeout(tradeId) {
    try {
      console.log(`⏰ Handling escrow timeout for trade ${tradeId}`);

      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');

      if (!trade) {
        console.log(`Trade ${tradeId} not found`);
        return;
      }

      if (trade.status === 'completed') {
        console.log(`Trade ${tradeId} already completed`);
        return;
      }

      // Check if payment was confirmed
      if (trade.status === 'payment_confirmed') {
        // Release tokens to buyer
        await this.parentService.releaseTokensFromEscrow(
          trade.sellerId._id,
          tradeId,
          'CES',
          trade.amount,
          trade.buyerId._id
        );

        trade.status = 'completed';
        trade.escrowStatus = 'released';
        trade.timeTracking.completedAt = new Date();
        await trade.save();

        console.log(`✅ Trade ${tradeId} completed after timeout with payment confirmation`);

      } else {
        // Refund tokens to seller
        await this.parentService.refundTokensFromEscrow(
          trade.sellerId._id,
          tradeId,
          'CES',
          trade.amount,
          'Trade timeout - payment not confirmed'
        );

        trade.status = 'cancelled';
        trade.escrowStatus = 'returned';
        await trade.save();

        console.log(`↩️ Trade ${tradeId} cancelled and refunded after timeout`);
      }

    } catch (error) {
      console.error('Error handling escrow timeout:', error);
    }
  }
}

module.exports = TimeoutEscrowService;