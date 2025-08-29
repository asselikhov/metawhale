/**
 * Moderator Assignment Service
 * Handles assignment of moderators to disputes
 */

const { Moderator } = require('../../../database/models');

class ModeratorAssignmentService {
  constructor(parentService) {
    this.parentService = parentService;
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
        'statistics.currentWorkload': { $lt: this.parentService.MODERATOR_CONFIG.maxConcurrentDisputes }
      }).populate('userId');
      
      if (availableModerators.length === 0) {
        console.warn('⚠️ [DISPUTE] No available moderators found');
        return null;
      }
      
      // Находим модератора со специализацией по категории спора
      let selectedModerator = availableModerators.find(mod => 
        mod.specializations.includes(this.parentService.mapCategoryToSpecialization(trade.disputeCategory))
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
}

module.exports = ModeratorAssignmentService;