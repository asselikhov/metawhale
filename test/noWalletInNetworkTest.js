/**
 * Test script for handling case when user has no wallet in selected network
 */

const { User } = require('../src/database/models');
const multiChainService = require('../src/services/multiChainService');

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_999'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 789 };
  }
};

async function testNoWalletInNetwork() {
  console.log('🚀 Testing "no wallet in network" scenario...');
  
  try {
    // Test personal cabinet display when user has no wallet
    console.log('\n--- Testing Personal Cabinet (No Wallet) ---');
    
    const header = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                  '➖➖➖➖➖➖➖➖➖➖➖\n';
    
    const message = header + 
                   '⚠️ Кошелек не создан\n\n' +
                   '💡 Создайте кошелек для хранения токенов в разных сетях\n' +
                   `🌐 Поддерживаемые сети: ${multiChainService.getNetworks().map(n => `${multiChainService.getNetworkEmoji(n.id)} ${n.name}`).join(', ')}`;
    
    const { Markup } = require('telegraf');
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Создать кошелек', 'create_wallet')],
      [Markup.button.callback('🔙 Назад', 'personal_cabinet')]
    ]);
    
    await mockCtx.reply(message, keyboard);
    
    // Test network switching when user has no wallet
    console.log('\n--- Testing Network Switch (No Wallet) ---');
    
    const networks = multiChainService.getNetworks();
    for (const network of networks) {
      const networkEmoji = multiChainService.getNetworkEmoji(network.id);
      const networkName = network.name;
      
      const switchMessage = `🌐 СЕТЬ ПЕРЕКЛЮЧЕНА\n` +
                           `➖➖➖➖➖➖➖➖➖➖➖\n` +
                           `${networkEmoji} Активная сеть: ${networkName}\n\n` +
                           `⚠️ У вас нет кошелька для этой сети\n\n` +
                           `💡 Создайте кошелек для работы с токенами в сети ${networkName}:\n` +
                           `• Хранение токенов\n` +
                           `• P2P торговля\n` +
                           `• Переводы`;
      
      const switchKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Создать кошелек', 'create_wallet')],
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
      ]);
      
      console.log(`\nNetwork: ${networkEmoji} ${networkName}`);
      await mockCtx.reply(switchMessage, switchKeyboard);
    }
    
    console.log('✅ "No wallet in network" tests completed');
  } catch (error) {
    console.error('❌ "No wallet in network" test failed:', error);
  }
}

// Run the test
testNoWalletInNetwork().then(() => {
  console.log('🏁 "No wallet in network" test completed');
}).catch((error) => {
  console.error('💥 "No wallet in network" test failed with error:', error);
});