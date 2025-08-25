/**
 * Reputation Service
 * Smart percentage-based user rating system for P2P trading
 */

const { User, P2PTrade, P2POrder } = require('../database/models');

class ReputationService {
  constructor() {
    // New smart rating weights (0-100%)
    this.ratingWeights = {
      completionRate: 0.5,  // W1 = 50%
      speed: 0.3,           // W2 = 30%
      experience: 0.2       // W3 = 20%
    };
  }

  // Calculate smart rating percentage (0-100%)
  async calculateSmartRating(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return 0;

      // Get user trading history for last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const trades = await P2PTrade.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        createdAt: { $gte: thirtyDaysAgo }
      });

      // For new users with no trades, return 0
      if (trades.length === 0) {
        return 0;
      }

      // 1. Completion Rate (W1 = 0.5)
      const totalTrades = trades.length;
      const completedTrades = trades.filter(t => t.status === 'completed').length;
      const completionPercentage = totalTrades > 0 ? (completedTrades / totalTrades) * 100 : 0;

      // 2. Speed Score (W2 = 0.3)
      const speedScore = await this.calculateSpeedScore(userId, trades);

      // 3. Experience Score (W3 = 0.2)
      const experienceScore = this.calculateExperienceScore(trades.length);

      // Calculate final rating percentage
      const rating = (
        (this.ratingWeights.completionRate * completionPercentage) +
        (this.ratingWeights.speed * speedScore) +
        (this.ratingWeights.experience * experienceScore)
      );

      // Ensure rating is within 0-100 bounds
      return Math.max(0, Math.min(100, Math.round(rating)));

    } catch (error) {
      console.error('Error calculating smart rating:', error);
      return 0;
    }
  }

  // Calculate speed score based on average payment/transfer times
  async calculateSpeedScore(userId, trades) {
    try {
      const completedTrades = trades.filter(t => t.status === 'completed');
      
      if (completedTrades.length === 0) {
        return 0;
      }

      // Calculate average payment time (for sell orders - buyer payment speed)
      const sellTrades = completedTrades.filter(t => 
        t.sellerId.toString() === userId.toString() &&
        t.timeTracking?.createdAt && t.timeTracking?.paymentConfirmedAt
      );

      // Calculate average transfer time (for buy orders - seller transfer speed)
      const buyTrades = completedTrades.filter(t => 
        t.buyerId.toString() === userId.toString() &&
        t.timeTracking?.paymentConfirmedAt && t.timeTracking?.escrowReleasedAt
      );

      let totalTimeMinutes = 0;
      let timeCount = 0;

      // Add payment times
      sellTrades.forEach(trade => {
        const createdTime = new Date(trade.timeTracking.createdAt);
        const paymentTime = new Date(trade.timeTracking.paymentConfirmedAt);
        const minutes = (paymentTime - createdTime) / (1000 * 60);
        totalTimeMinutes += minutes;
        timeCount++;
      });

      // Add transfer times
      buyTrades.forEach(trade => {
        const paymentTime = new Date(trade.timeTracking.paymentConfirmedAt);
        const releaseTime = new Date(trade.timeTracking.escrowReleasedAt);
        const minutes = (releaseTime - paymentTime) / (1000 * 60);
        totalTimeMinutes += minutes;
        timeCount++;
      });

      if (timeCount === 0) {
        return 0;
      }

      const avgTimeMinutes = totalTimeMinutes / timeCount;

      // Speed scoring based on your specifications
      if (avgTimeMinutes < 5) {
        return 30; // <5 min → 30%
      } else if (avgTimeMinutes < 15) {
        return 20; // <15 min → 20%
      } else if (avgTimeMinutes <= 15) {
        return 10; // 15 min → 10%
      } else {
        return 5;  // >15 min → 5%
      }

    } catch (error) {
      console.error('Error calculating speed score:', error);
      return 0;
    }
  }

  // Calculate experience score based on number of trades in 30 days
  calculateExperienceScore(tradesCount) {
    if (tradesCount >= 50) {
      return 20; // 50+ сделок → 20%
    } else if (tradesCount >= 20) {
      return 15; // 20-49 сделок → 15%
    } else if (tradesCount >= 5) {
      return 10; // 5-19 сделок → 10%
    } else {
      return 5;  // <5 сделок → 5%
    }
  }

  // Convert rating percentage to emoji
  getRatingEmoji(ratingPercentage) {
    if (ratingPercentage >= 81) {
      return '🐋'; // 81-100% → Кит (топ-трейдер)
    } else if (ratingPercentage >= 61) {
      return '🐺'; // 61-80% → Волк (надёжный трейдер)
    } else if (ratingPercentage >= 41) {
      return '🦅'; // 41-60% → Ястреб (средний уровень)
    } else if (ratingPercentage >= 21) {
      return '🐿️'; // 21-40% → Белка (начинающий)
    } else {
      return '🐹'; // 0-20% → Хомяк (новичок)
    }
  }

  // Get rating description
  getRatingDescription(ratingPercentage) {
    if (ratingPercentage >= 81) {
      return 'Кит - топ-трейдер: большой опыт, высокая скорость, всё почти безупречно';
    } else if (ratingPercentage >= 61) {
      return 'Волк - надёжный трейдер: быстро, стабильно, много ордеров';
    } else if (ratingPercentage >= 41) {
      return 'Ястреб - средний уровень: сделки выполняются, скорость нормальная';
    } else if (ratingPercentage >= 21) {
      return 'Белка - уже начал торговать, но статистика ещё слабая';
    } else {
      return 'Хомяк - новичок, мало опыта или низкая дисциплина';
    }
  }

  // Update user rating after trade
  async updateRatingAfterTrade(userId, tradeOutcome) {
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

      // Recalculate smart rating percentage
      const newRating = await this.calculateSmartRating(userId);
      
      // Update user's smart rating
      await User.findByIdAndUpdate(userId, {
        smartRating: newRating,
        lastRatingUpdate: new Date()
      });

      console.log(`Updated smart rating for user ${userId}: ${newRating}%`);
      return newRating;
    } catch (error) {
      console.error('Error updating smart rating:', error);
    }
  }

  // Get user reputation details
  async getUserReputation(userId) {
    try {
      const user = await User.findById(userId).select('trustScore verificationLevel isPremiumTrader lastOnline updatedAt tradeAnalytics');
      if (!user) return null;

      // For users with existing trust score, return cached values for better performance
      if (user.trustScore !== undefined && user.tradeAnalytics) {
        const totalTrades = user.tradeAnalytics.totalTrades || 0;
        if (totalTrades > 0) {
          const completedTrades = user.tradeAnalytics.successfulTrades || 0;
          const disputedTrades = user.tradeAnalytics.disputedTrades || 0;
        
          const completionRate = totalTrades > 0 ? (completedTrades / totalTrades * 100) : 100;
          const disputeRate = totalTrades > 0 ? (disputedTrades / totalTrades * 100) : 0;
          const failureRate = totalTrades > 0 ? ((totalTrades - completedTrades - disputedTrades) / totalTrades * 100) : 0;

          const trustScore = user.trustScore !== undefined ? user.trustScore : 0;
          const userLevel = this.getUserLevel(trustScore);

          return {
            trustScore: trustScore,
            verificationLevel: user.verificationLevel || 'unverified',
            completionRate: completionRate.toFixed(1),
            disputeRate: disputeRate.toFixed(1),
            failureRate: failureRate.toFixed(1),
            totalTrades,
            recentTrades: Math.min(10, totalTrades), // Limit for display
            favoritePaymentMethods: [], // Will be populated in profile details if needed
            isPremiumTrader: user.isPremiumTrader || false,
            lastActive: user.lastOnline || user.updatedAt,
            avgResponseTime: 0, // Will be calculated in profile details if needed
            userLevel,
            // Additional metrics for visual display
            tradesLast30Days: totalTrades,
            successRate: completionRate.toFixed(1),
            trustScoreProgress: Math.round((trustScore) / 10), // For progress bar (0-100)
            achievements: this.getUserAchievements(user, totalTrades, completionRate)
          };
        }
      }

      // For new users with no trades, return default values with 0 trust score
      return {
        trustScore: 0,
        verificationLevel: user.verificationLevel || 'unverified',
        completionRate: '100.0',
        disputeRate: '0.0',
        failureRate: '0.0',
        totalTrades: 0,
        recentTrades: 0,
        favoritePaymentMethods: [],
        isPremiumTrader: user.isPremiumTrader || false,
        lastActive: user.lastOnline || user.updatedAt,
        avgResponseTime: 0,
        userLevel: this.getUserLevel(0),
        // Additional metrics for visual display
        tradesLast30Days: 0,
        successRate: '100.0',
        trustScoreProgress: 0, // For progress bar (0-100)
        achievements: this.getUserAchievements(user, 0, 100)
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
      // Select only necessary fields for better performance
      const user = await User.findById(userId).select('username firstName trustScore verificationLevel tradingVolumeLast30Days subscribedAt');
      if (!user) return null;

      // Get reputation data (optimized version)
      const reputation = await this.getUserReputation(userId);
      
      // For performance, only get weekly activity if specifically needed
      // Most of the time, we just need the total trade volume which is already in user object
      const totalTradeVolume = user.tradingVolumeLast30Days || 0;

      // Get verification level text
      const verificationText = {
        'unverified': 'Не верифицирован',
        'phone_verified': 'Верификация по телефону',
        'document_verified': 'Верификация по документам',
        'premium': 'Премиум пользователь'
      };

      // Get trading limits based on trust score
      const trustScore = user.trustScore !== undefined ? user.trustScore : 0;
      const tradingLimits = this.getUserVerificationRequirements(trustScore);

      return {
        ...reputation,
        username: user.username || user.firstName || 'Пользователь',
        memberSince: user.subscribedAt,
        verificationStatus: verificationText[user.verificationLevel] || 'Не верифицирован',
        weeklyActivity: {}, // Will be populated only when needed
        tradingLimits,
        totalTradeVolume
      };
    } catch (error) {
      console.error('Error getting user profile details:', error);
      return null;
    }
  }

  // Get top rated users (using smart rating)
  async getTopRatedUsers(limit = 10) {
    try {
      // Get all users with trade activity in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const usersWithTrades = await P2PTrade.distinct('buyerId', {
        createdAt: { $gte: thirtyDaysAgo }
      }).concat(await P2PTrade.distinct('sellerId', {
        createdAt: { $gte: thirtyDaysAgo }
      }));
      
      // Remove duplicates
      const uniqueUserIds = [...new Set(usersWithTrades)];
      
      // Calculate smart rating for each user and sort
      const userRatings = [];
      
      for (const userId of uniqueUserIds) {
        const user = await User.findById(userId).select('username firstName verificationLevel completionRate');
        if (!user) continue;
        
        const smartRating = await this.calculateSmartRating(userId);
        
        // Only include users with rating >= 50% for top list
        if (smartRating >= 50) {
          userRatings.push({
            userId: user._id,
            username: user.username || user.firstName || 'Пользователь',
            smartRating: smartRating,
            verificationLevel: user.verificationLevel,
            completionRate: user.completionRate || 100
          });
        }
      }
      
      // Sort by smart rating (highest first) and return top users
      return userRatings
        .sort((a, b) => b.smartRating - a.smartRating)
        .slice(0, limit);
        
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

      const newScore = Math.max(0, (user.trustScore !== undefined ? user.trustScore : 0) + scoreAdjustment);
      
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

  // Get standardized user statistics for P2P display
  async getStandardizedUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          rating: '0% 🐹',
          ordersLast30Days: 0,
          completionRateLast30Days: 0,
          avgTransferTime: 0,
          avgPaymentTime: 0
        };
      }

      // Get smart rating percentage
      const ratingPercentage = await this.calculateSmartRating(userId);
      const ratingEmoji = this.getRatingEmoji(ratingPercentage);
      
      // Calculate real statistics from last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Get all P2P trades (both orders and completed trades) for last 30 days
      const [ordersLast30Days, tradesLast30Days] = await Promise.all([
        // Count orders created in last 30 days (from P2POrder model)
        P2POrder.countDocuments({
          userId: userId,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        
        // Get trades from last 30 days
        P2PTrade.find({
          $or: [{ buyerId: userId }, { sellerId: userId }],
          createdAt: { $gte: thirtyDaysAgo }
        })
      ]);
      
      // Calculate completion rate for last 30 days
      const totalTradesLast30Days = tradesLast30Days.length;
      const completedTradesLast30Days = tradesLast30Days.filter(t => t.status === 'completed').length;
      const cancelledTradesLast30Days = tradesLast30Days.filter(t => t.status === 'cancelled').length;
      
      // Completion rate = completed trades / (total trades - cancellations) * 100
      // Cancellations don't count against completion rate as per user's specification
      const eligibleTrades = totalTradesLast30Days - cancelledTradesLast30Days;
      const completionRateLast30Days = eligibleTrades > 0 ? Math.round((completedTradesLast30Days / eligibleTrades) * 100) : 0;
      
      // Calculate average transfer time (for buy orders - how long seller takes to send)
      const buyTrades = tradesLast30Days.filter(t => 
        t.buyerId.toString() === userId.toString() && t.status === 'completed'
      );
      
      let avgTransferTime = 0;
      if (buyTrades.length > 0) {
        const transferTimes = buyTrades
          .filter(t => t.timeTracking?.paymentConfirmedAt && t.timeTracking?.escrowReleasedAt)
          .map(t => {
            const paymentTime = new Date(t.timeTracking.paymentConfirmedAt);
            const releaseTime = new Date(t.timeTracking.escrowReleasedAt);
            return Math.round((releaseTime - paymentTime) / (1000 * 60)); // minutes
          });
        
        if (transferTimes.length > 0) {
          avgTransferTime = Math.round(transferTimes.reduce((sum, time) => sum + time, 0) / transferTimes.length);
        }
      }
      
      // Calculate average payment time (for sell orders - how long buyer takes to pay)
      const sellTrades = tradesLast30Days.filter(t => 
        t.sellerId.toString() === userId.toString() && t.status === 'completed'
      );
      
      let avgPaymentTime = 0;
      if (sellTrades.length > 0) {
        const paymentTimes = sellTrades
          .filter(t => t.timeTracking?.createdAt && t.timeTracking?.paymentConfirmedAt)
          .map(t => {
            const createdTime = new Date(t.timeTracking.createdAt);
            const paymentTime = new Date(t.timeTracking.paymentConfirmedAt);
            return Math.round((paymentTime - createdTime) / (1000 * 60)); // minutes
          });
        
        if (paymentTimes.length > 0) {
          avgPaymentTime = Math.round(paymentTimes.reduce((sum, time) => sum + time, 0) / paymentTimes.length);
        }
      }
      
      // Return statistics with new smart rating format
      return {
        rating: `${ratingPercentage}% ${ratingEmoji}`,
        ordersLast30Days: ordersLast30Days,
        completionRateLast30Days: completionRateLast30Days,
        avgTransferTime: avgTransferTime,
        avgPaymentTime: avgPaymentTime
      };
    } catch (error) {
      console.error('Error getting standardized user stats:', error);
      // Return zero values on error (not mock data)
      return {
        rating: '0% 🐹',
        ordersLast30Days: 0,
        completionRateLast30Days: 0,
        avgTransferTime: 0,
        avgPaymentTime: 0
      };
    }
  }

  // Get user level display with emoji (updated for percentage system)
  getUserLevelDisplay(ratingPercentage) {
    return { emoji: this.getRatingEmoji(ratingPercentage) };
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