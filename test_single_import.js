console.log('Testing single import...');

// Test the specific import that's failing
try {
  console.log('Testing import: ../services/wallet/walletService from transfer/TransferHandler.js');
  const walletService = require('./src/services/wallet/walletService.js');
  console.log('✅ WalletService imported successfully');
} catch (error) {
  console.error('❌ WalletService import failed:', error.message);
  console.error('Require stack:', error.requireStack);
}

// Test the specific import that's failing
try {
  console.log('Testing import: ../SessionManager from transfer/TransferHandler.js');
  const sessionManager = require('./src/handlers/SessionManager.js');
  console.log('✅ SessionManager imported successfully');
} catch (error) {
  console.error('❌ SessionManager import failed:', error.message);
  console.error('Require stack:', error.requireStack);
}