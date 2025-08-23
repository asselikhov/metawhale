/**
 * Risk Management Service
 * Advanced risk assessment and fraud prevention for P2P trading
 */

const { User, P2PTrade, P2POrder } = require('../database/models');

class RiskManagementService {
  constructor() {
    this.riskThresholds = {
      HIGH_RISK_SCORE: 300,
      MEDIUM_RISK_SCORE: 150,
      MAX_DAILY_TRADES: 20,
      MAX_FAILED_TRADES: 5,
      MIN_ACCOUNT_AGE_DAYS: 7,
      SUSPICIOUS_AMOUNT_THRESHOLD: 100000 // in rubles
    };
  }

  // Comprehensive risk assessment for new trades
  async assessTradeRisk(buyerId, sellerId, amount, pricePerToken) {
    try {
      console.log(`🔍 Assessing trade risk: ${amount} CES at ₽${pricePerToken}`);

      const [buyer, seller] = await Promise.all([
        User.findById(buyerId),
        User.findById(sellerId)
      ]);

      if (!buyer || !seller) {
        return { riskLevel: 'HIGH', reason: 'User not found', allowTrade: false };
      }

      const tradeValue = amount * pricePerToken;
      let riskScore = 0;
      const riskFactors = [];

      // 1. User verification levels
      const buyerVerificationRisk = this.assessVerificationRisk(buyer);
      const sellerVerificationRisk = this.assessVerificationRisk(seller);
      riskScore += buyerVerificationRisk.score + sellerVerificationRisk.score;
      riskFactors.push(...buyerVerificationRisk.factors, ...sellerVerificationRisk.factors);

      // 2. Trading history analysis
      const buyerHistoryRisk = await this.assessTradingHistoryRisk(buyer);
      const sellerHistoryRisk = await this.assessTradingHistoryRisk(seller);
      riskScore += buyerHistoryRisk.score + sellerHistoryRisk.score;
      riskFactors.push(...buyerHistoryRisk.factors, ...sellerHistoryRisk.factors);

      // 3. Amount-based risk assessment
      const amountRisk = this.assessAmountRisk(tradeValue, buyer, seller);
      riskScore += amountRisk.score;
      riskFactors.push(...amountRisk.factors);

      // 4. Behavioral pattern analysis
      const behaviorRisk = await this.assessBehavioralRisk(buyer, seller);
      riskScore += behaviorRisk.score;
      riskFactors.push(...behaviorRisk.factors);

      // 5. Market manipulation detection
      const manipulationRisk = await this.assessMarketManipulationRisk(pricePerToken, amount);
      riskScore += manipulationRisk.score;
      riskFactors.push(...manipulationRisk.factors);

      // Determine final risk level
      let riskLevel = 'LOW';
      let allowTrade = true;
      let requiredActions = [];

      if (riskScore >= this.riskThresholds.HIGH_RISK_SCORE) {
        riskLevel = 'HIGH';
        allowTrade = false;
        requiredActions.push('Manual review required', 'Additional verification needed');
      } else if (riskScore >= this.riskThresholds.MEDIUM_RISK_SCORE) {
        riskLevel = 'MEDIUM';
        requiredActions.push('Enhanced monitoring', 'Shorter timeout period');
      }

      console.log(`🎯 Risk assessment complete: ${riskLevel} (score: ${riskScore})`);

      return {
        riskLevel,
        riskScore,
        allowTrade,
        riskFactors,
        requiredActions,
        recommendations: this.generateRiskRecommendations(riskLevel, riskFactors)
      };

    } catch (error) {
      console.error('Error assessing trade risk:', error);
      return { riskLevel: 'HIGH', reason: 'Assessment failed', allowTrade: false };
    }
  }

  // Assess verification-based risk
  assessVerificationRisk(user) {
    let score = 0;
    const factors = [];

    switch (user.verificationLevel) {
      case 'unverified':
        score += 100;
        factors.push('User not verified');
        break;
      case 'phone_verified':
        score += 50;
        factors.push('Only phone verified');
        break;
      case 'document_verified':
        score += 10;
        break;
      case 'premium':
        score -= 20; // Bonus for premium users
        break;
    }

    if (!user.phoneVerified) {
      score += 50;
      factors.push('Phone not verified');
    }

    if (!user.twoFactorEnabled) {
      score += 30;
      factors.push('2FA not enabled');
    }

    // Account age check
    const accountAgeDays = (Date.now() - user.subscribedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < this.riskThresholds.MIN_ACCOUNT_AGE_DAYS) {
      score += 80;
      factors.push('New account (less than 7 days)');
    }

    return { score, factors };
  }

