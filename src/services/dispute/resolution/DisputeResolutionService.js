/**
 * Dispute Resolution Service
 * Handles the resolution of disputes by moderators
 */

const { P2PTrade, User } = require('../../../database/models');
const escrowService = require('../../escrow/escrowServiceInstance');

class DisputeResolutionService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  /**
   * ⚖️ РАЗРЕШЕНИЕ СПОРА МОДЕРАТОРОМ
   * Профессиональное разрешение с подробным анализом
   */
  async resolveDispute(tradeId, moderatorChatId, resolution, compensationAmount = null, notes = '') {
    try {
      console.log(`⚖️ [DISPUTE] Resolving dispute ${tradeId} with outcome: ${resolution}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId')
        .populate('moderatorId');
        
      if (!trade || trade.status !== 'disputed') {
        throw new Error('Спор не найден или неактивен');
      }
      
      const moderator = await User.findOne({ chatId: moderatorChatId });
      if (!moderator || !trade.moderatorId || trade.moderatorId._id.toString() !== moderator._id.toString()) {
        throw new Error('Недостаточно прав для разрешения спора');
      }
      
      // Валидируем решение
      const validResolutions = ['buyer_wins', 'seller_wins', 'compromise', 'no_fault', 'insufficient_evidence'];
      if (!validResolutions.includes(resolution)) {
        throw new Error('Неверный тип разрешения спора');
      }
      
      // Обновляем информацию о разрешении
      trade.disputeResolution = {
        outcome: resolution,
        compensationAmount,
        resolutionNotes: notes,
        appealable: true,
        appealDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 часов на апелляцию
      };
      
      trade.disputeStatus = 'resolved';
      trade.disputeTracking.resolvedAt = new Date();
      
      // Выполняем финансовые операции в зависимости от решения
      await this.executeDisputeResolution(trade, resolution, compensationAmount);
      
      // Обновляем статистику модератора
      await this.parentService.updateModeratorStatistics(moderator._id, trade);
      
      await trade.save();
      
      // Логируем разрешение
      await this.parentService.logDisputeAction(tradeId, moderator._id, 'resolved', null, 'resolved', {
        resolution,
        compensationAmount,
        notes,
        resolutionTimeMinutes: this.parentService.calculateResolutionTime(trade)
      });
      
      // Уведомляем всех участников о решении
      await this.notifyDisputeResolved(trade, resolution);
      
      console.log(`✅ [DISPUTE] Dispute ${tradeId} resolved: ${resolution}`);
      
      return {
        success: true,
        resolution,
        appealDeadline: trade.disputeResolution.appealDeadline
      };
      
    } catch (error) {
      console.error(`❌ [DISPUTE] Error resolving dispute:`, error);
      throw error;
    }
  }

  /**
   * Выполнение финансовых операций при разрешении спора
   */
  async executeDisputeResolution(trade, resolution, compensationAmount) {
    try {
      switch (resolution) {
        case 'buyer_wins':
          // Покупатель получает токены, продавец не получает оплату
          await escrowService.releaseTokensFromEscrow(
            trade.sellerId._id,
            trade._id,
            'CES',
            trade.amount,
            trade.buyerId._id,
            'Dispute resolved in favor of buyer'
          );
          trade.status = 'completed';
          trade.escrowStatus = 'released';
          break;
          
        case 'seller_wins':
          // Продавец получает токены обратно, покупатель не получает возврат
          await escrowService.refundTokensFromEscrow(
            trade.sellerId._id,
            trade._id,
            'CES',
            trade.amount,
            'Dispute resolved in favor of seller'
          );
          trade.status = 'cancelled';
          trade.escrowStatus = 'returned';
          break;
          
        case 'compromise':
          // Частичная компенсация или разделение токенов
          if (compensationAmount && compensationAmount > 0 && compensationAmount < trade.amount) {
            await escrowService.releaseTokensFromEscrow(
              trade.sellerId._id,
              trade._id + '_partial',
              'CES',
              compensationAmount,
              trade.buyerId._id,
              'Compromise resolution - partial release'
            );
            
            await escrowService.refundTokensFromEscrow(
              trade.sellerId._id,
              trade._id + '_refund',
              'CES',
              trade.amount - compensationAmount,
              'Compromise resolution - partial refund'
            );
          }
          trade.status = 'completed';
          trade.escrowStatus = 'compromised';
          break;
          
        case 'no_fault':
        case 'insufficient_evidence':
          // Возвращаем токены продавцу, так как вины не установлено
          await escrowService.refundTokensFromEscrow(
            trade.sellerId._id,
            trade._id,
            'CES',
            trade.amount,
            'Dispute resolved - no fault found'
          );
          trade.status = 'cancelled';
          trade.escrowStatus = 'returned';
          break;
      }
    } catch (error) {
      console.error('❌ [DISPUTE] Error executing dispute resolution:', error);
      throw error;
    }
  }

  // Уведомления будут реализованы в DisputeHandler
  async notifyDisputeResolved(trade, resolution) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }
}

module.exports = DisputeResolutionService;