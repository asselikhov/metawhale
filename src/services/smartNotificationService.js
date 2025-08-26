/**
 * Smart Notification Service
 * AI-powered notification system for P2P trading platform
 */

const { User, P2POrder, P2PTrade } = require('../database/models');
const config = require('../config/configuration');
// Remove direct bot import to avoid circular dependencies
// const bot = require('../bot/telegramBot').getInstance();

class SmartNotificationService {
  constructor() {
    this.notificationQueue = [];
    this.isProcessing = false;
    this.userPreferences = new Map();
  }

  // Send smart order match notification
  async sendSmartOrderMatchNotification(userId, matchedOrder, ownOrder) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Check user preferences
      const prefs = await this.getUserNotificationPreferences(userId);
      if (!prefs.orderMatches) return;

      const chatId = user.chatId;
      
      // Personalize notification based on user behavior
      const personalizedMessage = this.generatePersonalizedMatchMessage(
        user, matchedOrder, ownOrder
      );
      
      // Add to notification queue
      this.notificationQueue.push({
        chatId,
        message: personalizedMessage,
        type: 'smart_order_match',
        timestamp: new Date(),
        priority: this.calculateNotificationPriority(user, matchedOrder)
      });
      
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending smart order match notification:', error);
    }
  }

  // Generate personalized match message
  generatePersonalizedMatchMessage(user, matchedOrder, ownOrder) {
    try {
      const typeText = ownOrder.type === 'buy' ? 'покупки' : 'продажи';
      const oppositeTypeText = ownOrder.type === 'buy' ? 'продажи' : 'покупки';
      
      // Get user's preferred payment methods
      const preferredMethods = user.preferredPaymentMethods || ['bank_transfer'];
      const hasPreferredMethod = preferredMethods.includes(matchedOrder.paymentMethods[0]);
      
      // Get trust score information
      const trustScore = matchedOrder.userId.trustScore !== undefined ? matchedOrder.userId.trustScore : 100;
      const trustLevel = trustScore > 800 ? 'Высокий' : trustScore > 500 ? 'Средний' : 'Низкий';
      
      let message = `🔔 Найден подходящий ордер для ${typeText}!\n\n` +
                   `💰 Количество: ${matchedOrder.remainingAmount.toFixed(2)} CES\n` +
                   `💵 Цена: ₽${matchedOrder.pricePerToken.toFixed(2)} за токен\n` +
                   `👤 Пользователь: ${matchedOrder.userId.username || 'Аноним'}\n` +
                   `⭐ Рейтинг: ${trustScore}/1000 (${trustLevel})\n`;
      
      if (hasPreferredMethod) {
        message += `✅ Поддерживает ваш способ оплаты\n`;
      }
      
      message += `\nХотите исполнить сделку?`;
      
      return message;
    } catch (error) {
      console.error('Error generating personalized message:', error);
      // Fallback message
      return `🔔 Найден подходящий ордер!\n\nПроверьте детали в разделе активных ордеров.`;
    }
  }

  // Calculate notification priority
  calculateNotificationPriority(user, matchedOrder) {
    try {
      let priority = 0;
      
      // Higher priority for users with higher trust scores
      const userTrustScore = user.trustScore !== undefined ? user.trustScore : 100;
      priority += userTrustScore / 100;
      
      // Higher priority for orders with larger amounts
      priority += matchedOrder.remainingAmount;
      
      // Higher priority for orders with better prices
      const marketPrice = matchedOrder.pricePerToken; // Simplified
      priority += marketPrice / 10;
      
      // Higher priority for verified users
      if (user.verificationLevel !== 'unverified') {
        priority += 10;
      }
      
      return Math.round(priority);
    } catch (error) {
      console.error('Error calculating notification priority:', error);
      return 0;
    }
  }

  // Send trade status update with smart insights
  async sendSmartTradeStatusNotification(userId, trade, status) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Check user preferences
      const prefs = await this.getUserNotificationPreferences(userId);
      if (!prefs.tradeUpdates) return;

      const chatId = user.chatId;
      let message = '';
      
      console.log(`🔍 [SMART-NOTIFICATION] Generating message for status: ${status}, user: ${user.chatId}`);
      
      switch (status) {
        case 'payment_pending':
          message = this.generatePaymentPendingMessage(user, trade);
          break;
          
        case 'payment_completed':
          message = this.generatePaymentCompletedMessage(user, trade);
          break;
          
        case 'payment_confirmed':
          message = this.generatePaymentConfirmedMessage(user, trade);
          break;
          
        case 'completed':
          message = this.generateTradeCompletedMessage(user, trade);
          break;
          
        case 'cancelled':
          message = this.generateTradeCancelledMessage(user, trade);
          break;
          
        case 'timeout':
          message = this.generateTradeTimeoutMessage(user, trade);
          break;
          
        default:
          console.warn(`⚠️ [SMART-NOTIFICATION] Unknown status: ${status}`);
          message = `ℹ️ Обновление по сделке #${trade._id.toString().substr(0, 8)}`;
      }
      
      console.log(`📝 [SMART-NOTIFICATION] Generated message: "${message}"`);
      
      if (!message || message.trim() === '') {
        console.error(`❌ [SMART-NOTIFICATION] Empty message generated for status: ${status}`);
        return; // Don't send empty messages
      }

      // Add to notification queue
      this.notificationQueue.push({
        chatId,
        message,
        type: 'smart_trade_status',
        timestamp: new Date()
      });
      
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending smart trade status notification:', error);
    }
  }

  // Generate payment pending message
  generatePaymentPendingMessage(user, trade) {
    try {
      const timeLimit = trade.timeTracking?.expiresAt 
        ? Math.ceil((trade.timeTracking.expiresAt - new Date()) / (60 * 1000)) 
        : config.escrow.timeoutMinutes;
      
      return `⏳ Оплата ожидается\n\n` +
            `Сделка #${trade._id.toString().substr(0, 8)}\n` +
            `💰 Сумма: ₽${trade.totalValue.toFixed(2)}\n` +
            `🕐 Время на оплату: ${config.escrow.displayFormat.minutes(timeLimit)}\n\n` +
            `Не забудьте подтвердить оплату после перевода средств!`;
    } catch (error) {
      return `⏳ Оплата ожидается\n\n` +
            `Сделка #${trade._id.toString().substr(0, 8)}\n` +
            `💰 Сумма: ₽${trade.totalValue.toFixed(2)}\n` +
            `🕐 Время на оплату: ${config.escrow.displayFormat.minutes(config.escrow.timeoutMinutes)}`;
    }
  }

  // Generate payment confirmed message
  generatePaymentConfirmedMessage(user, trade) {
    return `✅ Оплата подтверждена\n\n` +
          `Сделка #${trade._id.toString().substr(0, 8)}\n` +
          `Токены будут переведены в ближайшее время\n\n` +
          `Спасибо за использование нашей P2P биржи!`;
  }

  // Generate payment completed message
  generatePaymentCompletedMessage(user, trade) {
    // When seller marks payment as completed, we notify the buyer (maker)
    // user parameter is the buyer who receives notification
    // trade.sellerId is who marked payment as completed
    const isBuyer = trade.buyerId._id.toString() === user._id.toString();
    
    if (isBuyer) {
      // Message for buyer (maker) - seller marked payment as completed
      return `💰 Платёж отмечен как выполненный!\n\n` +
            `Сделка #${trade._id.toString().substr(0, 8)}\n` +
            `💰 Количество: ${trade.amount.toFixed(2)} CES\n` +
            `💵 Сумма: ₽${trade.totalValue.toFixed(2)}\n\n` +
            `Продавец отметил, что получил оплату.\n` +
            `CES будут освобождены с эскроу автоматически.`;
    } else {
      // Message for seller - fallback (shouldn't normally happen)
      return `✅ Платёж отмечен как выполненный\n\n` +
            `Сделка #${trade._id.toString().substr(0, 8)}\n` +
            `Ожидаем подтверждения от покупателя.`;
    }
  }

  // Generate trade completed message
  generateTradeCompletedMessage(user, trade) {
    const isBuyer = trade.buyerId._id.toString() === user._id.toString();
    const roleText = isBuyer ? 'покупателя' : 'продавца';
    const amountText = isBuyer 
      ? `Получено: ${trade.amount.toFixed(2)} CES` 
      : `Продано: ${trade.amount.toFixed(2)} CES`;
    
    return `🎉 Сделка завершена!\n\n` +
          `Сделка #${trade._id.toString().substr(0, 8)}\n` +
          `${amountText}\n` +
          `💵 Сумма: ₽${trade.totalValue.toFixed(2)}\n\n` +
          `Спасибо за участие в сделке как ${roleText}!`;
  }

  // Generate trade cancelled message
  generateTradeCancelledMessage(user, trade) {
    return `❌ Сделка отменена\n\n` +
          `Сделка #${trade._id.toString().substr(0, 8)}\n` +
          `Причина: ${trade.disputeReason || 'Отменено пользователем'}\n\n` +
          `Средства возвращены в кошелек`;
  }

  // Generate trade timeout message
  generateTradeTimeoutMessage(user, trade) {
    return `⏰ Время сделки истекло\n\n` +
          `Сделка #${trade._id.toString().substr(0, 8)}\n` +
          `Средства возвращены в кошелек\n\n` +
          `Попробуйте создать новую сделку с другим пользователем`;
  }

  // Send personalized market insights
  async sendPersonalizedMarketInsights(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Check user preferences
      const prefs = await this.getUserNotificationPreferences(userId);
      if (!prefs.marketInsights) return;

      // Get user's trading history
      const userTrades = await P2PTrade.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      });

      if (userTrades.length === 0) return; // No recent trades

      // Get market analytics service
      const analyticsService = require('./analyticsService');
      const insights = await analyticsService.getAIInsights();
      
      // Personalize insights based on user behavior
      const personalizedInsights = this.personalizeMarketInsights(user, userTrades, insights);
      
      const chatId = user.chatId;
      const message = `📈 Персональные рыночные инсайты\n\n` +
                     `${personalizedInsights.trend}\n` +
                     `Уверенность: ${(personalizedInsights.confidence * 100).toFixed(0)}%\n` +
                     `Рекомендация: ${personalizedInsights.recommendation}`;

      // Add to notification queue
      this.notificationQueue.push({
        chatId,
        message,
        type: 'personalized_insights',
        timestamp: new Date()
      });
      
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending personalized market insights:', error);
    }
  }

  // Personalize market insights
  personalizeMarketInsights(user, userTrades, marketInsights) {
    try {
      // Analyze user's recent trading behavior
      const avgTradeSize = userTrades.reduce((sum, trade) => sum + trade.amount, 0) / userTrades.length;
      const preferredTradeSize = avgTradeSize > 100 ? 'large' : avgTradeSize > 10 ? 'medium' : 'small';
      
      // Adjust recommendation based on user behavior
      let recommendation = marketInsights.recommendation;
      
      if (preferredTradeSize === 'large' && marketInsights.trend.includes('Бычий')) {
        recommendation += '. Рассмотрите крупные сделки для максимизации прибыли.';
      } else if (preferredTradeSize === 'small' && marketInsights.trend.includes('Медвежий')) {
        recommendation += '. Рассмотрите небольшие сделки для минимизации рисков.';
      }
      
      return {
        trend: marketInsights.trend,
        confidence: marketInsights.confidence,
        recommendation: recommendation
      };
    } catch (error) {
      console.error('Error personalizing market insights:', error);
      return marketInsights;
    }
  }

  // Send daily summary notification
  async sendDailySummary(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Check user preferences
      const prefs = await this.getUserNotificationPreferences(userId);
      if (!prefs.dailySummary) return;

      // Get user's daily trading stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyTrades = await P2PTrade.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        createdAt: { $gte: today }
      });

      if (dailyTrades.length === 0) return; // No trades today

      const completedTrades = dailyTrades.filter(t => t.status === 'completed');
      const totalVolume = completedTrades.reduce((sum, trade) => sum + trade.totalValue, 0);
      
      const chatId = user.chatId;
      const message = `📅 Ежедневный отчет\n\n` +
                     `Сделок сегодня: ${dailyTrades.length}\n` +
                     `Завершено: ${completedTrades.length}\n` +
                     `Объем: ₽${totalVolume.toLocaleString('ru-RU')}\n\n` +
                     `Спасибо за активность на нашей P2P бирже!`;

      // Add to notification queue
      this.notificationQueue.push({
        chatId,
        message,
        type: 'daily_summary',
        timestamp: new Date()
      });
      
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending daily summary:', error);
    }
  }

  // Process notification queue with priority
  async processNotificationQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Sort notifications by priority (higher first)
      this.notificationQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift();
        
        // Send notification with rate limiting
        await this.sendNotification(notification);
        
        // Small delay to prevent overwhelming the bot
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Send individual notification
  async sendNotification(notification) {
    try {
      // In a real implementation, you would send the actual Telegram message
      console.log(`[SMART NOTIFICATION] To ${notification.chatId}: ${notification.message}`);
      
      // To avoid circular dependencies, we'll use a callback approach
      // The actual sending will be handled by the message handler
      if (this.notificationCallback) {
        await this.notificationCallback(notification.chatId, notification.message);
      }
      
    } catch (error) {
      console.error('Error sending notification:', error);
      
      // Re-queue failed notifications
      if (notification.retryCount < 3) {
        notification.retryCount = (notification.retryCount || 0) + 1;
        this.notificationQueue.push(notification);
      }
    }
  }

  // Set notification callback (to avoid circular dependencies)
  setNotificationCallback(callback) {
    this.notificationCallback = callback;
  }

  // Get user notification preferences
  async getUserNotificationPreferences(userId) {
    try {
      // Check cache first
      if (this.userPreferences.has(userId.toString())) {
        return this.userPreferences.get(userId.toString());
      }
      
      const user = await User.findById(userId);
      if (!user) return null;
      
      const prefs = {
        orderMatches: user.notificationPrefs?.orderMatches !== false,
        tradeUpdates: user.notificationPrefs?.tradeUpdates !== false,
        marketInsights: user.notificationPrefs?.marketInsights !== false,
        dailySummary: user.notificationPrefs?.dailySummary !== false
      };
      
      // Cache preferences
      this.userPreferences.set(userId.toString(), prefs);
      
      return prefs;
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      return {
        orderMatches: true,
        tradeUpdates: true,
        marketInsights: true,
        dailySummary: true
      };
    }
  }

  // Update user notification preferences
  async updateUserNotificationPreferences(userId, preferences) {
    try {
      await User.findByIdAndUpdate(userId, {
        notificationPrefs: preferences
      });
      
      // Update cache
      this.userPreferences.set(userId.toString(), preferences);
      
      console.log(`Updated notification preferences for user ${userId}`);
    } catch (error) {
      console.error('Error updating user notification preferences:', error);
    }
  }

  // Clear user preferences cache
  clearUserPreferencesCache(userId) {
    if (userId) {
      this.userPreferences.delete(userId.toString());
    } else {
      this.userPreferences.clear();
    }
  }
}

module.exports = new SmartNotificationService();