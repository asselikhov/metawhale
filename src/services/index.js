/**
 * Services Index
 * Export all services
 */

// Core services
const walletService = require('./wallet');
const p2pService = require('./p2p');
const escrowService = require('./escrow');

// Utility services
const { priceService, languageService, performanceMonitorService } = require('./utility');

// Notification services
const { smartNotificationService } = require('./notification');

// Analytics services
const { analyticsService } = require('./analytics');

// Export services with proper structure
module.exports = {
  // Core services
  walletService,
  p2pService,
  escrowService,
  
  // Utility services
  priceService,
  languageService,
  performanceMonitorService,
  
  // Notification services
  smartNotificationService,
  
  // Analytics services
  analyticsService
};