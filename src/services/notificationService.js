/**
 * Notification Service
 * Advanced notification system for P2P trading platform
 */

const { User, P2POrder, P2PTrade } = require('../database/models');
const bot = require('../bot/telegramBot');

class NotificationService {
  constructor() {
    this.notificationQueue = [];
    this.isProcessing = false;
  }

  // Send personalized order match notification
  async sendOrderMatchNotification(userId, matchedOrder, ownOrder) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const chatId = user.chatId;
      const typeText = ownOrder.type === 'buy' ? 'покупки' : 'продажи';
      const oppositeTypeText = ownOrder.type === 'buy' ? 'продажи' : 'покупки';
      
      const message = `🔔 Найден подходящий ордер для ${typeText}!\n\n` +
                     `💰 Количество: ${matchedOrder.remainingAmount.toFixed(2)} CES\n` +
                     `💵 Цена: ₽${matchedOrder.pricePerToken.toFixed(2)} за токен\n` +
                     `👤 Пользователь: ${matchedOrder.userId.username || 'Аноним'}\n` +
                     `⭐ Рейтинг: ${matchedOrder.userId.trustScore || 100}/1000\n\n` +
                     `Хотите исполнить сделку?`;

      // In a real implementation, you would send this message via the bot
      console.log(`Sending notification to user ${chatId}: ${message}`);
      
      // Add to notification queue for processing
      this.notificationQueue.push({
        chatId,
        message,
        type: 'order_match',
        timestamp: new Date()
      });
      
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending order match notification:', error);
    }
  }

  // Send trade status update notification
  async sendTradeStatusNotification(userId, trade, status) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const chatId = user.chatId;
      let message = '';
      
      switch (status) {
        case 'payment_pending':
          message = `⏳ Оплата ожидается\n\n` +
                   `Сделка #${trade._id.toString().substr(0, 8)}\n` +
                   `💰 Сумма: ₽${trade.totalValue.toFixed(2)}\n` +
                   `🕐 Время на оплату: 30 минут`;
          break;
          
        case 'payment_confirmed':
          message = `✅ Оплата подтверждена\n\n` +
                   `Сделка #${trade._id.toString().substr(0, 8)}\n` +
                   `Токены будут переведены в ближайшее время`;
          break;
          
        case 'completed':
          message = `🎉 Сделка завершена!\n\n` +
                   `Сделка #${trade._id.toString().substr(0, 8)}\n` +
                   `💰 Получено: ${trade.amount.toFixed(2)} CES\n` +
                   `💵 Сумма: ₽${trade.totalValue.toFixed(2)}`;
          break;
          
        case 'cancelled':
          message = `❌ Сделка отменена\n\n` +
                   `Сделка #${trade._id.toString().substr(0, 8)}\n` +
                   `Причина: ${trade.disputeReason || 'Отменено пользователем'}`;
          break;
          
        case 'timeout':
          message = `⏰ Время сделки истекло\n\n` +
                   `Сделка #${trade._id.toString().substr(0, 8)}\n` +
                   `Средства возвращены в кошелек`;
          break;
      }

      // Add to notification queue
      this.notificationQueue.push({
        chatId,
        message,
        type: 'trade_status',
        timestamp: new Date()
      });
      
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending trade status notification:', error);
    }
  }

  // Send personalized market insights
  async sendMarketInsights(userId, insights) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const chatId = user.chatId;
      const message = `📈 Рыночные инсайты для вас\n\n` +
                     `${insights.trend}\n` +
                     `Цена: ₽${insights.currentPrice.toFixed(2)}\n` +
                     `Рекомендация: ${insights.recommendation}`;

      // Add to notification queue
      this.notificationQueue.push({
        chatId,
        message,
        type: 'market_insights',
        timestamp: new Date()
      });
      
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending market insights:', error);
    }
  }

  // Process notification queue
  async processNotificationQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
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
      console.log(`[NOTIFICATION] To ${notification.chatId}: ${notification.message}`);
      
      // Simulate sending message via bot
      // await bot.telegram.sendMessage(notification.chatId, notification.message);
      
    } catch (error) {
      console.error('Error sending notification:', error);
      
      // Re-queue failed notifications
      if (notification.retryCount < 3) {
        notification.retryCount = (notification.retryCount || 0) + 1;
        this.notificationQueue.push(notification);
      }
    }
  }

  // Send bulk notifications (e.g., market updates)
  async sendBulkNotifications(userIds, message) {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        message,
        type: 'bulk',
        timestamp: new Date()
      }));
      
      this.notificationQueue.push(...notifications);
      this.processNotificationQueue();
      
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
    }
  }

  // Get user notification preferences
  async getUserNotificationPreferences(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;
      
      return {
        orderMatches: user.notificationPrefs?.orderMatches !== false,
        tradeUpdates: user.notificationPrefs?.tradeUpdates !== false,
        marketInsights: user.notificationPrefs?.marketInsights !== false,
        dailySummary: user.notificationPrefs?.dailySummary !== false
      };
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      return {
        orderMatches: true,
        tradeUpdates: true,
        marketInsights: true
      };
    }
  }
}

module.exports = new NotificationService();