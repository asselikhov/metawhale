/**
 * Main Message Handler (Refactored)
 * Delegates to specialized handlers for different functionality areas
 */

const { Markup } = require('telegraf');
const BaseCommandHandler = require('./BaseCommandHandler');
const WalletHandler = require('./WalletHandler');
const TransferHandler = require('./TransferHandler');
const P2PHandler = require('./P2PHandler');
const P2POrdersHandler = require('./P2POrdersHandler');
const P2PDataHandler = require('./P2PDataHandler');
const sessionManager = require('./SessionManager');

class MessageHandler {
  constructor() {
    this.baseHandler = new BaseCommandHandler();
    this.walletHandler = new WalletHandler();
    this.transferHandler = new TransferHandler();
    this.p2pHandler = new P2PHandler();
    this.ordersHandler = new P2POrdersHandler();
    this.dataHandler = new P2PDataHandler();
    
    // Inject handlers into baseHandler to avoid circular imports
    this.baseHandler.setHandlers(this.walletHandler, this.p2pHandler, this.transferHandler, this.dataHandler);
  }

  // Session management methods (backward compatibility)
  getUserSession(chatId) {
    return sessionManager.getUserSession(chatId);
  }

  clearUserSession(chatId) {
    return sessionManager.clearUserSession(chatId);
  }

  setSessionData(chatId, key, value) {
    return sessionManager.setSessionData(chatId, key, value);
  }

  getSessionData(chatId, key) {
    return sessionManager.getSessionData(chatId, key);
  }

  // Delegate basic commands
  async handleStart(ctx) {
    return this.baseHandler.handleStart(ctx);
  }

  async handlePrice(ctx) {
    return this.baseHandler.handlePrice(ctx);
  }

  async handleTextMessage(ctx) {
    return this.baseHandler.handleTextMessage(ctx);
  }

  async handleBackToMenu(ctx) {
    return this.baseHandler.handleBackToMenu(ctx);
  }

  // Delegate wallet operations
  async handlePersonalCabinetText(ctx) {
    return this.walletHandler.handlePersonalCabinetText(ctx);
  }

  async handleUserProfile(ctx) {
    return this.walletHandler.handleUserProfile(ctx);
  }

  async handleCreateWallet(ctx) {
    return this.walletHandler.handleCreateWallet(ctx);
  }

  async handleWalletDetails(ctx) {
    return this.walletHandler.handleWalletDetails(ctx);
  }

  async handleWalletEdit(ctx) {
    return this.walletHandler.handleWalletEdit(ctx);
  }

  async handleShowPrivateKey(ctx) {
    return this.walletHandler.handleShowPrivateKey(ctx);
  }

  async handleExportWallet(ctx) {
    return this.walletHandler.handleExportWallet(ctx);
  }

  async handleDeleteWallet(ctx) {
    return this.walletHandler.handleDeleteWallet(ctx);
  }

  async handleConfirmDeleteWallet(ctx) {
    return this.walletHandler.handleConfirmDeleteWallet(ctx);
  }

  async handleRefreshBalance(ctx) {
    return this.walletHandler.handleRefreshBalance(ctx);
  }

  // Delegate transfer operations
  async handleTransferMenu(ctx) {
    return this.transferHandler.handleTransferMenu(ctx);
  }

  async handleSendCESTokens(ctx) {
    return this.transferHandler.handleSendCESTokens(ctx);
  }

  async handleSendPOLTokens(ctx) {
    return this.transferHandler.handleSendPOLTokens(ctx);
  }

  async handleTransactionHistory(ctx) {
    return this.transferHandler.handleTransactionHistory(ctx);
  }

  async handleTransferConfirmation(ctx) {
    return this.transferHandler.handleTransferConfirmation(ctx);
  }

  async processTransferCommand(ctx, transferData, tokenType) {
    return this.transferHandler.processTransferCommand(ctx, transferData, tokenType);
  }

  // Delegate P2P operations
  async handleP2PMenu(ctx) {
    return this.p2pHandler.handleP2PMenu(ctx);
  }

  async handleP2PBuyCES(ctx) {
    return this.p2pHandler.handleP2PBuyCES(ctx);
  }

  async handleP2PSellCES(ctx) {
    return this.p2pHandler.handleP2PSellCES(ctx);
  }

  async handleP2PMarketOrders(ctx) {
    return this.p2pHandler.handleP2PMarketOrders(ctx);
  }

  async handleP2PTopTraders(ctx) {
    return this.p2pHandler.handleP2PTopTraders(ctx);
  }

