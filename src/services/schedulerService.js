/**
 * Scheduler Service
 * Handles scheduled tasks like daily price messages
 */

const cron = require('node-cron');
const config = require('../config/configuration');
const priceService = require('./priceService');
const { PriceHistory } = require('../database/models');

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

⚡️ Торгуй CES удобно и безопасно  
💱 [P2P Биржа](https://t.me/rogassistant_bot): Покупка и продажа за ₽`;
      
      // Send message to group
      if (this.bot) {
        await this.bot.telegram.sendMessage(targetGroupId, message, { parse_mode: 'Markdown' });
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

  // Start all scheduled tasks
  startScheduler() {
    console.log('🔄 Starting scheduler service...');
    this.setupDailyPriceMessage();
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