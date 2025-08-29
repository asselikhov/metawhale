/**
 * Evidence Service
 * Handles evidence submission and management for P2P trade disputes
 */

const { P2PTrade, User } = require('../../database/models');

class EvidenceService {
  constructor(parentService) {
    this.parentService = parentService;
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
      await this.parentService.logDisputeAction(tradeId, user._id, 'evidence_submitted', null, null, {
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

  // Уведомления будут реализованы в DisputeHandler
  async notifyModeratorNewEvidence(trade, submitter, evidence) {
    // Реализация уведомлений будет добавлена в DisputeHandler
  }
}

module.exports = EvidenceService;