  async handleP2PMyData(ctx) {
    return this.p2pHandler.handleP2PMyData(ctx);
  }

  // Delegate P2P data operations
  async handleP2PEditData(ctx) {
    return this.dataHandler.handleP2PEditData(ctx);
  }

  async handleP2PEditFullName(ctx) {
    return this.dataHandler.handleP2PEditFullName(ctx);
  }

  async handleP2PEditPaymentMethods(ctx) {
    return this.dataHandler.handleP2PEditPaymentMethods(ctx);
  }

  async handleP2PToggleBank(ctx, bankCode) {
    return this.dataHandler.handleP2PToggleBank(ctx, bankCode);
  }

  async handleP2PSavePaymentMethods(ctx) {
    return this.dataHandler.handleP2PSavePaymentMethods(ctx);
  }

  async handleP2PEditContact(ctx) {
    return this.dataHandler.handleP2PEditContact(ctx);
  }

  async handleP2PEditConditions(ctx) {
    return this.dataHandler.handleP2PEditConditions(ctx);
  }

  async handleP2PToggleUseInOrders(ctx) {
    return this.dataHandler.handleP2PToggleUseInOrders(ctx);
  }

  async handleP2PBuyerView(ctx) {
    return this.dataHandler.handleP2PBuyerView(ctx);
  }

  async processP2POrder(ctx, orderData, orderType) {
    return this.p2pHandler.processP2POrder(ctx, orderData, orderType);
  }

  async processUserMessage(ctx, text) {
    return this.p2pHandler.processUserMessage(ctx, text);
  }

  // Delegate P2P orders operations
  async handleP2PBuyOrders(ctx, page) {
    return this.ordersHandler.handleP2PBuyOrders(ctx, page);
  }

  async handleP2PSellOrders(ctx, page) {
    return this.ordersHandler.handleP2PSellOrders(ctx, page);
  }

  async handleP2PMyOrders(ctx, page) {
    return this.ordersHandler.handleP2PMyOrders(ctx, page);
  }

  // Placeholder methods for future implementation
  async handleP2PAnalytics(ctx) {
    await ctx.reply('🚧 Функция аналитики в разработке');
  }

  async handleUserMessaging(ctx, targetUserId) {
    await ctx.reply('🚧 Функция личных сообщений в разработке');
  }

  async handleCancelOrder(ctx, orderId) {
    await ctx.reply('🚧 Функция отмены ордеров в разработке');
  }

  async handleP2POrderConfirmation(ctx) {
    await ctx.reply('🚧 Функция подтверждения ордеров в разработке');
  }

  async handleP2PMyProfile(ctx) {
    await ctx.reply('🚧 Функция просмотра профиля в разработке');
  }

  async handleCreateOrderWithUser(ctx, userId) {
    await ctx.reply('🚧 Функция создания ордера с пользователем в разработке');
  }

  async handleCreateBuyOrderWithUser(ctx, userId) {
    await ctx.reply('🚧 Функция создания ордера на покупку в разработке');
  }

  async handleCreateSellOrderWithUser(ctx, userId) {
    await ctx.reply('🚧 Функция создания ордера на продажу в разработке');
  }

  async handleConfirmCancelOrder(ctx, orderId) {
    await ctx.reply('🚧 Функция подтверждения отмены ордера в разработке');
  }

  async handleP2PUserProfile(ctx, userId) {
    await ctx.reply('🚧 Функция просмотра профиля пользователя в разработке');
  }

  async handleEnterAmount(ctx, userId) {
    await ctx.reply('🚧 Функция ввода суммы в разработке');
  }

  async handleBuyOrderDetails(ctx, userId, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Validate user profile completion before allowing interaction with makers
      const validation = await this.dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_buy_orders')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // TODO: Implement full order details view
      await ctx.reply('🚧 Функция просмотра деталей ордера на покупку в разработке');
      
    } catch (error) {
      console.error('Buy order details error:', error);
      await ctx.reply('❌ Ошибка отображения деталей ордера.');
    }
  }

  async handleSellOrderDetails(ctx, userId, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Validate user profile completion before allowing interaction with makers
      const validation = await this.dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_sell_orders')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // TODO: Implement full order details view
      await ctx.reply('🚧 Функция просмотра деталей ордера на продажу в разработке');
      
    } catch (error) {
      console.error('Sell order details error:', error);
      await ctx.reply('❌ Ошибка отображения деталей ордера.');
    }
  }
}

module.exports = MessageHandler;