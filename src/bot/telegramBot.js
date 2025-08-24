const { Telegraf } = require('telegraf');
const messageHandler = require('../handlers/messageHandler');
const config = require('../config/configuration');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(config.telegram.botToken);
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
    
    const webhookUrl = `${config.telegram.webhookUrl}${config.telegram.webhookPath}/${config.telegram.botToken}`;
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
    await this.bot.launch({ dropPendingUpdates: true });
    console.log('✅ Bot started in polling mode');
  }

  async stop(signal = 'manual') {
    console.log(`⛔ Stopping bot (${signal})...`);
    await this.bot.stop(signal);
    console.log('✅ Bot stopped');
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
    
    // Handle pagination for buy orders
    this.bot.action(/^p2p_buy_orders_page_(\d+)$/, (ctx) => {
      const page = parseInt(ctx.match[1]);
      return messageHandler.handleP2PBuyOrders.call(messageHandler, ctx, page);
    });
    
    // Handle pagination for sell orders
    this.bot.action(/^p2p_sell_orders_page_(\d+)$/, (ctx) => {
      const page = parseInt(ctx.match[1]);
      return messageHandler.handleP2PSellOrders.call(messageHandler, ctx, page);
    });
    
    // Handle user profile view for buy orders
    this.bot.action(/^buy_order_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      return messageHandler.handleP2PUserProfile.call(messageHandler, ctx, userId);
    });
    
    // Handle user profile view for sell orders
    this.bot.action(/^sell_order_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      return messageHandler.handleP2PUserProfile.call(messageHandler, ctx, userId);
    });
  }
}

module.exports = new TelegramBot();