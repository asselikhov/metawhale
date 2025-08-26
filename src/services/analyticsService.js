/**
 * Analytics Service
 * Advanced analytics and reporting for P2P trading platform
 */

const { P2PTrade, P2POrder, User, EscrowTransaction } = require('../database/models');

class AnalyticsService {
  constructor() {
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
    this.analyticsCache = new Map();
  }

  // Get comprehensive trading statistics
  async getTradingStatistics(timeRange = '24h') {
    try {
      const cacheKey = `trading_stats_${timeRange}`;
      const cached = this.analyticsCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }

      console.log(`Generating trading statistics for ${timeRange}`);

      const timeRanges = {
        '1h': 1 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const startTime = new Date(Date.now() - timeRanges[timeRange]);

      const [
        totalTrades,
        completedTrades,
        totalVolume,
        uniqueTraders,
        avgTradeSize,
        marketMakerStats,
        hourlyDistribution
      ] = await Promise.all([
        this.getTotalTrades(startTime),
        this.getCompletedTrades(startTime),
        this.getTotalVolume(startTime),
        this.getUniqueTraders(startTime),
        this.getAverageTradeSize(startTime),
        this.getMarketMakerStatistics(startTime),
        this.getHourlyTradeDistribution(startTime)
      ]);

      const statistics = {
        timeRange,
        period: {
          start: startTime,
          end: new Date()
        },
        trades: {
          total: totalTrades,
          completed: completedTrades,
          completionRate: totalTrades > 0 ? (completedTrades / totalTrades * 100).toFixed(2) : 0,
          failed: totalTrades - completedTrades
        },
        volume: {
          totalRubles: totalVolume.rubles,
          totalCES: totalVolume.ces,
          averageTradeSize: avgTradeSize
        },
        users: {
          uniqueTraders: uniqueTraders.total,
          uniqueBuyers: uniqueTraders.buyers,
          uniqueSellers: uniqueTraders.sellers,
          newTraders: uniqueTraders.newTraders
        },
        marketMaking: marketMakerStats,
        patterns: {
          hourlyDistribution: hourlyDistribution,
          peakHour: this.findPeakHour(hourlyDistribution)
        }
      };

      // Cache the results
      this.analyticsCache.set(cacheKey, {
        data: statistics,
        timestamp: Date.now()
      });

      return statistics;

    } catch (error) {
      console.error('Error generating trading statistics:', error);
      throw error;
    }
  }

  // Get total trades count
  async getTotalTrades(startTime) {
    return await P2PTrade.countDocuments({
      createdAt: { $gte: startTime }
    });
  }

  // Get completed trades count
  async getCompletedTrades(startTime) {
    return await P2PTrade.countDocuments({
      createdAt: { $gte: startTime },
      status: 'completed'
    });
  }

