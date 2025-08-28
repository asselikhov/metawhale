/**
 * Example of full settings flow: settings menu -> language selection -> network selection
 */

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_full_flow'
  },
  reply: async (message, keyboard) => {
    console.log('\n🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 1006 };
  }
};

async function showFullSettingsFlowExample() {
  console.log('🚀 Displaying full settings flow example...');
  
  try {
    // Step 1: Settings menu
    console.log('\n--- Step 1: Settings Menu ---');
    const settingsMessage = '⚙️ Настройки\n' +
                          '➖➖➖➖➖➖➖➖➖➖➖';
    
    const { Markup } = require('telegraf');
    const settingsKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🌍 Выберите язык', 'select_language')],
      [Markup.button.callback('🔗 Выберите сеть', 'select_network')],
      [Markup.button.callback('🔙 Назад', 'back_to_menu')]
    ]);
    
    await mockCtx.reply(settingsMessage, settingsKeyboard);
    
    // Step 2: Language selection
    console.log('\n--- Step 2: Language Selection ---');
    const languageMessage = '🌍 Выберите язык интерфейса:';
    
    const languageButtons = [
      [
        Markup.button.callback('🇺🇸 США', 'select_language_en'),
        Markup.button.callback('🇷🇺 Россия ✅', 'select_language_ru')
      ],
      [
        Markup.button.callback('🇨🇳 Китай', 'select_language_zh'),
        Markup.button.callback('🇮🇳 Индия', 'select_language_hi')
      ],
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ];
    
    const languageKeyboard = Markup.inlineKeyboard(languageButtons);
    await mockCtx.reply(languageMessage, languageKeyboard);
    
    // Step 3: Language confirmation
    console.log('\n--- Step 3: Language Confirmation ---');
    const languageConfirmMessage = '✅ Язык интерфейса установлен: 🇷🇺 Россия';
    
    const languageConfirmKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ]);
    
    await mockCtx.reply(languageConfirmMessage, languageConfirmKeyboard);
    
    // Step 4: Network selection
    console.log('\n--- Step 4: Network Selection ---');
    const networkMessage = '🔗 Выберите блокчейн сеть:';
    
    const networkButtons = [
      [
        Markup.button.callback('🟣 Polygon', 'select_network_polygon'),
        Markup.button.callback('🔴 TRON', 'select_network_tron')
      ],
      [
        Markup.button.callback('🟡 BNB Smart Chain ✅', 'select_network_bsc'),
        Markup.button.callback('🟢 Solana', 'select_network_solana')
      ],
      [
        Markup.button.callback('🔵 Arbitrum One', 'select_network_arbitrum'),
        Markup.button.callback('🔶 Avalanche', 'select_network_avalanche')
      ],
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ];
    
    const networkKeyboard = Markup.inlineKeyboard(networkButtons);
    await mockCtx.reply(networkMessage, networkKeyboard);
    
    // Step 5: Network confirmation
    console.log('\n--- Step 5: Network Confirmation ---');
    const networkConfirmMessage = '✅ Сеть установлена: 🟡 BNB Smart Chain';
    
    const networkConfirmKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ]);
    
    await mockCtx.reply(networkConfirmMessage, networkConfirmKeyboard);
    
    console.log('\n✅ Full settings flow example completed');
  } catch (error) {
    console.error('❌ Full settings flow example failed:', error);
  }
}

// Run the example
showFullSettingsFlowExample().then(() => {
  console.log('\n🏁 Full settings flow example finished');
}).catch((error) => {
  console.error('💥 Full settings flow example failed with error:', error);
});