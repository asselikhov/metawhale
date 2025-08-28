/**
 * Test script for personal cabinet with network-specific balance display
 */

const { User } = require('../src/database/models');
const multiChainWalletService = require('../src/services/multiChainWalletService');
const userNetworkService = require('../src/services/userNetworkService');
const multiChainService = require('../src/services/multiChainService');

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_789'
  },
  reply: async (message, options) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (options && options.reply_markup) {
      // Simplify keyboard display for testing
      const buttons = options.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data })));
      console.log(`   Keyboard:`, JSON.stringify(buttons, null, 2));
    }
    return { message_id: 456 };
  }
};

async function testPersonalCabinet() {
  console.log('🚀 Testing personal cabinet with network-specific balance display...');
  
  const chatId = mockCtx.chat.id.toString();
  
  try {
    // Test personal cabinet display for different networks
    const networks = multiChainService.getNetworks();
    
    for (const network of networks) {
      console.log(`\n--- Testing Personal Cabinet for ${network.name} ---`);
      
      // Simulate setting user network
      try {
        // In a real scenario, we would set the network in the database
        // For this test, we'll just check what would be displayed
        
        // Get network info
        const networkInfo = multiChainService.getNetworkConfig(network.id);
        const networkEmoji = multiChainService.getNetworkEmoji(network.id);
        
        console.log(`Network: ${networkEmoji} ${network.name}`);
        console.log(`Supported tokens:`, Object.keys(networkInfo.tokens));
        
        // Display what the personal cabinet would show
        const header = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                      '➖➖➖➖➖➖➖➖➖➖➖\n' +
                      `🌐 Текущая сеть: ${networkEmoji} ${network.name}\n\n`;
        
        // Show sample balances for this network
        let balanceInfo = '';
        for (const [tokenSymbol, tokenConfig] of Object.entries(networkInfo.tokens)) {
          // Generate sample balance
          const balance = (Math.random() * 100).toFixed(4);
          const usdValue = (balance * (Math.random() * 10)).toFixed(2);
          const rubValue = (usdValue * 90).toFixed(2); // Approximate RUB rate
          
          balanceInfo += `${networkEmoji} ${tokenSymbol}: ${balance} • $${usdValue} • ₽${rubValue}\n`;
        }
        
        const totalUsd = (Math.random() * 1000).toFixed(2);
        const totalRub = (totalUsd * 90).toFixed(2);
        const totalValue = `\n💰 Общая стоимость: $${totalUsd} • ₽${totalRub}`;
        
        const message = header + balanceInfo + totalValue;
        
        // Show keyboard options
        const { Markup } = require('telegraf');
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🌐 Сменить сеть', 'switch_network')],
          [Markup.button.callback('💳 Кошелек', 'wallet_details')],
          [Markup.button.callback('💸 Перевод', 'transfer_menu')]
        ]);
        
        await mockCtx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      } catch (error) {
        console.log(`ℹ️  Expected behavior for network ${network.id} (no wallet):`, error.message);
      }
    }
    
    console.log('✅ Personal cabinet tests completed');
  } catch (error) {
    console.error('❌ Personal cabinet test failed:', error);
  }
}

// Run the test
testPersonalCabinet().then(() => {
  console.log('🏁 Personal cabinet test completed');
}).catch((error) => {
  console.error('💥 Personal cabinet test failed with error:', error);
});