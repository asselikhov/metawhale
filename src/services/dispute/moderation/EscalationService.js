/**
 * Escalation Service
 * Handles escalation of disputes when they are not resolved in time
 */

const { P2PTrade } = require('../../database/models');

class EscalationService {
  constructor(parentService) {
    this.parentService = parentService;
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
      const seniorModerator = await this.parentService.findSeniorModerator();
      if (seniorModerator && (!trade.moderatorId || trade.moderatorId._id.toString() !== seniorModerator._id.toString())) {
        // Освобождаем предыдущего модератора
        if (trade.moderatorId) {
          await this.parentService.updateModeratorWorkload(trade.moderatorId, -1);
        }
        
        trade.moderatorId = seniorModerator._id;
        await this.parentService.updateModeratorWorkload(seniorModerator._id, 1);
      }
      
      await trade.save();
      
      // Логируем эскалацию
      await this.parentService.logDisputeAction(trade._id, null, 'escalated', null, null, {
        newPriority: trade.disputePriority,
        reassignedModerator: !!seniorModerator
      });
      
      // Уведомляем о эскалации
      await this.notifyDisputeEscalated(trade);
      
    } catch (error) {
      console.error(`❌ [DISPUTE] Error escalating dispute:`, error);
    }
  }

  // Уведомления будут реализованы в DisputeHandler
  async notifyDisputeEscalated(trade) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }
}

module.exports = EscalationService;