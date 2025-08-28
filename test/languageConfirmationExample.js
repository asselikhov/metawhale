/**
 * Example of language selection confirmation display
 */

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_language_confirm'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 1004 };
  }
};

async function showLanguageConfirmationExample() {
  console.log('🚀 Displaying language confirmation example...');
  
  try {
    // Language confirmation message
    const message = '✅ Язык интерфейса установлен: 🇷🇺 Россия';
    
    // Create back button
    const { Markup } = require('telegraf');
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ]);
    
    await mockCtx.reply(message, keyboard);
    
    console.log('✅ Language confirmation example displayed');
  } catch (error) {
    console.error('❌ Language confirmation example failed:', error);
  }
}

// Run the example
showLanguageConfirmationExample().then(() => {
  console.log('🏁 Language confirmation example completed');
}).catch((error) => {
  console.error('💥 Language confirmation example failed with error:', error);
});