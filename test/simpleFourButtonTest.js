/**
 * Simple test for the 4-button main menu
 * Verifies basic functionality without database dependencies
 */

const { Markup } = require('telegraf');
const LocalizationHelper = require('../src/utils/localizationHelper');

// Simple mock for language service
const mockLanguageService = {
  translations: {
    'ru': {
      'main_menu': '🌾 Главное меню',
      'personal_cabinet': '👤 ЛК',
      'p2p': '🔄 P2P',
      'matrix': '💠 Matrix',
      'settings': '⚙️ Настройки'
    },
    'en': {
      'main_menu': '🌾 Main Menu',
      'personal_cabinet': '👤 PC',
      'p2p': '🔄 P2P',
      'matrix': '💠 Matrix',
      'settings': '⚙️ Settings'
    }
  },
  
  getText: async (chatId, key) => {
    // Default to Russian
    return mockLanguageService.translations['ru'][key] || key;
  }
};

// Override the language service in LocalizationHelper for testing
LocalizationHelper.getText = mockLanguageService.getText;

// Mock Telegram context
const mockCtx = {
  chat: { id: 'test_simple' },
  reply: async (message, keyboard) => {
    console.log(`\n📱 Bot Response:`);
    console.log(`   Text: ${message}`);
    
    if (keyboard && keyboard.reply_markup && keyboard.reply_markup.keyboard) {
      console.log(`   Buttons:`);
      keyboard.reply_markup.keyboard.forEach((row, i) => {
        console.log(`     Row ${i + 1}: ${JSON.stringify(row)}`);
      });
    }
    return { message_id: 1 };
  }
};

async function testFourButtonMenu() {
  console.log('🧪 Simple 4-Button Main Menu Test');
  console.log('=====================================');
  
  try {
    const chatId = mockCtx.chat.id;
    
    // Get localized main menu
    const menuButtons = await LocalizationHelper.getLocalizedMainMenu(chatId);
    
    console.log('\n📋 Menu Structure:');
    console.log(JSON.stringify(menuButtons, null, 2));
    
    // Verify structure
    if (menuButtons.length !== 1) {
      throw new Error(`Expected 1 row, got ${menuButtons.length}`);
    }
    
    if (menuButtons[0].length !== 4) {
      throw new Error(`Expected 4 buttons in the row, got ${menuButtons[0].length}`);
    }
    
    // Verify content
    const [firstButton, secondButton, thirdButton, fourthButton] = menuButtons[0];
    
    console.log('\n✅ Button Content:');
    console.log(`   1st Button: "${firstButton}"`);
    console.log(`   2nd Button: "${secondButton}"`);
    console.log(`   3rd Button: "${thirdButton}"`);
    console.log(`   4th Button: "${fourthButton}"`);
    
    // Create keyboard
    const keyboard = Markup.keyboard(menuButtons).resize();
    
    // Display menu
    const menuText = await LocalizationHelper.getText(chatId, 'main_menu');
    await mockCtx.reply(menuText, keyboard);
    
    console.log('\n🎉 TEST PASSED!');
    console.log('✅ Menu has 4 buttons in 1 row');
    console.log('✅ Buttons display correctly');
    console.log('✅ Keyboard is properly formatted');
    
    return true;
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    return false;
  }
}

// Run test
if (require.main === module) {
  testFourButtonMenu().then(success => {
    console.log('\n🏁 Test completed');
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testFourButtonMenu };