  // Get total trading volume
  async getTotalVolume(startTime) {
    const volumeData = await P2PTrade.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRubles: { $sum: '$totalValue' },
          totalCES: { $sum: '$amount' },
          totalCommission: { $sum: '$commission' }
        }
      }
    ]);

    return volumeData[0] || { totalRubles: 0, totalCES: 0, totalCommission: 0 };
  }

  // Get unique traders
  async getUniqueTraders(startTime) {
    const traders = await P2PTrade.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: null,
          buyers: { $addToSet: '$buyerId' },
          sellers: { $addToSet: '$sellerId' }
        }
      }
    ]);

    const result = traders[0] || { buyers: [], sellers: [] };
    const allTraders = [...new Set([...result.buyers, ...result.sellers])];

    // Count new traders (first trade)
    const newTraders = await this.countNewTraders(startTime, allTraders);

    return {
      total: allTraders.length,
      buyers: result.buyers.length,
      sellers: result.sellers.length,
      newTraders: newTraders
    };
  }

  // Count new traders in the period
  async countNewTraders(startTime, traderIds) {
    if (traderIds.length === 0) return 0;

    const newTraders = await P2PTrade.countDocuments({
      $or: [
        { buyerId: { $in: traderIds } },
        { sellerId: { $in: traderIds } }
      ],
      createdAt: { $lt: startTime }
    });

    return Math.max(0, traderIds.length - newTraders);
  }

  // Get average trade size
  async getAverageTradeSize(startTime) {
    const avgData = await P2PTrade.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          avgRubles: { $avg: '$totalValue' },
          avgCES: { $avg: '$amount' }
        }
      }
    ]);

    return avgData[0] || { avgRubles: 0, avgCES: 0 };
  }

  // Get market maker statistics
  async getMarketMakerStatistics(startTime) {
    const marketMakers = await P2PTrade.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$sellerId',
          tradesCount: { $sum: 1 },
          totalVolume: { $sum: '$totalValue' },
          avgPrice: { $avg: '$pricePerToken' }
        }
      },
      {
        $match: {
          tradesCount: { $gte: 3 } // Consider users with 3+ trades as market makers
        }
      },
      {
        $sort: { totalVolume: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return {
      topMarketMakers: marketMakers,
      totalMarketMakers: marketMakers.length
    };
  }

  // Get hourly trade distribution
  async getHourlyTradeDistribution(startTime) {
    const hourlyData = await P2PTrade.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
          volume: { $sum: '$totalValue' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Fill missing hours with 0
    const distribution = Array.from({ length: 24 }, (_, hour) => {
      const data = hourlyData.find(d => d._id === hour);
      return {
        hour,
        trades: data?.count || 0,
        volume: data?.volume || 0
      };
    });

    return distribution;
  }

  // Find peak trading hour
  findPeakHour(hourlyDistribution) {
    return hourlyDistribution.reduce((peak, current) => 
      current.trades > peak.trades ? current : peak
    );
  }

  // Get order book analytics
  async getOrderBookAnalytics() {
    try {
      console.log('Generating order book analytics...');

      const [buyOrders, sellOrders] = await Promise.all([
        P2POrder.find({
          type: 'buy',
          status: { $in: ['active', 'partial'] },
          remainingAmount: { $gt: 0 }
        }).sort({ pricePerToken: -1 }),
        
        P2POrder.find({
          type: 'sell',
          status: { $in: ['active', 'partial'] },
          remainingAmount: { $gt: 0 }
        }).sort({ pricePerToken: 1 })
      ]);

      // Calculate spread
      const bestBid = buyOrders[0]?.pricePerToken || 0;
      const bestAsk = sellOrders[0]?.pricePerToken || 0;
      const spread = bestAsk > 0 ? ((bestAsk - bestBid) / bestAsk * 100) : 0;

      // Calculate order book depth
      const bidDepth = buyOrders.reduce((sum, order) => sum + order.remainingAmount, 0);
      const askDepth = sellOrders.reduce((sum, order) => sum + order.remainingAmount, 0);

      // Price levels analysis
      const priceLevels = this.analyzePriceLevels(buyOrders, sellOrders);

      return {
        spread: {
          absolute: bestAsk - bestBid,
          percentage: spread,
          bestBid,
          bestAsk
        },
        depth: {
          bids: bidDepth,
          asks: askDepth,
          ratio: askDepth > 0 ? bidDepth / askDepth : 0
        },
        orders: {
          totalBuyOrders: buyOrders.length,
          totalSellOrders: sellOrders.length,
          avgBuySize: bidDepth / (buyOrders.length || 1),
          avgSellSize: askDepth / (sellOrders.length || 1)
        },
        priceLevels: priceLevels
      };

    } catch (error) {
      console.error('Error generating order book analytics:', error);
      throw error;
    }
  }

  // Analyze price levels
  analyzePriceLevels(buyOrders, sellOrders) {
    const priceStep = 1; // 1 ruble steps
    const levels = {};

    // Group buy orders by price levels
    buyOrders.forEach(order => {
      const level = Math.floor(order.pricePerToken / priceStep) * priceStep;
      if (!levels[level]) levels[level] = { bids: 0, asks: 0 };
      levels[level].bids += order.remainingAmount;
    });

    // Group sell orders by price levels
    sellOrders.forEach(order => {
      const level = Math.floor(order.pricePerToken / priceStep) * priceStep;
      if (!levels[level]) levels[level] = { bids: 0, asks: 0 };
      levels[level].asks += order.remainingAmount;
    });

    return Object.entries(levels)
      .map(([price, data]) => ({
        price: parseFloat(price),
        bids: data.bids,
        asks: data.asks
      }))
      .sort((a, b) => a.price - b.price);
  }

  // Get user performance analytics
  async getUserPerformanceAnalytics(userId, timeRange = '30d') {
    try {
      console.log(`Generating user performance analytics for ${userId}`);

      const timeRanges = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const startTime = new Date(Date.now() - timeRanges[timeRange]);

      const [
        tradingActivity,
        performanceMetrics,
        profitLoss,
        riskMetrics
      ] = await Promise.all([
        this.getUserTradingActivity(userId, startTime),
        this.getUserPerformanceMetrics(userId, startTime),
        this.getUserProfitLoss(userId, startTime),
        this.getUserRiskMetrics(userId, startTime)
      ]);

      return {
        userId,
        timeRange,
        period: { start: startTime, end: new Date() },
        activity: tradingActivity,
        performance: performanceMetrics,
        profitLoss: profitLoss,
        risk: riskMetrics
      };

    } catch (error) {
      console.error('Error generating user performance analytics:', error);
      throw error;
    }
  }

  // Get user trading activity - FIXED calculation
  async getUserTradingActivity(userId, startTime) {
    const trades = await P2PTrade.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      createdAt: { $gte: startTime }
    });

    // Properly separate buy and sell trades based on user role
    const buyTrades = trades.filter(t => 
      t.buyerId && t.buyerId.toString() === userId.toString()
    );
    const sellTrades = trades.filter(t => 
      t.sellerId && t.sellerId.toString() === userId.toString()
    );

    return {
      totalTrades: trades.length,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      completedTrades: trades.filter(t => t.status === 'completed').length,
      failedTrades: trades.filter(t => t.status === 'failed').length,
      disputedTrades: trades.filter(t => t.status === 'disputed').length,
      cancelledTrades: trades.filter(t => t.status === 'cancelled').length,
      avgTradesPerDay: trades.length > 0 ? (trades.length / 30).toFixed(1) : 0 // 30 days period
    };
  }

  // Get user performance metrics - FIXED calculation
  async getUserPerformanceMetrics(userId, startTime) {
    const completedTrades = await P2PTrade.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      createdAt: { $gte: startTime },
      status: 'completed'
    });

    if (completedTrades.length === 0) {
      return {
        totalVolume: 0,
        avgTradeSize: 0,
        avgExecutionTime: 0,
        successRate: 100 // New users start with 100% success rate
      };
    }

    // Calculate total volume (sum of all completed trade values)
    const totalVolume = completedTrades.reduce((sum, trade) => {
      return sum + (trade.totalValue || 0);
    }, 0);
    
    const avgTradeSize = totalVolume / completedTrades.length;

    // Calculate average execution time - FIXED to use correct timestamps
    const executionTimes = completedTrades
      .filter(trade => {
        return trade.timeTracking?.createdAt && trade.timeTracking?.completedAt;
      })
      .map(trade => {
        const startTime = new Date(trade.timeTracking.createdAt);
        const endTime = new Date(trade.timeTracking.completedAt);
        const timeDiff = (endTime - startTime) / (1000 * 60); // minutes
        return Math.max(0, timeDiff); // Ensure positive time
      })
      .filter(time => time >= 0 && time <= 10080); // Filter unrealistic times (0-7 days)

    const avgExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;

    // Calculate success rate based on all trades (not just completed)
    const allTrades = await P2PTrade.countDocuments({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      createdAt: { $gte: startTime }
    });

    const successRate = allTrades > 0 ? (completedTrades.length / allTrades * 100) : 100;

    return {
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      avgTradeSize: parseFloat(avgTradeSize.toFixed(2)),
      avgExecutionTime: Math.round(avgExecutionTime),
      successRate: parseFloat(successRate.toFixed(2))
    };
  }

  // Get user profit/loss analysis
  async getUserProfitLoss(userId, startTime) {
    // This would require more sophisticated tracking of entry/exit prices
    // For now, return basic commission costs
    const trades = await P2PTrade.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      createdAt: { $gte: startTime },
      status: 'completed'
    });

    const totalCommissionPaid = trades.reduce((sum, trade) => {
      // Assuming commission is split or paid by specific party
      return sum + (trade.commission || 0);
    }, 0);

    return {
      totalCommissionPaid,
      tradingCosts: totalCommissionPaid,
      netProfitLoss: -totalCommissionPaid // Simplified calculation
    };
  }

  // Get user risk metrics
  async getUserRiskMetrics(userId, startTime) {
    const user = await User.findById(userId);
    if (!user) return {};

    const recentTrades = await P2PTrade.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      createdAt: { $gte: startTime }
    });

    const disputes = recentTrades.filter(t => t.status === 'disputed').length;
    const failures = recentTrades.filter(t => t.status === 'failed').length;

    return {
      trustScore: user.trustScore,
      disputeRate: recentTrades.length > 0 ? (disputes / recentTrades.length * 100) : 0,
      failureRate: recentTrades.length > 0 ? (failures / recentTrades.length * 100) : 0,
      completionRate: user.completionRate,
      verificationLevel: user.verificationLevel
    };
  }

  // Generate comprehensive market report
  async generateMarketReport(timeRange = '24h') {
    try {
      console.log(`Generating comprehensive market report for ${timeRange}`);

      const [
        tradingStats,
        orderBookAnalytics,
        topTraders,
        marketTrends
      ] = await Promise.all([
        this.getTradingStatistics(timeRange),
        this.getOrderBookAnalytics(),
        this.getTopTraders(timeRange),
        this.getMarketTrends(timeRange)
      ]);

      const report = {
        reportId: `report_${Date.now()}`,
        generatedAt: new Date(),
        timeRange,
        sections: {
          tradingStatistics: tradingStats,
          orderBook: orderBookAnalytics,
          topPerformers: topTraders,
          marketTrends: marketTrends
        },
        summary: this.generateMarketSummary(tradingStats, orderBookAnalytics)
      };

      return report;

    } catch (error) {
      console.error('Error generating market report:', error);
      throw error;
    }
  }

  // Get top traders
  async getTopTraders(timeRange) {
    const timeRanges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(Date.now() - timeRanges[timeRange]);

    const topByVolume = await P2PTrade.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$sellerId',
          totalVolume: { $sum: '$totalValue' },
          tradesCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalVolume: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return { topByVolume };
  }

  // Get market trends
  async getMarketTrends(timeRange) {
    // Simplified trend analysis
    const timeRanges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeRanges[timeRange]);
    const midTime = new Date(startTime.getTime() + (endTime.getTime() - startTime.getTime()) / 2);

    const [firstHalf, secondHalf] = await Promise.all([
      P2PTrade.aggregate([
        {
          $match: {
            createdAt: { $gte: startTime, $lt: midTime },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            avgPrice: { $avg: '$pricePerToken' },
            volume: { $sum: '$totalValue' },
            trades: { $sum: 1 }
          }
        }
      ]),
      P2PTrade.aggregate([
        {
          $match: {
            createdAt: { $gte: midTime, $lte: endTime },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            avgPrice: { $avg: '$pricePerToken' },
            volume: { $sum: '$totalValue' },
            trades: { $sum: 1 }
          }
        }
      ])
    ]);

    const first = firstHalf[0] || { avgPrice: 0, volume: 0, trades: 0 };
    const second = secondHalf[0] || { avgPrice: 0, volume: 0, trades: 0 };

    return {
      priceChange: {
        absolute: second.avgPrice - first.avgPrice,
        percentage: first.avgPrice > 0 ? ((second.avgPrice - first.avgPrice) / first.avgPrice * 100) : 0
      },
      volumeChange: {
        absolute: second.volume - first.volume,
        percentage: first.volume > 0 ? ((second.volume - first.volume) / first.volume * 100) : 0
      },
      activityChange: {
        absolute: second.trades - first.trades,
        percentage: first.trades > 0 ? ((second.trades - first.trades) / first.trades * 100) : 0
      }
    };
  }

  // Generate market summary
  generateMarketSummary(tradingStats, orderBookAnalytics) {
    const insights = [];

    // Trading volume insights
    if (tradingStats.volume.totalRubles > 1000000) {
      insights.push('Высокий торговый объем - сильная активность на рынке');
    } else if (tradingStats.volume.totalRubles < 100000) {
      insights.push('Низкий торговый объем - ограниченная активность на рынке');
    }

    // Completion rate insights
    if (tradingStats.trades.completionRate > 95) {
      insights.push('Отличный уровень завершения сделок - высокая удовлетворенность пользователей');
    } else if (tradingStats.trades.completionRate < 80) {
      insights.push('Низкий уровень завершения сделок - потенциальные проблемы с пользовательским опытом');
    }

    // Spread insights
    if (orderBookAnalytics.spread.percentage < 1) {
      insights.push('Узкий спред указывает на здоровую ликвидность рынка');
    } else if (orderBookAnalytics.spread.percentage > 5) {
      insights.push('Широкий спред указывает на низкую ликвидность или высокую волатильность');
    }

    return {
      keyMetrics: {
        totalVolume: tradingStats.volume.totalRubles,
        completionRate: tradingStats.trades.completionRate,
        spread: orderBookAnalytics.spread.percentage,
        activeTraders: tradingStats.users.uniqueTraders
      },
      insights: insights,
      healthScore: this.calculateMarketHealthScore(tradingStats, orderBookAnalytics)
    };
  }

  // Calculate market health score (0-100)
  calculateMarketHealthScore(tradingStats, orderBookAnalytics) {
    let score = 50; // Base score

    // Volume factor
    if (tradingStats.volume.totalRubles > 500000) score += 20;
    else if (tradingStats.volume.totalRubles > 100000) score += 10;

    // Completion rate factor
    if (tradingStats.trades.completionRate > 95) score += 15;
    else if (tradingStats.trades.completionRate > 85) score += 10;
    else if (tradingStats.trades.completionRate < 70) score -= 20;

    // Spread factor
    if (orderBookAnalytics.spread.percentage < 2) score += 10;
    else if (orderBookAnalytics.spread.percentage > 10) score -= 15;

    // Order book depth factor
    if (orderBookAnalytics.orders.totalBuyOrders > 10 && orderBookAnalytics.orders.totalSellOrders > 10) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Clear cache
  clearCache() {
    this.analyticsCache.clear();
    console.log('Analytics cache cleared');
  }
  
  // AI-Powered Market Insights
  async getAIInsights() {
    try {
      console.log('Generating AI-powered market insights...');
      
      // Get recent market data
      const [marketStats, orderBook, trends] = await Promise.all([
        this.getTradingStatistics('24h'),
        this.getOrderBookAnalytics(),
        this.getMarketTrends('7d')
      ]);
      
      // Generate AI insights based on data
      const insights = this.generateAIInsights(marketStats, orderBook, trends);
      
      return insights;
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return {
        trend: 'Недостаточно данных для анализа',
        confidence: 0,
        recommendation: 'Следите за обновлениями рынка'
      };
    }
  }
  
  // Generate AI insights (simplified version)
  generateAIInsights(marketStats, orderBook, trends) {
    try {
      let trend = '';
      let confidence = 0.5;
      let recommendation = '';
      
      // Analyze price trend
      if (trends.priceChange.percentage > 2) {
        trend = 'Бычий тренд: цена растет';
        confidence = 0.8;
        recommendation = 'Рассмотрите покупку по текущим ценам';
      } else if (trends.priceChange.percentage < -2) {
        trend = 'Медвежий тренд: цена падает';
        confidence = 0.8;
        recommendation = 'Рассмотрите продажу или подождите восстановления';
      } else {
        trend = 'Боковой тренд: цена стабильна';
        confidence = 0.6;
        recommendation = 'Следите за объемами и новостями';
      }
      
      // Analyze volume trend
      if (trends.volumeChange.percentage > 50) {
        trend += ', высокий объем торгов';
        confidence = Math.min(1, confidence + 0.1);
      } else if (trends.volumeChange.percentage < -30) {
        trend += ', низкий объем торгов';
        confidence = Math.max(0, confidence - 0.1);
      }
      
      // Analyze market health
      const healthScore = this.calculateMarketHealthScore(marketStats, orderBook);
      if (healthScore > 80) {
        recommendation += '. Рынок находится в хорошем состоянии';
      } else if (healthScore < 50) {
        recommendation += '. Будьте осторожны, рынок нестабилен';
      }
      
      return {
        trend,
        confidence,
        recommendation,
        healthScore,
        volume: marketStats.volume.totalRubles,
        completionRate: marketStats.trades.completionRate
      };
    } catch (error) {
      console.error('Error in AI insights generation:', error);
      return {
        trend: 'Ошибка анализа данных',
        confidence: 0,
        recommendation: 'Попробуйте позже'
      };
    }
  }
}

module.exports = new AnalyticsService();