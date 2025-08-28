/**
 * Example of settings menu display with language and network selection
 */

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_settings'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 1001 };
  }
};

async function showSettingsMenuExample() {
  console.log('🚀 Displaying settings menu example...');
  
  try {
    // Settings menu message
    const message = '⚙️ Настройки\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖';
    
    // Create inline keyboard with language and network selection buttons
    const { Markup } = require('telegraf');
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🌍 Выберите язык', 'select_language')],
      [Markup.button.callback('🔗 Выберите сеть', 'select_network')],
      [Markup.button.callback('🔙 Назад', 'back_to_menu')]
    ]);
    
    await mockCtx.reply(message, keyboard);
    
    console.log('✅ Settings menu example displayed');
  } catch (error) {
    console.error('❌ Settings menu example failed:', error);
  }
}

// Run the example
showSettingsMenuExample().then(() => {
  console.log('🏁 Settings menu example completed');
}).catch((error) => {
  console.error('💥 Settings menu example failed with error:', error);
});