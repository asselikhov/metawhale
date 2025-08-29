/**
 * Dispute Statistics Service
 * Handles statistics and analytics for disputes
 */

const { P2PTrade } = require('../database/models');

class DisputeStatisticsService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  /**
   * 📊 ПОЛУЧЕНИЕ СТАТИСТИКИ СПОРОВ
   * Комплексная аналитика для администраторов
   */
  async getDisputeStatistics(timeframe = '30d') {
    try {
      const startDate = this.parentService.getStartDateForTimeframe(timeframe);
      
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
        this.parentService.getDisputeCategoryBreakdown(startDate),
        this.parentService.getResolutionStatistics(startDate),
        this.parentService.getModeratorStatistics()
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
}

module.exports = DisputeStatisticsService;