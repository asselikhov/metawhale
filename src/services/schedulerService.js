/**
 * Scheduler Service
 * Handles scheduled tasks like daily price messages
 */

const cron = require('node-cron');
const config = require('../config/configuration');
const priceService = require('./priceService');
const { PriceHistory, P2POrder } = require('../database/models');
const smartNotificationService = require('./smartNotificationService');

class SchedulerService {
  constructor(bot = null) {
    this.bot = bot;
    this.tasks = new Map();
    this.cachedPriceData = null;
    this.lastCacheUpdate = 0;
    this.cacheTTL = 30000; // 30 seconds
    this.lastMessageSent = 0; // Track last message timestamp to prevent duplicates
    this.messageCooldown = 60000; // 1 minute cooldown between messages
  }

  // Set bot instance
  setBot(bot) {
    this.bot = bot;
  }

  // Get cached or fresh price data
  async getPriceData() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cachedPriceData && (now - this.lastCacheUpdate) < this.cacheTTL) {
      return this.cachedPriceData;
    }
    
    // Fetch fresh data
    try {
      const priceData = await priceService.getCESPrice();
      
      // Update cache
      this.cachedPriceData = priceData;
      this.lastCacheUpdate = now;
      
      // Save to database in background
      if (!priceData.cached) {
        // Use setImmediate to avoid blocking
        setImmediate(async () => {
          try {
            await new PriceHistory(priceData).save();
            console.log(`💾 Price data saved: $${priceData.price.toFixed(2)} | ATH: $${priceData.ath.toFixed(2)}`);
          } catch (saveError) {
            console.error('Error saving price data:', saveError);
          }
        });
      }
      
      return priceData;
    } catch (error) {
      console.error('Error fetching price data:', error);
      
      // Return cached data even if stale as fallback
      if (this.cachedPriceData) {
        return this.cachedPriceData;
      }
      
      throw error;
    }
  }

  // Send price to group
  async sendPriceToGroup() {
    const targetGroupId = config.schedule.groupId;
    
    try {
      // Prevent duplicate messages within cooldown period
      const now = Date.now();
      if (now - this.lastMessageSent < this.messageCooldown) {
        console.log('⚠️ Skipping duplicate message - cooldown active');
        return;
      }
      
      console.log('📅 Sending scheduled price message to group...');
      
      const priceData = await this.getPriceData();
      
      // Determine emoji for price change
      const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
      const changeSign = priceData.change24h >= 0 ? '+' : '';
      
      // Check if current price is ATH
      const isNewATH = priceData.price >= priceData.ath;
      const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
      
      // Message format with new P2P promotional content
      const message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $ ${priceData.price.toFixed(2)} | ₽ ${priceData.priceRub.toFixed(2)}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(1)}% • 🅥 $ ${priceService.formatNumber(priceData.volume24h).replace(/(\d+\.\d{2})K/, (match) => {
        const num = parseFloat(match.replace('K', ''));
        return num.toFixed(1) + 'K';
      })} • 🅐🅣🅗 ${athDisplay}

Торгуй CES удобно и безопасно  
P2P Биржа: https://t.me/rogassistant_bot
Покупка и продажа за ₽`;
      
      // Send message to group without parse_mode to avoid Markdown issues
      if (this.bot) {
        await this.bot.telegram.sendMessage(targetGroupId, message);
        this.lastMessageSent = now; // Update last message timestamp
        console.log(`✅ Price message sent to group ${targetGroupId}`);
      } else {
        console.error('❌ Bot instance not available for scheduled message');
      }
      
    } catch (error) {
      console.error('❌ Scheduled message error:', error);
      
      // Try to send error message to group
      try {
        if (this.bot) {
          await this.bot.telegram.sendMessage(targetGroupId, '❌ Не удается получить цену CES в данный момент.');
        }
      } catch (sendError) {
        console.error('❌ Error sending error message:', sendError);
      }
    }
  }

  // Setup scheduled price messages
  setupDailyPriceMessage() {
    try {
      // Stop existing task if it exists to prevent duplicates
      if (this.tasks.has('dailyPrice')) {
        const existingTask = this.tasks.get('dailyPrice');
        existingTask.stop();
        console.log('⚠️ Stopped existing daily price task to prevent duplicates');
      }
      
      const task = cron.schedule(config.schedule.dailyTime, () => {
        console.log('🕕 19:00 Moscow time - sending CES price to group');
        // Use setImmediate to avoid blocking the scheduler
        setImmediate(() => this.sendPriceToGroup());
      }, {
        scheduled: true,
        timezone: config.schedule.timezone
      });

      this.tasks.set('dailyPrice', task);
      
      console.log('⏰ Scheduled message configured for 19:00 Moscow time');
      console.log(`📱 Target group: ${config.schedule.groupId}`);
      
    } catch (error) {
      console.error('❌ Scheduler setup error:', error);
    }
  }

  // 🕰️ P2P ORDER TIMEOUT MONITORING
  
  /**
   * Проверяет и отменяет просроченные P2P ордера
   */
  async checkExpiredP2POrders() {
    try {
      console.log('🔍 [P2P-TIMER] Проверка просроченных P2P ордеров...');
      
      const now = new Date();
      
      // Находим все активные ордера
      const activeOrders = await P2POrder.find({
        status: { $in: ['active', 'partial'] }
      }).populate('userId');
      
      let expiredCount = 0;
      let warningCount = 0;
      
      for (const order of activeOrders) {
        const timeLimit = order.tradeTimeLimit || 30; // По умолчанию 30 минут
        const orderCreatedAt = new Date(order.createdAt);
        const expiresAt = new Date(orderCreatedAt.getTime() + timeLimit * 60 * 1000);
        const timeRemaining = expiresAt.getTime() - now.getTime();
        
        // Проверяем истечение времени
        if (timeRemaining <= 0) {
          // Ордер просрочен - отменяем
          await this.cancelExpiredOrder(order);
          expiredCount++;
        } else if (timeRemaining <= 5 * 60 * 1000) { // 5 минут до истечения
          // Отправляем предупреждение
          await this.sendOrderExpirationWarning(order, Math.ceil(timeRemaining / 60000));
          warningCount++;
        }
      }
      
      if (expiredCount > 0 || warningCount > 0) {
        console.log(`✅ [P2P-TIMER] Обработано: ${expiredCount} просроченных, ${warningCount} предупреждений`);
      }
      
    } catch (error) {
      console.error('❌ [P2P-TIMER] Ошибка проверки просроченных ордеров:', error);
    }
  }
  
  /**
   * Отменяет просроченный ордер
   */
  async cancelExpiredOrder(order) {
    try {
      console.log(`⏰ [P2P-TIMER] Отмена просроченного ордера ${order._id} (тип: ${order.type})`);
      
      // Обновляем статус ордера
      order.status = 'expired';
      order.cancelReason = 'Время ордера истекло';
      order.canceledAt = new Date();
      await order.save();
      
      // Освобождаем заблокированные средства для sell ордеров
      if (order.type === 'sell' && order.escrowLocked && order.escrowAmount > 0) {
        const escrowService = require('./escrowService');
        await escrowService.releaseTokensFromEscrow(order.userId, null, 'CES', order.escrowAmount);
        console.log(`💰 [P2P-TIMER] Освобождены заблокированные токены: ${order.escrowAmount} CES`);
      }
      
      // Освобождаем заблокированные рубли для buy ордеров
      if (order.type === 'buy') {
        const rubleReserveService = require('./rubleReserveService');
        await rubleReserveService.releaseReservation(order.userId.toString(), order._id.toString());
        console.log(`💰 [P2P-TIMER] Освобождены заблокированные рубли для ордера ${order._id}`);
      }
      
      // Отправляем уведомление пользователю
      if (order.userId && order.userId.chatId && this.bot) {
        const timeDescription = {
          10: '10 минут (быстрые сделки)',
          15: '15 минут (скорые сделки)',
          30: '30 минут (стандартные сделки)',
          60: '1 час (длинные сделки)'
        };
        
        const orderType = order.type === 'buy' ? 'покупку' : 'продажу';
        const timeDesc = timeDescription[order.tradeTimeLimit] || `${order.tradeTimeLimit} минут`;
        
        const message = `⏰ ОРДЕР ОТМЕНЕН\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `Ваш ордер на ${orderType} автоматически отменен из-за истечения времени.\n\n` +
                       `📊 Детали ордера:\n` +
                       `• Количество: ${order.amount} CES\n` +
                       `• Цена: ₽${order.pricePerToken} за CES\n` +
                       `• Время ордера: ${timeDesc}\n\n` +
                       `💡 Совет: Вы можете изменить время ордера в настройках P2P профиля.`;
        
        await this.bot.telegram.sendMessage(order.userId.chatId, message);
      }
      
    } catch (error) {
      console.error(`❌ [P2P-TIMER] Ошибка отмены ордера ${order._id}:`, error);
    }
  }
  
  /**
   * Отправляет предупреждение о скором истечении ордера
   */
  async sendOrderExpirationWarning(order, minutesRemaining) {
    try {
      if (!order.userId || !order.userId.chatId || !this.bot) {
        return;
      }
      
      // Проверяем, не отправляли ли уже предупреждение
      if (order.warningsent) {
        return;
      }
      
      const orderType = order.type === 'buy' ? 'покупку' : 'продажу';
      
      const message = `⚠️ ПРЕДУПРЕЖДЕНИЕ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ваш ордер на ${orderType} будет автоматически отменен через ${minutesRemaining} мин.\n\n` +
                     `📊 Детали ордера:\n` +
                     `• Количество: ${order.amount} CES\n` +
                     `• Цена: ₽${order.pricePerToken} за CES\n\n` +
                     `🔧 Чтобы продлить время, отмените и создайте новый ордер.`;
      
      await this.bot.telegram.sendMessage(order.userId.chatId, message);
      
      // Помечаем, что предупреждение отправлено
      order.warningSent = true;
      await order.save();
      
      console.log(`⚠️ [P2P-TIMER] Отправлено предупреждение пользователю ${order.userId.chatId} об ордере ${order._id}`);
      
    } catch (error) {
      console.error(`❌ [P2P-TIMER] Ошибка отправки предупреждения для ордера ${order._id}:`, error);
    }
  }
  
  /**
   * Настройка периодической проверки P2P таймеров
   */
  setupP2PTimerMonitoring() {
    try {
      // Останавливаем существующую задачу если есть
      if (this.tasks.has('p2pTimerCheck')) {
        const existingTask = this.tasks.get('p2pTimerCheck');
        existingTask.stop();
        console.log('⚠️ Остановлена существующая задача мониторинга P2P таймеров');
      }
      
      // Запускаем проверку каждые 2 минуты
      const task = cron.schedule('*/2 * * * *', () => {
        console.log('🕐 Запуск проверки P2P таймеров');
        setImmediate(() => this.checkExpiredP2POrders());
      }, {
        scheduled: true,
        timezone: config.schedule.timezone
      });
      
      this.tasks.set('p2pTimerCheck', task);
      
      console.log('⏰ Настроен мониторинг P2P таймеров (каждые 2 минуты)');
      
    } catch (error) {
      console.error('❌ Ошибка настройки мониторинга P2P таймеров:', error);
    }
  }
  
  // Start all scheduled tasks
  startScheduler() {
    console.log('🔄 Starting scheduler service...');
    this.setupDailyPriceMessage();
    this.setupP2PTimerMonitoring(); // Добавляем мониторинг P2P таймеров
    console.log('✅ Scheduler service started');
  }

  // Stop all scheduled tasks
  stopScheduler() {
    console.log('⛔ Stopping scheduler service...');
    
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`⛔ Stopped task: ${name}`);
    });
    
    this.tasks.clear();
    console.log('✅ Scheduler service stopped');
  }

  // Get active tasks
  getActiveTasks() {
    const activeTasks = [];
    this.tasks.forEach((task, name) => {
      activeTasks.push({
        name,
        running: task.running
      });
    });
    return activeTasks;
  }

  // Reset message cooldown (for testing or manual trigger)
  resetMessageCooldown() {
    this.lastMessageSent = 0;
    console.log('✅ Message cooldown reset');
  }

  // Get cooldown status
  getCooldownStatus() {
    const now = Date.now();
    const remainingCooldown = Math.max(0, this.messageCooldown - (now - this.lastMessageSent));
    return {
      isInCooldown: remainingCooldown > 0,
      remainingMs: remainingCooldown,
      lastMessageSent: new Date(this.lastMessageSent).toISOString()
    };
  }
}

module.exports = new SchedulerService();