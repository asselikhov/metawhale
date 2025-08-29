/**
 * 🏛️ PROFESSIONAL DISPUTE MANAGEMENT SERVICE
 * 
 * Provides comprehensive dispute resolution for P2P trades including:
 * - Automated dispute workflow
 * - Evidence collection and management
 * - Moderator assignment and workload balancing
 * - Multi-level escalation system
 * - Smart resolution algorithms
 * - Comprehensive audit trails
 */

const { P2PTrade, User, DisputeLog, Moderator } = require('../database/models');
const smartNotificationService = require('../notification/smartNotificationService');
const escrowService = require('../escrow/escrowServiceInstance');
const antiFraudService = require('../utility/antiFraudService');

class DisputeService {
  constructor() {
    // Временные лимиты для эскалации
    this.AUTO_ESCALATION_HOURS = 24;
    this.URGENT_ESCALATION_HOURS = 4;
    this.MAX_RESOLUTION_DAYS = 7;
    
    // Приоритеты споров
    this.PRIORITY_THRESHOLDS = {
      urgent: 10000,     // Сумма свыше 10,000 ₽
      high: 5000,        // Сумма свыше 5,000 ₽
      medium: 1000,      // Сумма свыше 1,000 ₽ 
      low: 0             // Остальные
    };
    
    // Конфигурация модераторов
    this.MODERATOR_CONFIG = {
      maxConcurrentDisputes: 5,
      maxWorkloadScore: 100,
      responseTimeExpected: 30 // минут
    };
  }

  // Main public methods that delegate to specialized services
  async initiateDispute(tradeId, initiatorChatId, category, reason, urgency = 'medium') {
    const DisputeInitiationService = require('./DisputeInitiationService');
    const service = new DisputeInitiationService(this);
    return service.initiateDispute(tradeId, initiatorChatId, category, reason, urgency);
  }

  async submitEvidence(tradeId, userChatId, evidenceType, content, description) {
    const EvidenceService = require('./EvidenceService');
    const service = new EvidenceService(this);
    return service.submitEvidence(tradeId, userChatId, evidenceType, content, description);
  }

  async resolveDispute(tradeId, moderatorChatId, resolution, compensationAmount = null, notes = '') {
    const DisputeResolutionService = require('./resolution/DisputeResolutionService');
    const service = new DisputeResolutionService(this);
    return service.resolveDispute(tradeId, moderatorChatId, resolution, compensationAmount, notes);
  }

  async processAutoEscalation() {
    const EscalationService = require('./moderation/EscalationService');
    const service = new EscalationService(this);
    return service.processAutoEscalation();
  }

  async escalateDispute(trade) {
    const EscalationService = require('./moderation/EscalationService');
    const service = new EscalationService(this);
    return service.escalateDispute(trade);
  }

  async assignOptimalModerator(trade) {
    const ModeratorAssignmentService = require('./moderation/ModeratorAssignmentService');
    const service = new ModeratorAssignmentService(this);
    return service.assignOptimalModerator(trade);
  }

