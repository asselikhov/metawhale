/**
 * Main Message Handler (Refactored)
 * Delegates to specialized handlers for different functionality areas
 */

const BaseCommandHandler = require('./BaseCommandHandler');
const WalletHandler = require('./WalletHandler');
const TransferHandler = require('./TransferHandler');
const P2PHandler = require('./P2PHandler');
const P2POrdersHandler = require('./P2POrdersHandler');
const sessionManager = require('./SessionManager');

class MessageHandler {
  constructor() {
    this.baseHandler = new BaseCommandHandler();
    this.walletHandler = new WalletHandler();
    this.transferHandler = new TransferHandler();
    this.p2pHandler = new P2PHandler();
    this.ordersHandler = new P2POrdersHandler();
    
    // Inject handlers into baseHandler to avoid circular imports
    this.baseHandler.setHandlers(this.walletHandler, this.p2pHandler, this.transferHandler);
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
}

module.exports = MessageHandler;