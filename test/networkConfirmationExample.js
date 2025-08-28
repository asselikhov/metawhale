/**
 * Example of network selection confirmation display
 */

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_network_confirm'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 1005 };
  }
};

async function showNetworkConfirmationExample() {
  console.log('🚀 Displaying network confirmation example...');
  
  try {
    // Network confirmation message
    const message = '✅ Сеть установлена: 🟣 Polygon';
    
    // Create back button
    const { Markup } = require('telegraf');
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ]);
    
    await mockCtx.reply(message, keyboard);
    
    console.log('✅ Network confirmation example displayed');
  } catch (error) {
    console.error('❌ Network confirmation example failed:', error);
  }
}

// Run the example
showNetworkConfirmationExample().then(() => {
  console.log('🏁 Network confirmation example completed');
}).catch((error) => {
  console.error('💥 Network confirmation example failed with error:', error);
});