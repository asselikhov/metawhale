/**
 * Telegram Bot Manager
 * Centralized Telegram bot management
 */

const { Telegraf } = require('telegraf');
const MessageHandler = require('./MessageHandler');

class TelegramBot {
  constructor(config) {
    this.config = config;
    this.bot = null;
    this.messageHandler = new MessageHandler();
    
    this.initialize();
  }

  initialize() {
    // Validate bot token before creating Telegraf instance
    if (!this.config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
    }
    
    // Create Telegraf instance
    this.bot = new Telegraf(this.config.telegram.botToken, {
      telegram: {
        webhookReply: true,
        timeout: 60000,
        retryAfter: 2000
      },
      handlerTimeout: 90000
    });
    
    this.setupHandlers();
  }

  getInstance() {
    return this.bot;
  }

  setupHandlers() {
    // Basic commands
    this.bot.start((ctx) => {
      return this.messageHandler.handleStart(ctx);
    });
    
    this.bot.command('ces', (ctx) => {
      return this.messageHandler.handlePrice(ctx, 'CES');
    });
    
    // Add more command handlers as needed
    // This is a simplified version - in a full implementation,
    // you would include all the command handlers from the original code
  }

  async setWebhook() {
    if (!this.config.telegram.webhookUrl || this.config.telegram.webhookUrl === 'undefined') {
      console.log('⚠️ WEBHOOK_URL not defined - continuing without webhook');
      return;
    }
    
    const webhookUrl = `${this.config.telegram.webhookUrl}${this.config.telegram.webhookPath}`;
    
    try {
      await this.bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook successfully set: ${webhookUrl}`);
    } catch (error) {
      console.error('❌ Webhook setup failed:', error.message);
    }
  }

  async startPolling() {
    console.log('🔄 Starting bot in polling mode...');
    try {
      await this.bot.launch({ dropPendingUpdates: true });
      console.log('✅ Bot started in polling mode');
    } catch (error) {
      console.error('❌ Failed to start bot in polling mode:', error);
      throw error;
    }
  }

  async stop(signal = 'manual') {
    console.log(`⛔ Stopping bot (${signal})...`);
    try {
      await this.bot.stop(signal);
      console.log('✅ Bot stopped');
    } catch (error) {
      console.error('❌ Error stopping bot:', error);
    }
  }
}

module.exports = TelegramBot;