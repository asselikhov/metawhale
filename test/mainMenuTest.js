/**
 * Test for main menu display
 * Verifies that the main menu buttons are displayed correctly
 */

const { Markup } = require('telegraf');
const LocalizationHelper = require('../src/utils/localizationHelper');
const languageService = require('../src/services/utility/languageService');

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_menu'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard && keyboard.reply_markup && keyboard.reply_markup.keyboard) {
      console.log('   Main Menu Buttons:');
      keyboard.reply_markup.keyboard.forEach((row, index) => {
        console.log(`     Row ${index + 1}:`, row.map(btn => `"${btn}"`).join(', '));
      });
    } else if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard, null, 2));
    }
    return { message_id: 1001 };
  }
};

async function testMainMenuDisplay() {
  console.log('🚀 Testing main menu display...');
  
  try {
    const chatId = mockCtx.chat.id.toString();
    
    // Test Russian language
    console.log('\n--- Russian Language ---');
    await languageService.setUserLanguage(chatId, 'ru');
    
    const russianMainMenu = Markup.keyboard(
      await LocalizationHelper.getLocalizedMainMenu(chatId)
    ).resize();
    
    await mockCtx.reply('🌾 Главное меню', russianMainMenu);
    
    // Test English language
    console.log('\n--- English Language ---');
    await languageService.setUserLanguage(chatId, 'en');
    
    const englishMainMenu = Markup.keyboard(
      await LocalizationHelper.getLocalizedMainMenu(chatId)
    ).resize();
    
    await mockCtx.reply('🌾 Main Menu', englishMainMenu);
    
    // Test Chinese language
    console.log('\n--- Chinese Language ---');
    await languageService.setUserLanguage(chatId, 'zh');
    
    const chineseMainMenu = Markup.keyboard(
      await LocalizationHelper.getLocalizedMainMenu(chatId)
    ).resize();
    
    await mockCtx.reply('🌾 主菜单', chineseMainMenu);
    
    console.log('\n✅ Main menu test completed successfully');
  } catch (error) {
    console.error('❌ Main menu test failed:', error);
  }
}

// Run the test
testMainMenuDisplay().then(() => {
  console.log('🏁 Main menu test finished');
}).catch((error) => {
  console.error('💥 Main menu test failed with error:', error);
});