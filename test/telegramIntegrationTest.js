/**
 * Test script for Telegram bot integration with network selection
 */

const { User } = require('../src/database/models');
const userNetworkService = require('../src/services/userNetworkService');
const multiChainService = require('../src/services/multiChainService');

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_456'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard, null, 2));
    }
    return { message_id: 123 };
  },
  answerCbQuery: async (text) => {
    console.log(`✅ Callback query answer: ${text || 'OK'}`);
  },
  editMessageText: async (message, options) => {
    console.log('✏️ Edited message:');
    console.log(`   Message: ${message}`);
    if (options && options.reply_markup) {
      console.log(`   Keyboard:`, JSON.stringify(options.reply_markup, null, 2));
    }
  }
};

async function testTelegramIntegration() {
  console.log('🚀 Testing Telegram bot integration with network selection...');
  
  const chatId = mockCtx.chat.id.toString();
  
  try {
    // Test settings menu
    console.log('\n--- Testing Settings Menu ---');
    const languageService = require('../src/services/languageService');
    
    const settingsMessage = '⚙️ Настройки';
    const { Markup } = require('telegraf');
    const settingsKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🌍 Выберите язык', 'select_language')],
      [Markup.button.callback('🌐 Выберите сеть', 'select_network')],
      [Markup.button.callback('🔙 Назад', 'back_to_menu')]
    ]);
    
    await mockCtx.reply(settingsMessage, settingsKeyboard);
    
    // Test network selection
    console.log('\n--- Testing Network Selection ---');
    const currentNetwork = await userNetworkService.getUserNetwork(chatId);
    console.log(`Current network: ${currentNetwork}`);
    
    const networkMessage = '🌐 Выберите блокчейн сеть:';
    
    // Get network selector buttons
    const networkButtons = multiChainService.getNetworkSelectorButtons(currentNetwork);
    networkButtons.push([Markup.button.callback('🔙 Назад', 'settings_menu')]);
    
    const networkKeyboard = Markup.inlineKeyboard(networkButtons);
    await mockCtx.reply(networkMessage, networkKeyboard);
    
    // Test network selection confirmation
    console.log('\n--- Testing Network Selection Confirmation ---');
    const testNetworkId = 'bsc'; // Test with BSC network
    const networkConfig = multiChainService.getNetworkConfig(testNetworkId);
    const networkEmoji = multiChainService.getNetworkEmoji(testNetworkId);
    
    const confirmationMessage = `✅ Сеть установлена: ${networkEmoji} ${networkConfig.name}`;
    const confirmationKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ]);
    
    await mockCtx.reply(confirmationMessage, confirmationKeyboard);
    
    console.log('✅ Telegram integration tests completed');
  } catch (error) {
    console.error('❌ Telegram integration test failed:', error);
  }
}

// Run the test
testTelegramIntegration().then(() => {
  console.log('🏁 Telegram integration test completed');
}).catch((error) => {
  console.error('💥 Telegram integration test failed with error:', error);
});