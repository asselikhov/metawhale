// Module exports for the new modular structure
module.exports = {
  // Core modules
  core: require('./core'),
  
  // Bot modules
  bot: require('./bot'),
  
  // User management modules
  user: require('./user'),
  
  // Wallet modules
  wallet: require('./wallet'),
  
  // P2P trading modules
  p2p: require('./p2p'),
  
  // Transfer modules
  transfer: require('./transfer'),
  
  // Settings modules
  settings: require('./settings'),
  
  // Analytics modules
  analytics: require('./analytics'),
  
  // Notification modules
  notification: require('./notification'),
  
  // Escrow modules
  escrow: require('./escrow'),
  
  // Utility modules
  utils: require('./utils')
};