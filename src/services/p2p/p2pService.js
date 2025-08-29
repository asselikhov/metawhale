/**
 * Main P2P Service
 * Coordinates all P2P trading operations
 */

const OrderService = require('./order/OrderService');
const TradeService = require('./trade/TradeService');
const ValidationService = require('./validation/ValidationService');

class P2PService {
  constructor() {
    this.orderService = new OrderService();
    this.tradeService = new TradeService();
    this.validationService = new ValidationService();
  }

  // Delegate to OrderService
  async createBuyOrder(chatId, amount, pricePerToken, minTradeAmount = 1, maxTradeAmount = null) {
    return this.orderService.createBuyOrder(chatId, amount, pricePerToken, minTradeAmount, maxTradeAmount);
  }

  async cancelOrder(orderId, userChatId) {
    return this.orderService.cancelOrder(orderId, userChatId);
  }

  async getActiveOrders(page = 1, limit = 10, filters = {}) {
    return this.orderService.getActiveOrders(page, limit, filters);
  }

  // Delegate to TradeService
  async createTradeFromOrder(takerChatId, buyOrderId, cesAmount) {
    return this.tradeService.createTradeFromOrder(takerChatId, buyOrderId, cesAmount);
  }

  async getUserTrades(chatId, page = 1, limit = 10, status = null) {
    return this.tradeService.getUserTrades(chatId, page, limit, status);
  }

  async updateUserStats(buyerId, sellerId, tradeValue, tradeStatus) {
    return this.tradeService.updateUserStats(buyerId, sellerId, tradeValue, tradeStatus);
  }

  // Delegate to ValidationService
  async validateUserForP2POperations(chatId) {
    return this.validationService.validateUserForP2POperations(chatId);
  }

  validateOrderParameters(amount, pricePerToken, minTradeAmount, maxTradeAmount) {
    return this.validationService.validateOrderParameters(amount, pricePerToken, minTradeAmount, maxTradeAmount);
  }

  async validateUserBalanceForOrder(user, amount, pricePerToken) {
    return this.validationService.validateUserBalanceForOrder(user, amount, pricePerToken);
  }

  async validateTradeCreation(takerChatId, buyOrderId, cesAmount) {
    return this.validationService.validateTradeCreation(takerChatId, buyOrderId, cesAmount);
  }
}

module.exports = P2PService;