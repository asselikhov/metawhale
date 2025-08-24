/**
 * Simple test script to verify bot functionality
 */

const config = require('./src/config/configuration');
const { Telegraf } = require('telegraf');

// Create a simple test bot instance
const bot = new Telegraf(config.telegram.botToken);

// Test the bot by sending a message to yourself
async function testBot() {
  try {
    console.log('Testing bot functionality...');
    
    // Get bot information
    const botInfo = await bot.telegram.getMe();
    console.log('Bot info:', botInfo);
    
    // Test sending a message to yourself (replace with your actual chat ID)
    // const chatId = '942851377'; // Your chat ID
    // await bot.telegram.sendMessage(chatId, 'Hello! This is a test message from the bot.');
    // console.log('Test message sent successfully!');
    
    console.log('Bot test completed.');
  } catch (error) {
    console.error('Bot test failed:', error);
  }
}

// Run the test
testBot();