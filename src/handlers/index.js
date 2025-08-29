/**
 * Handlers Index
 * Export all handlers
 */

// Core handlers
const MessageHandler = require('./messageHandler');

// Individual handlers
const P2POrdersHandler = require('./P2POrdersHandler');
const SessionManager = require('./SessionManager');

// Handler modules
const { CoreCommandHandler } = require('./core');
const { UserHandler } = require('./user');
const { TradingHandler, TransferHandler } = require('./trading');
const { P2PTradeHandler, P2PDataHandler } = require('./p2p');
const { DisputeHandler } = require('./dispute');
const AdminDisputeHandler = require('./dispute/admin');

module.exports = {
  // Main handlers
  MessageHandler,
  P2POrdersHandler,
  SessionManager,
  
  // Handler modules
  CoreCommandHandler,
  UserHandler,
  TradingHandler,
  TransferHandler,
  P2PTradeHandler,
  P2PDataHandler,
  DisputeHandler,
  AdminDisputeHandler
};