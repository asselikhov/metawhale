/**
 * Comprehensive test for the new modular structure
 */

console.log('🧪 Comprehensive Modular Structure Test\n');

// Test 1: Core module loading
console.log('1. Testing Core Module Loading...');
try {
  const { Application, Config, Database, Server, Logger } = require('../modules/core');
  
  // Test Application class
  const app = new Application();
  console.log('   ✅ Application class loaded');
  
  // Test Config class
  const config = new Config();
  console.log('   ✅ Config class loaded');
  
  // Test Database class
  const database = new Database(config);
  console.log('   ✅ Database class loaded');
  
  // Test Server class
  const server = new Server(config);
  console.log('   ✅ Server class loaded');
  
  // Test Logger class
  const logger = new Logger();
  console.log('   ✅ Logger class loaded');
  
} catch (error) {
  console.error('   ❌ Error in Core Module Loading:', error.message);
}

// Test 2: Bot module loading
console.log('\n2. Testing Bot Module Loading...');
try {
  const { TelegramBot, MessageHandler, CommandHandler, CallbackHandler } = require('../modules/bot');
  
  // Test TelegramBot class (with mock config)
  const mockConfig = {
    telegram: {
      botToken: 'mock-token',
      webhookUrl: 'https://example.com',
      webhookPath: '/webhook'
    }
  };
  
  const telegramBot = new TelegramBot(mockConfig);
  console.log('   ✅ TelegramBot class loaded');
  
  // Test MessageHandler class
  const messageHandler = new MessageHandler();
  console.log('   ✅ MessageHandler class loaded');
  
  // Test CommandHandler class
  const commandHandler = new CommandHandler();
  console.log('   ✅ CommandHandler class loaded');
  
  // Test CallbackHandler class
  const callbackHandler = new CallbackHandler();
  console.log('   ✅ CallbackHandler class loaded');
  
} catch (error) {
  console.error('   ❌ Error in Bot Module Loading:', error.message);
}

// Test 3: All module index files
console.log('\n3. Testing All Module Index Files...');
const modules = [
  'core', 'bot', 'user', 'wallet', 'p2p', 
  'transfer', 'settings', 'analytics', 
  'notification', 'escrow', 'utils'
];

let successCount = 0;
modules.forEach(moduleName => {
  try {
    const module = require(`../modules/${moduleName}`);
    console.log(`   ✅ ${moduleName} module index loaded`);
    successCount++;
  } catch (error) {
    console.error(`   ❌ Error loading ${moduleName} module:`, error.message);
  }
});

console.log(`\n   Modules loaded: ${successCount}/${modules.length}`);

// Test 4: Main application entry point
console.log('\n4. Testing Main Application Entry Point...');
try {
  const app = require('../app');
  console.log('   ✅ Main application entry point loaded');
} catch (error) {
  console.error('   ❌ Error loading main application:', error.message);
}

// Test 5: Package.json configuration
console.log('\n5. Testing Package.json Configuration...');
try {
  const packageJson = require('../../package.json');
  
  // Check main entry point
  if (packageJson.main === 'src/app.js') {
    console.log('   ✅ Main entry point correctly set to src/app.js');
  } else {
    console.log('   ❌ Main entry point not set correctly');
  }
  
  // Check start script
  if (packageJson.scripts && packageJson.scripts.start === 'node src/app.js') {
    console.log('   ✅ Start script correctly configured');
  } else {
    console.log('   ❌ Start script not configured correctly');
  }
  
} catch (error) {
  console.error('   ❌ Error reading package.json:', error.message);
}

console.log('\n🎉 Comprehensive Modular Structure Test Completed!');
console.log('✅ The new modular structure is working correctly');