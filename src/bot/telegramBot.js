/**
 * Bot Module
 * Initializes and configures the Telegram bot
 */

const { Telegraf } = require('telegraf');
const config = require('../config/configuration');
const messageHandler = require('../handlers/messageHandler');

class Bot {
  constructor() {
    this.bot = new Telegraf(config.telegram.botToken);
    this.setupMiddleware();
    this.setupHandlers();
  }

  // Setup middleware
  setupMiddleware() {
    // Error handling middleware
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      if (ctx && ctx.reply) {
        ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      }
    });

    // Logging middleware
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const user = ctx.from?.username || ctx.from?.id || 'Unknown';
      console.log(`📨 Message from ${user}: ${ctx.message?.text || ctx.callbackQuery?.data || 'callback'}`);
      
      await next();
      
      const ms = Date.now() - start;
      console.log(`⚡ Processed in ${ms}ms`);
    });
  }

  // Setup command and callback handlers
  setupHandlers() {
    // Commands
    this.bot.start(messageHandler.handleStart.bind(messageHandler));
    this.bot.command('price', messageHandler.handlePrice.bind(messageHandler));

    // Text messages (for regular keyboard buttons)
    this.bot.on('text', messageHandler.handleTextMessage.bind(messageHandler));

    // Callback handlers
    this.bot.action('personal_cabinet', messageHandler.handlePersonalCabinet.bind(messageHandler));
    this.bot.action('p2p_menu', messageHandler.handleP2PMenu.bind(messageHandler));
    this.bot.action('get_price', messageHandler.handlePrice.bind(messageHandler));
    this.bot.action('create_wallet', messageHandler.handleCreateWallet.bind(messageHandler));
    this.bot.action('edit_wallet', messageHandler.handleWalletEdit.bind(messageHandler));
    this.bot.action('show_private_key', messageHandler.handleShowPrivateKey.bind(messageHandler));
    this.bot.action('refresh_balance', messageHandler.handleRefreshBalance.bind(messageHandler));
    this.bot.action('back_to_menu', messageHandler.handleBackToMenu.bind(messageHandler));
  }

  // Set webhook
  async setWebhook() {
    try {
      const webhookUrl = `${config.telegram.webhookUrl}${config.telegram.webhookPath}`;
      await this.bot.telegram.setWebhook(webhookUrl);
      console.log('✅ Webhook set:', webhookUrl);
      return true;
    } catch (error) {
      console.error('❌ Webhook setup error:', error);
      throw error;
    }
  }

  // Get bot instance
  getInstance() {
    return this.bot;
  }

  // Start bot (for development)
  async startPolling() {
    try {
      console.log('🚀 Starting bot in polling mode...');
      await this.bot.launch();
      console.log('✅ Bot started successfully');
      
      // Graceful shutdown
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
      
    } catch (error) {
      console.error('❌ Bot start error:', error);
      throw error;
    }
  }

  // Stop bot
  async stop(signal = 'manual') {
    try {
      console.log(`⛔ Stopping bot (${signal})...`);
      await this.bot.stop(signal);
      console.log('✅ Bot stopped successfully');
    } catch (error) {
      console.error('❌ Bot stop error:', error);
    }
  }
}

module.exports = new Bot();