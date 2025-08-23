/**
 * Reputation Service
 * Advanced user reputation and rating system for P2P trading
 */

const { User, P2PTrade } = require('../database/models');

class ReputationService {
  constructor() {
    this.trustScoreWeights = {
      completionRate: 0.3,
      disputeRate: 0.2,
      verificationLevel: 0.2,
      tradingHistory: 0.2,
      timeActive: 0.1
    };
  }

  // Calculate user trust score
  async calculateTrustScore(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return 100; // Default score

      // Get user trading history
      const trades = await P2PTrade.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
      });

      // Calculate completion rate
      const totalTrades = trades.length;
      const completedTrades = trades.filter(t => t.status === 'completed').length;
      const completionRate = totalTrades > 0 ? (completedTrades / totalTrades) : 1;

      // Calculate dispute rate
      const disputedTrades = trades.filter(t => t.status === 'disputed').length;
      const disputeRate = totalTrades > 0 ? (disputedTrades / totalTrades) : 0;

      // Verification level bonus
      let verificationBonus = 0;
      switch (user.verificationLevel) {
        case 'phone_verified': verificationBonus = 50; break;
        case 'document_verified': verificationBonus = 100; break;
        case 'premium': verificationBonus = 200; break;
      }

      // Trading history bonus
      const tradeVolume = trades.reduce((sum, trade) => sum + trade.totalValue, 0);
      const tradeVolumeBonus = Math.min(200, tradeVolume / 1000); // Max 200 bonus points

      // Time active bonus
      const daysActive = (Date.now() - user.subscribedAt.getTime()) / (24 * 60 * 60 * 1000);
      const timeActiveBonus = Math.min(100, daysActive); // Max 100 bonus points

      // Calculate weighted trust score
      const score = Math.round(
        100 + // Base score
        (completionRate * 300 * this.trustScoreWeights.completionRate) -
        (disputeRate * 300 * this.trustScoreWeights.disputeRate) +
        (verificationBonus * this.trustScoreWeights.verificationLevel) +
        (tradeVolumeBonus * this.trustScoreWeights.tradingHistory) +
        (timeActiveBonus * this.trustScoreWeights.timeActive)
      );

      // Ensure score is within bounds
      return Math.max(0, Math.min(1000, score));
    } catch (error) {
      console.error('Error calculating trust score:', error);
      return 100; // Default score on error
    }
  }

  // Update user trust score after trade
  async updateTrustScoreAfterTrade(userId, tradeOutcome) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Update trade analytics
      const updateFields = {
        $inc: {
          'tradeAnalytics.totalTrades': 1
        }
      };

      switch (tradeOutcome) {
        case 'completed':
          updateFields.$inc['tradeAnalytics.successfulTrades'] = 1;
          break;
        case 'disputed':
          updateFields.$inc['tradeAnalytics.disputedTrades'] = 1;
          break;
        case 'failed':
          updateFields.$inc['tradeAnalytics.failedTrades'] = 1;
          break;
      }

      await User.findByIdAndUpdate(userId, updateFields);

      // Recalculate trust score
      const newTrustScore = await this.calculateTrustScore(userId);
      
      // Update user's trust score
      await User.findByIdAndUpdate(userId, {
        trustScore: newTrustScore,
        lastTrustScoreUpdate: new Date()
      });

      console.log(`Updated trust score for user ${userId}: ${newTrustScore}`);
      return newTrustScore;
    } catch (error) {
      console.error('Error updating trust score:', error);
    }
  }

  // Get user reputation details
  async getUserReputation(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      // Get recent trades for reputation analysis
      const recentTrades = await P2PTrade.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }).sort({ createdAt: -1 }).limit(10);

      // Calculate statistics
      const totalTrades = recentTrades.length;
      const completedTrades = recentTrades.filter(t => t.status === 'completed').length;
      const disputedTrades = recentTrades.filter(t => t.status === 'disputed').length;
      const failedTrades = recentTrades.filter(t => t.status === 'failed').length;

      const completionRate = totalTrades > 0 ? (completedTrades / totalTrades * 100) : 100;
      const disputeRate = totalTrades > 0 ? (disputedTrades / totalTrades * 100) : 0;
      const failureRate = totalTrades > 0 ? (failedTrades / totalTrades * 100) : 0;

      // Get favorite payment methods
      const paymentMethodCounts = {};
      recentTrades.forEach(trade => {
        const method = trade.paymentMethod;
        paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
      });

      const favoritePaymentMethods = Object.entries(paymentMethodCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([method, count]) => ({ method, count }));

      // Calculate average response time (simplified)
      const avgResponseTime = totalTrades > 0 ? 
        Math.round(recentTrades.reduce((sum, trade) => {
          if (trade.timeTracking?.paymentMadeAt && trade.timeTracking?.createdAt) {
            return sum + (trade.timeTracking.paymentMadeAt - trade.timeTracking.createdAt) / (1000 * 60); // in minutes
          }
          return sum;
        }, 0) / totalTrades) : 0;

      // Get user level based on trust score
      const userLevel = this.getUserLevel(user.trustScore || 100);

      return {
        trustScore: user.trustScore || 100,
        verificationLevel: user.verificationLevel || 'unverified',
        completionRate: completionRate.toFixed(1),
        disputeRate: disputeRate.toFixed(1),
        failureRate: failureRate.toFixed(1),
        totalTrades,
        recentTrades: recentTrades.length,
        favoritePaymentMethods,
        isPremiumTrader: user.isPremiumTrader || false,
        lastActive: user.lastOnline || user.updatedAt,
        avgResponseTime,
        userLevel,
        // Additional metrics for visual display
        tradesLast30Days: totalTrades,
        successRate: completionRate.toFixed(1),
        trustScoreProgress: Math.round((user.trustScore || 100) / 10), // For progress bar (0-100)
        achievements: this.getUserAchievements(user, totalTrades, completionRate)
      };
    } catch (error) {
      console.error('Error getting user reputation:', error);
      return null;
    }
  }

  // Get user level based on trust score
  getUserLevel(trustScore) {
    if (trustScore >= 900) return { name: 'Эксперт', emoji: '🏆', level: 5 };
    if (trustScore >= 750) return { name: 'Профессионал', emoji: '⭐', level: 4 };
    if (trustScore >= 600) return { name: 'Трейдер', emoji: '💎', level: 3 };
    if (trustScore >= 400) return { name: 'Ученик', emoji: '🌱', level: 2 };
    return { name: 'Новичок', emoji: '🆕', level: 1 };
  }

  // Get user achievements
  getUserAchievements(user, totalTrades, completionRate) {
    const achievements = [];
    
    if (totalTrades >= 100) {
      achievements.push({ name: '100+ Сделок', emoji: '💯', description: 'Более 100 совершенных сделок' });
    }
    
    if (completionRate >= 95) {
      achievements.push({ name: 'Высокий рейтинг', emoji: '✅', description: 'Уровень завершения сделок выше 95%' });
    }
    
    if (user.isPremiumTrader) {
      achievements.push({ name: 'Премиум трейдер', emoji: '👑', description: 'Премиум статус на платформе' });
    }
    
    if (user.verificationLevel === 'premium') {
      achievements.push({ name: 'Премиум верификация', emoji: '🛡️', description: 'Пройдена премиум верификация' });
    }
    
    if (totalTrades >= 10 && completionRate >= 90) {
      achievements.push({ name: 'Надежный трейдер', emoji: '🤝', description: 'Более 10 сделок с 90%+ успешным завершением' });
    }
    
    return achievements;
  }

  // Get detailed user profile for display
  async getUserProfileDetails(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      // Get reputation data
      const reputation = await this.getUserReputation(userId);
      
      // Get recent trades for activity display
      const recentTrades = await P2PTrade.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }).sort({ createdAt: -1 }).limit(10);

      // Calculate weekly activity
      const activityByDay = {};
      const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      
      recentTrades.forEach(trade => {
        const day = days[trade.createdAt.getDay()];
        activityByDay[day] = (activityByDay[day] || 0) + 1;
      });

      // Get verification level text
      const verificationText = {
        'unverified': 'Не верифицирован',
        'phone_verified': 'Верификация по телефону',
        'document_verified': 'Верификация по документам',
        'premium': 'Премиум пользователь'
      };

      // Get trading limits based on trust score
      const tradingLimits = this.getUserVerificationRequirements(user.trustScore || 100);

      return {
        ...reputation,
        username: user.username || user.firstName || 'Пользователь',
        memberSince: user.subscribedAt,
        verificationStatus: verificationText[user.verificationLevel] || 'Не верифицирован',
        weeklyActivity: activityByDay,
        tradingLimits,
        totalTradeVolume: user.tradingVolumeLast30Days || 0
      };
    } catch (error) {
      console.error('Error getting user profile details:', error);
      return null;
    }
  }

  // Get top rated users
  async getTopRatedUsers(limit = 10) {
    try {
      const topUsers = await User.find({
        trustScore: { $gte: 500 },
        verificationLevel: { $in: ['document_verified', 'premium'] }
      })
      .sort({ trustScore: -1 })
      .limit(limit)
      .select('username firstName trustScore verificationLevel completionRate');

      return topUsers.map(user => ({
        userId: user._id,
        username: user.username || user.firstName || 'Пользователь',
        trustScore: user.trustScore,
        verificationLevel: user.verificationLevel,
        completionRate: user.completionRate || 100
      }));
    } catch (error) {
      console.error('Error getting top rated users:', error);
      return [];
    }
  }

  // Flag user for review (suspicious activity)
  async flagUserForReview(userId, reason, severity = 'medium') {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Add to risk flags
      const riskFlag = {
        type: reason,
        timestamp: new Date(),
        severity: severity,
        resolved: false
      };

      await User.findByIdAndUpdate(userId, {
        $push: {
          'behaviorProfile.riskFlags': riskFlag
        }
      });

      // Adjust trust score based on severity
      let scoreAdjustment = 0;
      switch (severity) {
        case 'low': scoreAdjustment = -50; break;
        case 'medium': scoreAdjustment = -100; break;
        case 'high': scoreAdjustment = -200; break;
      }

      const newScore = Math.max(0, (user.trustScore || 100) + scoreAdjustment);
      
      await User.findByIdAndUpdate(userId, {
        trustScore: newScore
      });

      console.log(`Flagged user ${userId} for review: ${reason} (${severity})`);
      return newScore;
    } catch (error) {
      console.error('Error flagging user for review:', error);
    }
  }

  // Resolve risk flag
  async resolveRiskFlag(userId, flagId) {
    try {
      await User.findByIdAndUpdate(userId, {
        $set: {
          'behaviorProfile.riskFlags.$[elem].resolved': true
        }
      }, {
        arrayFilters: [{ 'elem._id': flagId }]
      });

      console.log(`Resolved risk flag ${flagId} for user ${userId}`);
    } catch (error) {
      console.error('Error resolving risk flag:', error);
    }
  }

  // Get user verification requirements based on trust score
  getUserVerificationRequirements(trustScore) {
    if (trustScore >= 800) {
      return {
        maxTradeAmount: 1000000, // 1M RUB
        dailyLimit: 500000, // 500K RUB
        monthlyLimit: 5000000, // 5M RUB
        requiredVerification: 'document_verified'
      };
    } else if (trustScore >= 500) {
      return {
        maxTradeAmount: 100000, // 100K RUB
        dailyLimit: 300000, // 300K RUB
        monthlyLimit: 1000000, // 1M RUB
        requiredVerification: 'phone_verified'
      };
    } else {
      return {
        maxTradeAmount: 10000, // 10K RUB
        dailyLimit: 50000, // 50K RUB
        monthlyLimit: 200000, // 200K RUB
        requiredVerification: 'unverified'
      };
    }
  }
}

module.exports = new ReputationService();