  // Utility methods that are shared across services
  async validateDisputeRights(trade, userId) {
    try {
      // Только покупатель или продавец могут открыть спор
      if (trade.buyerId._id.toString() !== userId.toString() && 
          trade.sellerId._id.toString() !== userId.toString()) {
        return { allowed: false, reason: 'Только участники сделки могут открыть спор' };
      }
      
      // Сделка должна быть в статусе, где можно открыть спор
      const validStatuses = ['escrow_locked', 'payment_pending', 'disputed'];
      if (!validStatuses.includes(trade.status)) {
        return { allowed: false, reason: 'Сделка находится в статусе, где нельзя открыть спор' };
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Ошибка проверки прав на открытие спора:', error);
      return { allowed: false, reason: 'Ошибка проверки прав' };
    }
  }

  calculateDisputePriority(trade, category, urgency) {
    try {
      const totalValue = trade.totalValue;
      
      // Определяем приоритет по сумме
      let amountPriority = 'low';
      if (totalValue >= this.PRIORITY_THRESHOLDS.urgent) {
        amountPriority = 'urgent';
      } else if (totalValue >= this.PRIORITY_THRESHOLDS.high) {
        amountPriority = 'high';
      } else if (totalValue >= this.PRIORITY_THRESHOLDS.medium) {
        amountPriority = 'medium';
      }
      
      // Определяем приоритет по срочности
      const urgencyPriority = urgency;
      
      // Определяем приоритет по категории
      let categoryPriority = 'medium';
      const urgentCategories = ['fraud_attempt', 'technical_issue'];
      const lowPriorityCategories = ['other'];
      
      if (urgentCategories.includes(category)) {
        categoryPriority = 'high';
      } else if (lowPriorityCategories.includes(category)) {
        categoryPriority = 'low';
      }
      
      // Выбираем наивысший приоритет
      const priorities = ['low', 'medium', 'high', 'urgent'];
      const maxPriorityIndex = Math.max(
        priorities.indexOf(amountPriority),
        priorities.indexOf(urgencyPriority),
        priorities.indexOf(categoryPriority)
      );
      
      return priorities[maxPriorityIndex];
    } catch (error) {
      console.error('Ошибка расчета приоритета спора:', error);
      return 'medium';
    }
  }

  async logDisputeAction(tradeId, userId, action, previousState, newState, metadata) {
    try {
      const log = new DisputeLog({
        tradeId,
        userId,
        action,
        previousState,
        newState,
        metadata,
        timestamp: new Date()
      });
      
      await log.save();
    } catch (error) {
      console.error('❌ [DISPUTE] Error logging action:', error);
    }
  }

  calculateResolutionTime(trade) {
    if (!trade.disputeTracking.openedAt || !trade.disputeTracking.resolvedAt) {
      return null;
    }
    
    const diffMs = trade.disputeTracking.resolvedAt - trade.disputeTracking.openedAt;
    return Math.round(diffMs / (1000 * 60)); // возвращаем в минутах
  }

  estimateResolutionTime(priority) {
    const estimates = {
      urgent: '2-4 часа',
      high: '4-12 часов',
      medium: '12-24 часа',
      low: '24-48 часов'
    };
    
    return estimates[priority] || '24-48 часов';
  }

  mapCategoryToSpecialization(category) {
    const mapping = {
      'payment_not_received': 'payment_disputes',
      'payment_not_made': 'payment_disputes',
      'wrong_amount': 'payment_disputes',
      'fraud_attempt': 'fraud_prevention',
      'technical_issue': 'technical_issues',
      'other': 'general'
    };
    
    return mapping[category] || 'general';
  }

  getStartDateForTimeframe(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '24h': return new Date(now - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
      case '90d': return new Date(now - 90 * 24 * 60 * 60 * 1000);
      default: return new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
  }

  async findSeniorModerator() {
    try {
      return await Moderator.findOne({
        isActive: true,
        'statistics.successRate': { $gte: 80 },
        'statistics.totalDisputes': { $gte: 50 },
        'statistics.currentWorkload': { $lt: this.MODERATOR_CONFIG.maxConcurrentDisputes }
      }).populate('userId').sort({ 'statistics.successRate': -1, 'statistics.totalDisputes': -1 });
    } catch (error) {
      console.error('❌ [DISPUTE] Error finding senior moderator:', error);
      return null;
    }
  }

  async updateModeratorWorkload(moderatorId, change) {
    try {
      await Moderator.updateOne(
        { userId: moderatorId },
        { $inc: { 'statistics.currentWorkload': change } }
      );
    } catch (error) {
      console.error('❌ [DISPUTE] Error updating moderator workload:', error);
    }
  }

  async updateModeratorStatistics(moderatorId, trade) {
    try {
      const moderator = await Moderator.findOne({ userId: moderatorId });
      if (!moderator) return;
      
      moderator.statistics.resolvedDisputes += 1;
      moderator.statistics.currentWorkload = Math.max(0, moderator.statistics.currentWorkload - 1);
      
      // Расчет среднего времени разрешения
      const resolutionTimeMinutes = this.calculateResolutionTime(trade);
      if (resolutionTimeMinutes) {
        const totalTime = moderator.statistics.averageResolutionTime * (moderator.statistics.resolvedDisputes - 1);
        moderator.statistics.averageResolutionTime = (totalTime + resolutionTimeMinutes) / moderator.statistics.resolvedDisputes;
      }
      
      // Расчет процента успешных разрешений
      moderator.statistics.successRate = (moderator.statistics.resolvedDisputes / moderator.statistics.totalDisputes) * 100;
      
      await moderator.save();
    } catch (error) {
      console.error('❌ [DISPUTE] Error updating moderator statistics:', error);
    }
  }

  // Заглушки для методов статистики (будут реализованы позже)
  async getDisputeCategoryBreakdown(startDate) { return {}; }
  async getResolutionStatistics(startDate) { return {}; }
  async getModeratorStatistics() { return {}; }
}

module.exports = DisputeService;