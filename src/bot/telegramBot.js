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
    this.bot.action('personal_cabinet', messageHandler.handlePersonalCabinetText.bind(messageHandler));
    this.bot.action('p2p_menu', messageHandler.handleP2PMenu.bind(messageHandler));
    this.bot.action('get_price', messageHandler.handlePrice.bind(messageHandler));
    this.bot.action('create_wallet', messageHandler.handleCreateWallet.bind(messageHandler));
    this.bot.action('edit_wallet', messageHandler.handleWalletEdit.bind(messageHandler));
    this.bot.action('wallet_details', messageHandler.handleWalletDetails.bind(messageHandler));
    this.bot.action('transfer_menu', messageHandler.handleTransferMenu.bind(messageHandler));
    this.bot.action('show_private_key', messageHandler.handleShowPrivateKey.bind(messageHandler));
    this.bot.action('export_wallet', messageHandler.handleExportWallet.bind(messageHandler));
    this.bot.action('delete_wallet', messageHandler.handleDeleteWallet.bind(messageHandler));
    this.bot.action('confirm_delete_wallet', messageHandler.handleConfirmDeleteWallet.bind(messageHandler));
    this.bot.action('refresh_balance', messageHandler.handleRefreshBalance.bind(messageHandler));
    this.bot.action('back_to_menu', messageHandler.handleBackToMenu.bind(messageHandler));
    
    // Token transfer handlers
    this.bot.action('send_ces_tokens', messageHandler.handleSendCESTokens.bind(messageHandler));
    this.bot.action('send_pol_tokens', messageHandler.handleSendPOLTokens.bind(messageHandler));
    this.bot.action('transaction_history', messageHandler.handleTransactionHistory.bind(messageHandler));
    
    // P2P Exchange handlers
    this.bot.action('p2p_buy_ces', messageHandler.handleP2PBuyCES.bind(messageHandler));
    this.bot.action('p2p_sell_ces', messageHandler.handleP2PSellCES.bind(messageHandler));
    this.bot.action('p2p_market_orders', messageHandler.handleP2PMarketOrders.bind(messageHandler));
    this.bot.action('p2p_buy_orders', messageHandler.handleP2PBuyOrders.bind(messageHandler));
    this.bot.action('p2p_sell_orders', messageHandler.handleP2PSellOrders.bind(messageHandler));
    this.bot.action('p2p_my_orders', messageHandler.handleP2PMyOrders.bind(messageHandler));
    this.bot.action('p2p_analytics', messageHandler.handleP2PAnalytics.bind(messageHandler));
    this.bot.action('p2p_my_profile', messageHandler.handleP2PMyProfile.bind(messageHandler));
    this.bot.action('p2p_top_traders', messageHandler.handleP2PTopTraders.bind(messageHandler));
    
    // Handle transfer confirmations (dynamic callbacks)
    this.bot.action(/^confirm_transfer_/, (ctx) => {
      return messageHandler.handleTransferConfirmation.call(messageHandler, ctx, ctx.callbackQuery.data);
    });
    
    // Handle P2P order confirmations (dynamic callbacks)
    this.bot.action(/^confirm_p2p_order_/, (ctx) => {
      return messageHandler.handleP2POrderConfirmation.call(messageHandler, ctx, ctx.callbackQuery.data);
    });
    
    // Handle user messaging (dynamic callbacks)
    this.bot.action(/^message_user_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[2];
      return messageHandler.handleUserMessaging.call(messageHandler, ctx, userId);
    });
    
    // Handle order creation with user (dynamic callbacks)
    this.bot.action(/^create_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[3];
      return messageHandler.handleCreateOrderWithUser.call(messageHandler, ctx, userId);
    });
    
    // Handle create buy order with user (dynamic callbacks)
    this.bot.action(/^create_buy_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[4];
      return messageHandler.handleCreateBuyOrderWithUser.call(messageHandler, ctx, userId);
    });
    
    // Handle create sell order with user (dynamic callbacks)
    this.bot.action(/^create_sell_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[4];
      return messageHandler.handleCreateSellOrderWithUser.call(messageHandler, ctx, userId);
    });
    
    // Handle cancel order (dynamic callbacks)
    this.bot.action(/^cancel_order_/, (ctx) => {
      const orderId = ctx.callbackQuery.data.split('_')[2];
      return messageHandler.handleCancelOrder.call(messageHandler, ctx, orderId);
    });
    
    // Handle confirm cancel order (dynamic callbacks)
    this.bot.action(/^confirm_cancel_order_/, (ctx) => {
      const orderId = ctx.callbackQuery.data.split('_')[3];
      return messageHandler.handleConfirmCancelOrder.call(messageHandler, ctx, orderId);
    });
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