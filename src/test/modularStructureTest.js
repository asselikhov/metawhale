/**
 * Test for the new modular structure
 */

const { Application } = require('../modules/core');
const { TelegramBot } = require('../modules/bot');

console.log('🧪 Testing modular structure...');

// Test core module
try {
  const app = new Application();
  console.log('✅ Core module loaded successfully');
} catch (error) {
  console.error('❌ Error loading core module:', error.message);
}

// Test bot module
try {
  // Mock config for testing
  const mockConfig = {
    telegram: {
      botToken: 'mock-token',
      webhookUrl: 'https://example.com',
      webhookPath: '/webhook'
    }
  };
  
  const bot = new TelegramBot(mockConfig);
  console.log('✅ Bot module loaded successfully');
} catch (error) {
  console.error('❌ Error loading bot module:', error.message);
}

// Test module exports
try {
  const modules = require('../modules');
  console.log('✅ Module exports loaded successfully');
  
  // Check if all expected modules are present
  const expectedModules = ['core', 'bot', 'user', 'wallet', 'p2p', 'transfer', 'settings', 'analytics', 'notification', 'escrow', 'utils'];
  const missingModules = expectedModules.filter(module => !modules[module]);
  
  if (missingModules.length === 0) {
    console.log('✅ All expected modules are present');
  } else {
    console.log('⚠️ Missing modules:', missingModules);
  }
} catch (error) {
  console.error('❌ Error loading module exports:', error.message);
}

console.log('\n🎉 Modular structure test completed!');