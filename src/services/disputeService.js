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
const smartNotificationService = require('./smartNotificationService');
const escrowService = require('./escrowService');
const antiFraudService = require('./antiFraudService');

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

  /**
   * 🚨 ИНИЦИАЦИЯ СПОРА
   * Профессиональный процесс открытия спора с автоматической категоризацией
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
      const canInitiateDispute = await this.validateDisputeRights(trade, initiator._id);
      if (!canInitiateDispute.allowed) {
        throw new Error(canInitiateDispute.reason);
      }
      
      // Проверяем, нет ли уже активного спора
      if (trade.status === 'disputed') {
        throw new Error('По данной сделке уже открыт спор');
      }
      
      // Определяем приоритет спора
      const priority = this.calculateDisputePriority(trade, category, urgency);
      
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
        autoEscalationAt: new Date(Date.now() + this.AUTO_ESCALATION_HOURS * 60 * 60 * 1000),
        participantLastActivity: {
          buyer: new Date(),
          seller: new Date()
        }
      };
      
      await trade.save();
      
      // Назначаем модератора
      const moderator = await this.assignOptimalModerator(trade);
      if (moderator) {
        trade.moderatorId = moderator._id;
        trade.disputeStatus = 'investigating';
        await trade.save();
      }
      
      // Создаем лог действия
      await this.logDisputeAction(tradeId, initiator._id, 'initiated', null, 'open', {
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
        estimatedResolutionTime: this.estimateResolutionTime(priority)
      };
      
    } catch (error) {
      console.error(`❌ [DISPUTE] Error initiating dispute:`, error);
      throw error;
    }
  }

  /**
   * 📝 ПОДАЧА ДОКАЗАТЕЛЬСТВ
   * Позволяет участникам спора предоставлять доказательства
   */
  async submitEvidence(tradeId, userChatId, evidenceType, content, description) {
    try {
      console.log(`📝 [DISPUTE] Submitting evidence for trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
        
      if (!trade || trade.status !== 'disputed') {
        throw new Error('Спор не найден или неактивен');
      }
      
      const user = await User.findOne({ chatId: userChatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Определяем роль пользователя
      const userRole = trade.buyerId._id.toString() === user._id.toString() ? 'buyer' : 'seller';
      
      if (trade.buyerId._id.toString() !== user._id.toString() && 
          trade.sellerId._id.toString() !== user._id.toString()) {
        throw new Error('Только участники сделки могут предоставлять доказательства');
      }
      
      // Добавляем доказательство
      const evidence = {
        type: evidenceType,
        content,
        description,
        submittedAt: new Date()
      };
      
      if (!trade.disputeEvidence) {
        trade.disputeEvidence = { buyerEvidence: [], sellerEvidence: [], moderatorNotes: [] };
      }
      
      if (userRole === 'buyer') {
        trade.disputeEvidence.buyerEvidence.push(evidence);
      } else {
        trade.disputeEvidence.sellerEvidence.push(evidence);
      }
      
      // Обновляем активность участника
      trade.disputeTracking.participantLastActivity[userRole] = new Date();
      
      // Обновляем статус спора
      if (trade.disputeStatus === 'awaiting_evidence') {
        trade.disputeStatus = 'under_review';
      }
      
      await trade.save();
      
      // Логируем действие
      await this.logDisputeAction(tradeId, user._id, 'evidence_submitted', null, null, {
        evidenceType,
        userRole,
        description
      });
      
      // Уведомляем модератора о новых доказательствах
      if (trade.moderatorId) {
        await this.notifyModeratorNewEvidence(trade, user, evidence);
      }
      
      console.log(`✅ [DISPUTE] Evidence submitted for trade ${tradeId} by ${userRole}`);
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ [DISPUTE] Error submitting evidence:`, error);
      throw error;
    }
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
      await this.updateModeratorStatistics(moderator._id, trade);
      
      await trade.save();
      
      // Логируем разрешение
      await this.logDisputeAction(tradeId, moderator._id, 'resolved', null, 'resolved', {
        resolution,
        compensationAmount,
        notes,
        resolutionTimeMinutes: this.calculateResolutionTime(trade)
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
   * 📊 АВТОМАТИЧЕСКОЕ НАЗНАЧЕНИЕ МОДЕРАТОРА
   * Оптимальное распределение нагрузки между модераторами
   */
  async assignOptimalModerator(trade) {
    try {
      // Находим доступных модераторов
      const availableModerators = await Moderator.find({
        isActive: true,
        'availability.isOnline': true,
        'statistics.currentWorkload': { $lt: this.MODERATOR_CONFIG.maxConcurrentDisputes }
      }).populate('userId');
      
      if (availableModerators.length === 0) {
        console.warn('⚠️ [DISPUTE] No available moderators found');
        return null;
      }
      
      // Находим модератора со специализацией по категории спора
      let selectedModerator = availableModerators.find(mod => 
        mod.specializations.includes(this.mapCategoryToSpecialization(trade.disputeCategory))
      );
      
      // Если специалиста нет, выбираем по наименьшей нагрузке
      if (!selectedModerator) {
        selectedModerator = availableModerators.reduce((best, current) =>
          current.statistics.currentWorkload < best.statistics.currentWorkload ? current : best
        );
      }
      
      // Обновляем нагрузку модератора
      selectedModerator.statistics.currentWorkload += 1;
      await selectedModerator.save();
      
      console.log(`👨‍⚖️ [DISPUTE] Assigned moderator ${selectedModerator.userId.chatId} to trade ${trade._id}`);
      
      return selectedModerator.userId;
      
    } catch (error) {
      console.error('❌ [DISPUTE] Error assigning moderator:', error);
      return null;
    }
  }

  /**
   * 🔄 АВТОЭСКАЛАЦИЯ ПРОСРОЧЕННЫХ СПОРОВ
   * Автоматическая эскалация неразрешенных споров
   */
  async processAutoEscalation() {
    try {
      console.log('🔄 [DISPUTE] Processing auto-escalation checks...');
      
      const now = new Date();
      
      // Находим споры, требующие эскалации
      const disputesToEscalate = await P2PTrade.find({
        status: 'disputed',
        disputeStatus: { $in: ['open', 'investigating'] },
        'disputeTracking.autoEscalationAt': { $lte: now },
        'disputeTracking.escalatedAt': { $exists: false }
      }).populate('buyerId').populate('sellerId').populate('moderatorId');
      
      for (const trade of disputesToEscalate) {
        await this.escalateDispute(trade);
      }
      
      console.log(`✅ [DISPUTE] Auto-escalation completed. Processed ${disputesToEscalate.length} disputes`);
      
    } catch (error) {
      console.error('❌ [DISPUTE] Error in auto-escalation:', error);
    }
  }

  /**
   * 📈 ЭСКАЛАЦИЯ СПОРА
   * Повышение приоритета и перенаправление к старшему модератору
   */
  async escalateDispute(trade) {
    try {
      console.log(`📈 [DISPUTE] Escalating dispute ${trade._id}`);
      
      // Повышаем приоритет
      const currentPriorityIndex = ['low', 'medium', 'high', 'urgent'].indexOf(trade.disputePriority);
      if (currentPriorityIndex < 3) {
        trade.disputePriority = ['low', 'medium', 'high', 'urgent'][currentPriorityIndex + 1];
      }
      
      trade.disputeTracking.escalatedAt = new Date();
      
      // Переназначаем на старшего модератора если возможно
      const seniorModerator = await this.findSeniorModerator();
      if (seniorModerator && (!trade.moderatorId || trade.moderatorId._id.toString() !== seniorModerator._id.toString())) {
        // Освобождаем предыдущего модератора
        if (trade.moderatorId) {
          await this.updateModeratorWorkload(trade.moderatorId, -1);
        }
        
        trade.moderatorId = seniorModerator._id;
        await this.updateModeratorWorkload(seniorModerator._id, 1);
      }
      
      await trade.save();
      
      // Логируем эскалацию
      await this.logDisputeAction(trade._id, null, 'escalated', null, null, {
        newPriority: trade.disputePriority,
        reassignedModerator: !!seniorModerator
      });
      
      // Уведомляем о эскалации
      await this.notifyDisputeEscalated(trade);
      
    } catch (error) {
      console.error(`❌ [DISPUTE] Error escalating dispute:`, error);
    }
  }

  /**
   * 📊 ПОЛУЧЕНИЕ СТАТИСТИКИ СПОРОВ
   * Комплексная аналитика для администраторов
   */
  async getDisputeStatistics(timeframe = '30d') {
    try {
      const startDate = this.getStartDateForTimeframe(timeframe);
      
      const [
        totalDisputes,
        resolvedDisputes,
        activeDisputes,
        categoryBreakdown,
        resolutionStats,
        moderatorStats
      ] = await Promise.all([
        P2PTrade.countDocuments({
          status: 'disputed',
          'disputeTracking.openedAt': { $gte: startDate }
        }),
        P2PTrade.countDocuments({
          disputeStatus: 'resolved',
          'disputeTracking.openedAt': { $gte: startDate }
        }),
        P2PTrade.countDocuments({
          status: 'disputed',
          disputeStatus: { $in: ['open', 'investigating', 'under_review'] }
        }),
        this.getDisputeCategoryBreakdown(startDate),
        this.getResolutionStatistics(startDate),
        this.getModeratorStatistics()
      ]);
      
      return {
        timeframe,
        overview: {
          totalDisputes,
          resolvedDisputes,
          activeDisputes,
          resolutionRate: totalDisputes > 0 ? (resolvedDisputes / totalDisputes * 100).toFixed(1) : 0
        },
        categoryBreakdown,
        resolutionStats,
        moderatorStats
      };
      
    } catch (error) {
      console.error('❌ [DISPUTE] Error getting statistics:', error);
      throw error;
    }
  }

  // ========================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ========================

  /**
   * Валидация прав на открытие спора
   */
  async validateDisputeRights(trade, userId) {
    // Проверяем, является ли пользователь участником сделки
    const isParticipant = trade.buyerId._id.toString() === userId.toString() || 
                         trade.sellerId._id.toString() === userId.toString();
    
    if (!isParticipant) {
      return { allowed: false, reason: 'Только участники сделки могут открыть спор' };
    }
    
    // Проверяем статус сделки
    const allowedStatuses = ['payment_made', 'payment_pending', 'escrow_locked'];
    if (!allowedStatuses.includes(trade.status)) {
      return { allowed: false, reason: 'Спор можно открыть только для активных сделок' };
    }
    
    return { allowed: true };
  }

  /**
   * Расчет приоритета спора
   */
  calculateDisputePriority(trade, category, urgency) {
    const amount = trade.totalValue;
    
    // Базовый приоритет по сумме
    let priority = 'low';
    if (amount >= this.PRIORITY_THRESHOLDS.urgent) priority = 'urgent';
    else if (amount >= this.PRIORITY_THRESHOLDS.high) priority = 'high';
    else if (amount >= this.PRIORITY_THRESHOLDS.medium) priority = 'medium';
    
    // Повышаем приоритет для определенных категорий
    if (category === 'fraud_attempt') priority = 'urgent';
    if (category === 'payment_not_received' && urgency === 'high') {
      const priorityIndex = ['low', 'medium', 'high', 'urgent'].indexOf(priority);
      if (priorityIndex < 3) priority = ['low', 'medium', 'high', 'urgent'][priorityIndex + 1];
    }
    
    return priority;
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

  /**
   * Логирование действий в споре
   */
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

  /**
   * Расчет времени разрешения спора
   */
  calculateResolutionTime(trade) {
    if (!trade.disputeTracking.openedAt || !trade.disputeTracking.resolvedAt) {
      return null;
    }
    
    const diffMs = trade.disputeTracking.resolvedAt - trade.disputeTracking.openedAt;
    return Math.round(diffMs / (1000 * 60)); // возвращаем в минутах
  }

  /**
   * Оценка времени разрешения
   */
  estimateResolutionTime(priority) {
    const estimates = {
      urgent: '2-4 часа',
      high: '4-12 часов',
      medium: '12-24 часа',
      low: '24-48 часов'
    };
    
    return estimates[priority] || '24-48 часов';
  }

  /**
   * Маппинг категорий на специализации модераторов
   */
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

  /**
   * Получение начальной даты для временного периода
   */
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

  /**
   * Поиск старшего модератора
   */
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

  /**
   * Обновление нагрузки модератора
   */
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

  /**
   * Обновление статистики модератора
   */
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

  // ========================
  // УВЕДОМЛЕНИЯ
  // ========================

  async notifyDisputeInitiated(trade, initiator) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }

  async notifyModeratorNewEvidence(trade, submitter, evidence) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }

  async notifyDisputeResolved(trade, resolution) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }

  async notifyDisputeEscalated(trade) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }

  async runFraudAnalysis(trade, initiator) {
    // Запуск анализа мошенничества будет добавлен позже
  }

  // Заглушки для методов статистики (будут реализованы позже)
  async getDisputeCategoryBreakdown(startDate) { return {}; }
  async getResolutionStatistics(startDate) { return {}; }
  async getModeratorStatistics() { return {}; }
}

module.exports = new DisputeService();