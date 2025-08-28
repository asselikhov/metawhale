/**
 * Example of network selection menu display
 */

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_network'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 1003 };
  }
};

async function showNetworkSelectionExample() {
  console.log('🚀 Displaying network selection menu example...');
  
  try {
    // Network selection message
    const message = '🔗 Выберите блокчейн сеть:';
    
    // Create network buttons
    const { Markup } = require('telegraf');
    const networkButtons = [
      [
        Markup.button.callback('🟣 Polygon ✅', 'select_network_polygon'),
        Markup.button.callback('🔴 TRON', 'select_network_tron')
      ],
      [
        Markup.button.callback('🟡 BNB Smart Chain', 'select_network_bsc'),
        Markup.button.callback('🟢 Solana', 'select_network_solana')
      ],
      [
        Markup.button.callback('🔵 Arbitrum One', 'select_network_arbitrum'),
        Markup.button.callback('🔶 Avalanche', 'select_network_avalanche')
      ],
      [
        Markup.button.callback('💎 TON Network', 'select_network_ton')
      ],
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ];
    
    const keyboard = Markup.inlineKeyboard(networkButtons);
    
    await mockCtx.reply(message, keyboard);
    
    console.log('✅ Network selection menu example displayed');
  } catch (error) {
    console.error('❌ Network selection menu example failed:', error);
  }
}

// Run the example
showNetworkSelectionExample().then(() => {
  console.log('🏁 Network selection menu example completed');
}).catch((error) => {
  console.error('💥 Network selection menu example failed with error:', error);
});