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
  }

  // Set bot instance
  setBot(bot) {
    this.bot = bot;
  }

  // Send price to group
  async sendPriceToGroup() {
    const targetGroupId = config.schedule.groupId;
    
    try {
      console.log('📅 Sending scheduled price message to group...');
      
      const priceData = await priceService.getCESPrice();
      
      // Save data to database
      if (!priceData.cached) {
        await new PriceHistory(priceData).save();
        console.log(`💾 Price data saved: $${priceData.price.toFixed(2)} | ATH: $${priceData.ath.toFixed(2)}`);
      }
      
      // Determine emoji for price change
      const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
      const changeSign = priceData.change24h >= 0 ? '+' : '';
      
      // Check if current price is ATH
      const isNewATH = priceData.price >= priceData.ath;
      const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
      
      // Source indicator (only for database)
      const sourceEmoji = priceData.source === 'database' ? '🗄️' : '';
      
      // Message format exactly as user example
      const message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $ ${priceData.price.toFixed(2)} | ₽ ${priceData.priceRub.toFixed(2)}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(2)}% • 🅥 $ ${priceService.formatNumber(priceData.volume24h)} • 🅐🅣🅗 ${athDisplay}`;
      
      // Send message to group
      if (this.bot) {
        await this.bot.telegram.sendMessage(targetGroupId, message);
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
      const task = cron.schedule(config.schedule.dailyTime, () => {
        console.log('🕕 19:00 Moscow time - sending CES price to group');
        this.sendPriceToGroup();
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
}

module.exports = new SchedulerService();