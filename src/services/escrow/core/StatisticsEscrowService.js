/**
 * Statistics Escrow Service
 * Handles statistics and reporting for escrow transactions
 */

const { User, EscrowTransaction } = require('../../../database/models');

class StatisticsEscrowService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  // Get system escrow statistics
  async getEscrowStatistics() {
    try {
      const [totalEscrowCES, totalEscrowPOL, activeEscrowTx, totalVolume] = await Promise.all([
        User.aggregate([{ $group: { _id: null, total: { $sum: '$escrowCESBalance' } } }]),
        User.aggregate([{ $group: { _id: null, total: { $sum: '$escrowPOLBalance' } } }]),
        EscrowTransaction.countDocuments({ status: 'pending' }),
        EscrowTransaction.aggregate([
          { $match: { status: 'completed', type: 'release' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      return {
        totalEscrowCES: totalEscrowCES[0]?.total || 0,
        totalEscrowPOL: totalEscrowPOL[0]?.total || 0,
        activeEscrowTransactions: activeEscrowTx,
        totalVolumeProcessed: totalVolume[0]?.total || 0
      };

    } catch (error) {
      console.error('Error getting escrow statistics:', error);
      throw error;
    }
  }
}

module.exports = StatisticsEscrowService;