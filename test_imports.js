console.log('Testing imports...');

// Test the specific import that's failing
try {
  console.log('Testing import: ./base/BaseCommandHandler from handlers/messageHandler.js');
  const BaseCommandHandler = require('./src/handlers/base/BaseCommandHandler');
  console.log('✅ BaseCommandHandler imported successfully');
} catch (error) {
  console.error('❌ BaseCommandHandler import failed:', error.message);
  console.error('Require stack:', error.requireStack);
}

// Test the specific import that's failing
try {
  console.log('Testing import: ./handlers/messageHandler.js from app.js context');
  const messageHandler = require('./src/handlers/messageHandler');
  console.log('✅ MessageHandler imported successfully');
} catch (error) {
  console.error('❌ MessageHandler import failed:', error.message);
  console.error('Require stack:', error.requireStack);
}