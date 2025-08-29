/**
 * P2P Service Index
 * Exports the main P2P service and specialized services
 */

const P2PService = require('./p2pService');
const OrderService = require('./order/OrderService');
const TradeService = require('./trade/TradeService');
const ValidationService = require('./validation/ValidationService');

module.exports = {
  P2PService,
  OrderService,
  TradeService,
  ValidationService
};