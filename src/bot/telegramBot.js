const { Telegraf } = require('telegraf');
const messageHandler = require('../handlers/messageHandler');
const config = require('../config/configuration');

class TelegramBot {
  constructor() {
    // Validate bot token before creating Telegraf instance
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
    }
    
    // Create Telegraf instance with proper webhook domain
    this.bot = new Telegraf(config.telegram.botToken, {
      telegram: {
        webhookReply: true
      }
    });
    this.setupHandlers();
  }

  getInstance() {
    return this.bot;
  }

  async setWebhook() {
    // Проверяем, что webhookUrl определен
    if (!config.telegram.webhookUrl || config.telegram.webhookUrl === 'undefined') {
      throw new Error('WEBHOOK_URL is not defined in environment variables');
    }
    
    // The webhook URL should NOT include the bot token for Telegraf
    // Telegraf automatically handles the token
    const webhookUrl = `${config.telegram.webhookUrl}${config.telegram.webhookPath}`;
    try {
      await this.bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook set to: ${webhookUrl}`);
    } catch (error) {
      console.error('❌ Failed to set webhook:', error);
      throw error;
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

// Setup command and callback handlers
  setupHandlers() {
    // Commands
    this.bot.start((ctx) => {
      console.log('📥 Received /start command');
      return messageHandler.handleStart.call(messageHandler, ctx);
    });
    
    this.bot.command('price', (ctx) => {
      console.log('📥 Received /price command');
      return messageHandler.handlePrice.call(messageHandler, ctx);
    });

    // Text messages (for regular keyboard buttons)
    this.bot.on('text', (ctx) => {
      console.log('📥 Received text message:', ctx.message.text);
      return messageHandler.handleTextMessage.call(messageHandler, ctx);
    });

    // Callback handlers
    this.bot.action('personal_cabinet', (ctx) => {
      console.log('📥 Received personal_cabinet callback');
      return messageHandler.handlePersonalCabinetText.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_menu', (ctx) => {
      console.log('📥 Received p2p_menu callback');
      return messageHandler.handleP2PMenu.call(messageHandler, ctx);
    });
    
    this.bot.action('get_price', (ctx) => {
      console.log('Received get_price callback');
      return messageHandler.handlePrice.call(messageHandler, ctx);
    });
    
    this.bot.action('create_wallet', (ctx) => {
      console.log('Received create_wallet callback');
      return messageHandler.handleCreateWallet.call(messageHandler, ctx);
    });
    
    this.bot.action('edit_wallet', (ctx) => {
      console.log('Received edit_wallet callback');
      return messageHandler.handleWalletEdit.call(messageHandler, ctx);
    });
    
    this.bot.action('wallet_details', (ctx) => {
      console.log('Received wallet_details callback');
      return messageHandler.handleWalletDetails.call(messageHandler, ctx);
    });
    
    this.bot.action('transfer_menu', (ctx) => {
      console.log('Received transfer_menu callback');
      return messageHandler.handleTransferMenu.call(messageHandler, ctx);
    });
    
    this.bot.action('show_private_key', (ctx) => {
      console.log('Received show_private_key callback');
      return messageHandler.handleShowPrivateKey.call(messageHandler, ctx);
    });
    
    this.bot.action('export_wallet', (ctx) => {
      console.log('Received export_wallet callback');
      return messageHandler.handleExportWallet.call(messageHandler, ctx);
    });
    
    this.bot.action('delete_wallet', (ctx) => {
      console.log('Received delete_wallet callback');
      return messageHandler.handleDeleteWallet.call(messageHandler, ctx);
    });
    
    this.bot.action('confirm_delete_wallet', (ctx) => {
      console.log('Received confirm_delete_wallet callback');
      return messageHandler.handleConfirmDeleteWallet.call(messageHandler, ctx);
    });
    
    this.bot.action('refresh_balance', (ctx) => {
      console.log('Received refresh_balance callback');
      return messageHandler.handleRefreshBalance.call(messageHandler, ctx);
    });
    
    this.bot.action('back_to_menu', (ctx) => {
      console.log('Received back_to_menu callback');
      return messageHandler.handleBackToMenu.call(messageHandler, ctx);
    });
    
    // Token transfer handlers
    this.bot.action('send_ces_tokens', (ctx) => {
      console.log('Received send_ces_tokens callback');
      return messageHandler.handleSendCESTokens.call(messageHandler, ctx);
    });
    
    this.bot.action('send_pol_tokens', (ctx) => {
      console.log('Received send_pol_tokens callback');
      return messageHandler.handleSendPOLTokens.call(messageHandler, ctx);
    });
    
    this.bot.action('transaction_history', (ctx) => {
      console.log('Received transaction_history callback');
      return messageHandler.handleTransactionHistory.call(messageHandler, ctx);
    });
    
    // P2P Exchange handlers
    this.bot.action('p2p_buy_ces', (ctx) => {
      console.log('Received p2p_buy_ces callback');
      return messageHandler.handleP2PBuyCES.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_sell_ces', (ctx) => {
      console.log('Received p2p_sell_ces callback');
      return messageHandler.handleP2PSellCES.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_market_orders', (ctx) => {
      console.log('Received p2p_market_orders callback');
      return messageHandler.handleP2PMarketOrders.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_buy_orders', (ctx) => {
      console.log('Received p2p_buy_orders callback');
      return messageHandler.handleP2PBuyOrders.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_sell_orders', (ctx) => {
      console.log('Received p2p_sell_orders callback');
      return messageHandler.handleP2PSellOrders.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_my_orders', (ctx) => {
      console.log('Received p2p_my_orders callback');
      return messageHandler.handleP2PMyOrders.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_analytics', (ctx) => {
      console.log('Received p2p_analytics callback');
      return messageHandler.handleP2PAnalytics.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_my_profile', (ctx) => {
      console.log('Received p2p_my_profile callback');
      return messageHandler.handleP2PMyProfile.call(messageHandler, ctx);
    });
    
    this.bot.action('p2p_top_traders', (ctx) => {
      console.log('Received p2p_top_traders callback');
      return messageHandler.handleP2PTopTraders.call(messageHandler, ctx);
    });
    
    // Handle transfer confirmations
    this.bot.action('confirm_transfer', (ctx) => {
      console.log('Received confirm_transfer callback');
      return messageHandler.handleTransferConfirmation.call(messageHandler, ctx);
    });
    
    // Handle P2P order confirmations
    this.bot.action('confirm_p2p_order', (ctx) => {
      console.log('Received confirm_p2p_order callback');
      return messageHandler.handleP2POrderConfirmation.call(messageHandler, ctx);
    });
    
    // Handle user messaging (dynamic callbacks)
    this.bot.action(/^message_user_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[2];
      console.log('Received message_user callback:', userId);
      return messageHandler.handleUserMessaging.call(messageHandler, ctx, userId);
    });
    
    // Handle order creation with user (dynamic callbacks)
    this.bot.action(/^create_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[3];
      console.log('Received create_order_with callback:', userId);
      return messageHandler.handleCreateOrderWithUser.call(messageHandler, ctx, userId);
    });
    
    // Handle create buy order with user (dynamic callbacks)
    this.bot.action(/^create_buy_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[4];
      console.log('Received create_buy_order_with callback:', userId);
      return messageHandler.handleCreateBuyOrderWithUser.call(messageHandler, ctx, userId);
    });
    
    // Handle create sell order with user (dynamic callbacks)
    this.bot.action(/^create_sell_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[4];
      console.log('Received create_sell_order_with callback:', userId);
      return messageHandler.handleCreateSellOrderWithUser.call(messageHandler, ctx, userId);
    });
    
    // Handle cancel order (dynamic callbacks)
    this.bot.action(/^cancel_order_/, (ctx) => {
      const orderId = ctx.callbackQuery.data.split('_')[2];
      console.log('Received cancel_order callback:', orderId);
      return messageHandler.handleCancelOrder.call(messageHandler, ctx, orderId);
    });
    
    // Handle confirm cancel order (dynamic callbacks)
    this.bot.action(/^confirm_cancel_order_/, (ctx) => {
      const orderId = ctx.callbackQuery.data.split('_')[3];
      console.log('Received confirm_cancel_order callback:', orderId);
      return messageHandler.handleConfirmCancelOrder.call(messageHandler, ctx, orderId);
    });
    
    // Handle pagination for buy orders
    this.bot.action(/^p2p_buy_orders_page_(\d+)$/, (ctx) => {
      const page = parseInt(ctx.match[1]);
      console.log('Received p2p_buy_orders_page callback:', page);
      return messageHandler.handleP2PBuyOrders.call(messageHandler, ctx, page);
    });
    
    // Handle pagination for sell orders
    this.bot.action(/^p2p_sell_orders_page_(\d+)$/, (ctx) => {
      const page = parseInt(ctx.match[1]);
      console.log('Received p2p_sell_orders_page callback:', page);
      return messageHandler.handleP2PSellOrders.call(messageHandler, ctx, page);
    });
    
    // Handle user profile view for buy orders
    this.bot.action(/^buy_order_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      console.log('Received buy_order callback:', userId);
      return messageHandler.handleP2PUserProfile.call(messageHandler, ctx, userId);
    });
    
    // Handle user profile view for sell orders
    this.bot.action(/^sell_order_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      console.log('Received sell_order callback:', userId);
      return messageHandler.handleP2PUserProfile.call(messageHandler, ctx, userId);
    });
    
    // Handle enter amount for P2P trading (dynamic callbacks)
    this.bot.action(/^enter_amount_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      console.log('Received enter_amount callback:', userId);
      return messageHandler.handleEnterAmount.call(messageHandler, ctx, userId);
    });
    
    // Error handling for the bot
    this.bot.catch((err, ctx) => {
      console.error(`❌ Telegram bot error for ${ctx.updateType}:`, err);
      try {
        ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    });
  }
}

module.exports = new TelegramBot();