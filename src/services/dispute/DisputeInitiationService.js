/**
 * Dispute Initiation Service
 * Handles the initiation of disputes for P2P trades
 */

const { P2PTrade, User } = require('../../database/models');
const escrowService = require('../escrow/escrowServiceInstance');
const antiFraudService = require('../utility/antiFraudService');

class DisputeInitiationService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  /**
   * 🚨 ИНИЦИАЦИЯ СПОРА
   * Профессиональный процесс открытия спора с автоматической categorизацией
   */
  async initiateDispute(tradeId, initiatorChatId, category, reason, urgency = 'medium') {
    try {
      console.log(`🚨 [DISPUTE] Initiating dispute for trade ${tradeId} by user ${initiatorChatId}`);
      
      // Получаем данные сделки
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
        
      if (!trade) {
        throw new Error('Сделка не найдена');
      }
      
      // Находим инициатора
      const initiator = await User.findOne({ chatId: initiatorChatId });
      if (!initiator) {
        throw new Error('Пользователь не найден');
      }
      
      // Проверяем права на открытие спора
      const canInitiateDispute = await this.parentService.validateDisputeRights(trade, initiator._id);
      if (!canInitiateDispute.allowed) {
        throw new Error(canInitiateDispute.reason);
      }
      
      // Проверяем, нет ли уже активного спора
      if (trade.status === 'disputed') {
        throw new Error('По данной сделке уже открыт спор');
      }
      
      // Определяем приоритет спора
      const priority = this.parentService.calculateDisputePriority(trade, category, urgency);
      
      // Обновляем сделку
      trade.status = 'disputed';
      trade.disputeInitiatorId = initiator._id;
      trade.disputeCategory = category;
      trade.disputeReason = reason;
      trade.disputePriority = priority;
      trade.disputeStatus = 'open';
      
      // Инициализируем отслеживание времени
      trade.disputeTracking = {
        openedAt: new Date(),
        autoEscalationAt: new Date(Date.now() + this.parentService.AUTO_ESCALATION_HOURS * 60 * 60 * 1000),
        participantLastActivity: {
          buyer: new Date(),
          seller: new Date()
        }
      };
      
      await trade.save();
      
      // Назначаем модератора
      const moderator = await this.parentService.assignOptimalModerator(trade);
      if (moderator) {
        trade.moderatorId = moderator._id;
        trade.disputeStatus = 'investigating';
        await trade.save();
      }
      
      // Создаем лог действия
      await this.parentService.logDisputeAction(tradeId, initiator._id, 'initiated', null, 'open', {
        category,
        reason,
        priority,
        moderatorAssigned: !!moderator
      });
      
      // Уведомляем всех участников
      await this.notifyDisputeInitiated(trade, initiator);
      
      // Запускаем анализ мошенничества
      this.runFraudAnalysis(trade, initiator);
      
      console.log(`✅ [DISPUTE] Dispute ${tradeId} initiated successfully with priority: ${priority}`);
      
      return {
        success: true,
        disputeId: tradeId,
        priority,
        moderatorAssigned: !!moderator,
        estimatedResolutionTime: this.parentService.estimateResolutionTime(priority)
      };
      
    } catch (error) {
      console.error(`❌ [DISPUTE] Error initiating dispute:`, error);
      throw error;
    }
  }

  // Уведомления будут реализованы в DisputeHandler
  async notifyDisputeInitiated(trade, initiator) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }

  async runFraudAnalysis(trade, initiator) {
    // Запуск анализа мошенничества будет добавлен позже
  }
}

module.exports = DisputeInitiationService;