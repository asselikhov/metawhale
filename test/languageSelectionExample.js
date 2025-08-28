/**
 * Example of language selection menu display
 */

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_language'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 1002 };
  }
};

async function showLanguageSelectionExample() {
  console.log('🚀 Displaying language selection menu example...');
  
  try {
    // Language selection message
    const message = '🌍 Выберите язык интерфейса:';
    
    // Create language buttons (2 per row)
    const { Markup } = require('telegraf');
    const languageButtons = [
      [
        Markup.button.callback('🇺🇸 США', 'select_language_en'),
        Markup.button.callback('🇷🇺 Россия', 'select_language_ru')
      ],
      [
        Markup.button.callback('🇨🇳 Китай', 'select_language_zh'),
        Markup.button.callback('🇮🇳 Индия', 'select_language_hi')
      ],
      [
        Markup.button.callback('🇳🇬 Нигерия', 'select_language_yo'),
        Markup.button.callback('🇻🇳 Вьетнам', 'select_language_vi')
      ],
      [
        Markup.button.callback('🇰🇷 Южная Корея', 'select_language_ko'),
        Markup.button.callback('🇯🇵 Япония', 'select_language_ja')
      ],
      [
        Markup.button.callback('🇧🇷 Бразилия', 'select_language_pt'),
        Markup.button.callback('🇮🇱 Израиль', 'select_language_he')
      ],
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ];
    
    const keyboard = Markup.inlineKeyboard(languageButtons);
    
    await mockCtx.reply(message, keyboard);
    
    console.log('✅ Language selection menu example displayed');
  } catch (error) {
    console.error('❌ Language selection menu example failed:', error);
  }
}

// Run the example
showLanguageSelectionExample().then(() => {
  console.log('🏁 Language selection menu example completed');
}).catch((error) => {
  console.error('💥 Language selection menu example failed with error:', error);
});