  // Assess trading history risk
  async assessTradingHistoryRisk(user) {
    try {
      let score = 0;
      const factors = [];

      // Get recent trading activity
      const recentTrades = await P2PTrade.find({
        $or: [{ buyerId: user._id }, { sellerId: user._id }],
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      const failedTrades = recentTrades.filter(trade => trade.status === 'failed').length;
      const disputedTrades = recentTrades.filter(trade => trade.status === 'disputed').length;

      // Failed trades penalty
      if (failedTrades >= this.riskThresholds.MAX_FAILED_TRADES) {
        score += 150;
        factors.push(`High failed trade count: ${failedTrades}`);
      } else if (failedTrades > 2) {
        score += 50;
        factors.push(`Some failed trades: ${failedTrades}`);
      }

      // Disputed trades penalty
      if (disputedTrades > 0) {
        score += disputedTrades * 40;
        factors.push(`Disputed trades: ${disputedTrades}`);
      }

      // Low completion rate penalty
      if (user.completionRate < 90) {
        score += 60;
        factors.push(`Low completion rate: ${user.completionRate}%`);
      }

      // Trust score impact
      if (user.trustScore < 50) {
        score += 100;
        factors.push(`Very low trust score: ${user.trustScore}`);
      } else if (user.trustScore < 80) {
        score += 40;
        factors.push(`Low trust score: ${user.trustScore}`);
      }

      return { score, factors };

    } catch (error) {
      console.error('Error assessing trading history risk:', error);
      return { score: 100, factors: ['Trading history assessment failed'] };
    }
  }

  // Assess amount-based risk
  assessAmountRisk(tradeValue, buyer, seller) {
    let score = 0;
    const factors = [];

    // Large amount warning
    if (tradeValue >= this.riskThresholds.SUSPICIOUS_AMOUNT_THRESHOLD) {
      score += 80;
      factors.push(`Large trade amount: ₽${tradeValue.toFixed(2)}`);
    }

    // Check against user limits
    if (tradeValue > buyer.tradingLimits.maxSingleTrade) {
      score += 100;
      factors.push('Exceeds buyer trade limit');
    }

    if (tradeValue > seller.tradingLimits.maxSingleTrade) {
      score += 100;
      factors.push('Exceeds seller trade limit');
    }

    // Check daily volume
    if (tradeValue > buyer.tradingLimits.dailyLimit * 0.5) {
      score += 30;
      factors.push('Large portion of daily limit');
    }

    return { score, factors };
  }

  // Assess behavioral patterns
  async assessBehavioralRisk(buyer, seller) {
    try {
      let score = 0;
      const factors = [];

      // Check for unusual activity patterns
      const recentActivity = await this.getRecentActivityPattern(buyer._id);
      
      if (recentActivity.rapidTrading) {
        score += 50;
        factors.push('Rapid trading pattern detected');
      }

      if (recentActivity.offHourTrading) {
        score += 20;
        factors.push('Unusual trading hours');
      }

      // Check last online status
      const hoursOffline = (Date.now() - seller.lastOnline.getTime()) / (1000 * 60 * 60);
      if (hoursOffline > 24) {
        score += 30;
        factors.push('Seller offline for >24 hours');
      }

      return { score, factors };

    } catch (error) {
      console.error('Error assessing behavioral risk:', error);
      return { score: 20, factors: ['Behavioral assessment partially failed'] };
    }
  }

  // Detect market manipulation attempts
  async assessMarketManipulationRisk(pricePerToken, amount) {
    try {
      let score = 0;
      const factors = [];

      // Get market price
      const priceService = require('./priceService');
      const marketData = await priceService.getCESPrice();
      const marketPrice = marketData.priceRub;

      // Check for significant price deviation
      const priceDeviation = Math.abs((pricePerToken - marketPrice) / marketPrice * 100);
      
      if (priceDeviation > 10) {
        score += 60;
        factors.push(`Significant price deviation: ${priceDeviation.toFixed(1)}%`);
      } else if (priceDeviation > 5) {
        score += 20;
        factors.push(`Moderate price deviation: ${priceDeviation.toFixed(1)}%`);
      }

      // Check for wash trading patterns
      const washTradingRisk = await this.detectWashTrading(amount, pricePerToken);
      score += washTradingRisk.score;
      factors.push(...washTradingRisk.factors);

      return { score, factors };

    } catch (error) {
      console.error('Error assessing manipulation risk:', error);
      return { score: 10, factors: ['Manipulation assessment failed'] };
    }
  }

  // Get recent activity patterns
  async getRecentActivityPattern(userId) {
    try {
      const recentTrades = await P2PTrade.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).sort({ createdAt: -1 });

      const rapidTrading = recentTrades.length > this.riskThresholds.MAX_DAILY_TRADES;
      
      // Check for off-hour trading (between 2 AM and 6 AM Moscow time)
      const offHourTrades = recentTrades.filter(trade => {
        const hour = new Date(trade.createdAt).getHours();
        return hour >= 2 && hour <= 6;
      });
      
      const offHourTrading = offHourTrades.length > recentTrades.length * 0.3;

      return {
        rapidTrading,
        offHourTrading,
        totalTrades: recentTrades.length,
        offHourTrades: offHourTrades.length
      };

    } catch (error) {
      console.error('Error getting activity pattern:', error);
      return { rapidTrading: false, offHourTrading: false };
    }
  }

  // Detect wash trading patterns
  async detectWashTrading(amount, pricePerToken) {
    try {
      // Look for similar trades in recent history
      const similarTrades = await P2PTrade.find({
        amount: { $gte: amount * 0.9, $lte: amount * 1.1 },
        pricePerToken: { $gte: pricePerToken * 0.99, $lte: pricePerToken * 1.01 },
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      });

      let score = 0;
      const factors = [];

      if (similarTrades.length > 3) {
        score += 80;
        factors.push('Multiple similar trades detected');
      }

      return { score, factors };

    } catch (error) {
      console.error('Error detecting wash trading:', error);
      return { score: 0, factors: [] };
    }
  }

  // Generate risk-based recommendations
  generateRiskRecommendations(riskLevel, riskFactors) {
    const recommendations = [];

    if (riskLevel === 'HIGH') {
      recommendations.push('Require additional verification');
      recommendations.push('Manual review by moderator');
      recommendations.push('Increase escrow timeout period');
    } else if (riskLevel === 'MEDIUM') {
      recommendations.push('Enhanced monitoring');
      recommendations.push('Shorter trade timeout');
      recommendations.push('Additional payment proof required');
    }

    // Specific recommendations based on risk factors
    if (riskFactors.some(f => f.includes('verification'))) {
      recommendations.push('Complete identity verification');
    }

    if (riskFactors.some(f => f.includes('failed'))) {
      recommendations.push('Review trading practices');
    }

    if (riskFactors.some(f => f.includes('Large'))) {
      recommendations.push('Consider smaller trade amounts');
    }

    return recommendations;
  }

  // Real-time fraud detection
  async detectFraudulentActivity(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return { isFraudulent: false };

      const fraudIndicators = [];
      let fraudScore = 0;

      // Multiple account detection
      const similarAccounts = await User.find({
        $and: [
          { _id: { $ne: userId } },
          {
            $or: [
              { firstName: user.firstName, lastName: user.lastName },
              { walletAddress: user.walletAddress }
            ]
          }
        ]
      });

      if (similarAccounts.length > 0) {
        fraudScore += 200;
        fraudIndicators.push('Potential multiple accounts');
      }

      // Unusual trading patterns
      const tradingPattern = await this.getRecentActivityPattern(userId);
      if (tradingPattern.rapidTrading) {
        fraudScore += 100;
        fraudIndicators.push('Rapid trading pattern');
      }

      return {
        isFraudulent: fraudScore >= 150,
        fraudScore,
        fraudIndicators,
        recommendedAction: fraudScore >= 200 ? 'SUSPEND' : fraudScore >= 150 ? 'INVESTIGATE' : 'MONITOR'
      };

    } catch (error) {
      console.error('Error detecting fraudulent activity:', error);
      return { isFraudulent: false, error: error.message };
    }
  }

  // Update user risk profile after trade
  async updateUserRiskProfile(userId, tradeOutcome) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Update trust score based on trade outcome
      switch (tradeOutcome) {
        case 'completed':
          user.trustScore = Math.min(1000, user.trustScore + 5);
          break;
        case 'disputed':
          user.trustScore = Math.max(0, user.trustScore - 20);
          user.disputeCount += 1;
          break;
        case 'failed':
          user.trustScore = Math.max(0, user.trustScore - 10);
          break;
      }

      // Recalculate completion rate
      const totalTrades = await P2PTrade.countDocuments({
        $or: [{ buyerId: userId }, { sellerId: userId }]
      });

      const completedTrades = await P2PTrade.countDocuments({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        status: 'completed'
      });

      user.completionRate = totalTrades > 0 ? (completedTrades / totalTrades * 100) : 100;

      await user.save();

      console.log(`📊 Updated risk profile for user ${userId}: Trust score ${user.trustScore}, Completion rate ${user.completionRate}%`);

    } catch (error) {
      console.error('Error updating user risk profile:', error);
    }
  }
}

module.exports = new RiskManagementService();