/**
 * Test script for currency selection functionality
 */

const fiatCurrencyService = require('../src/services/fiatCurrencyService');

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_currency'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 2001 };
  }
};

async function testCurrencySelection() {
  console.log('🚀 Testing currency selection functionality...');
  
  try {
    // Test currency selection menu
    console.log('\n--- Testing Currency Selection Menu ---');
    
    const chatId = mockCtx.chat.id.toString();
    const currentCurrency = 'RUB'; // Mock current currency
    
    const message = '💰 Выберите фиатную валюту:';
    
    // Get supported currencies
    const supportedCurrencies = [
      { code: 'RUB', name: 'Российский рубль', flag: '🇷🇺' },
      { code: 'USD', name: 'Доллар США', flag: '🇺🇸' },
      { code: 'EUR', name: 'Евро', flag: '🇪🇺' },
      { code: 'CNY', name: 'Китайский юань', flag: '🇨🇳' },
      { code: 'INR', name: 'Индийская рупия', flag: '🇮🇳' },
      { code: 'NGN', name: 'Нигерийская найра', flag: '🇳🇬' },
      { code: 'VND', name: 'Вьетнамский донг', flag: '🇻🇳' },
      { code: 'KRW', name: 'Южнокорейская вона', flag: '🇰🇷' },
      { code: 'JPY', name: 'Японская иена', flag: '🇯🇵' },
      { code: 'BRL', name: 'Бразильский реал', flag: '🇧🇷' }
    ];
    
    // Create currency buttons (2 per row)
    const { Markup } = require('telegraf');
    const currencyButtons = [];
    for (let i = 0; i < supportedCurrencies.length; i += 2) {
      const row = [];
      
      // First currency in row
      const currency1 = supportedCurrencies[i];
      const isSelected1 = currency1.code === currentCurrency;
      const buttonText1 = isSelected1 
        ? `${currency1.flag} ${currency1.name} (${currency1.code}) ✅` 
        : `${currency1.flag} ${currency1.name} (${currency1.code})`;
      row.push(Markup.button.callback(buttonText1, `select_currency_${currency1.code}`));
      
      // Second currency in row (if exists)
      if (i + 1 < supportedCurrencies.length) {
        const currency2 = supportedCurrencies[i + 1];
        const isSelected2 = currency2.code === currentCurrency;
        const buttonText2 = isSelected2 
          ? `${currency2.flag} ${currency2.name} (${currency2.code}) ✅` 
          : `${currency2.flag} ${currency2.name} (${currency2.code})`;
        row.push(Markup.button.callback(buttonText2, `select_currency_${currency2.code}`));
      }
      
      currencyButtons.push(row);
    }
    
    // Add back button
    currencyButtons.push([Markup.button.callback('🔙 Назад', 'settings_menu')]);
    
    const keyboard = Markup.inlineKeyboard(currencyButtons);
    
    await mockCtx.reply(message, keyboard);
    
    // Test currency confirmation
    console.log('\n--- Testing Currency Confirmation ---');
    
    const selectedCurrency = supportedCurrencies.find(c => c.code === 'USD');
    const confirmationMessage = `✅ Валюта установлена: ${selectedCurrency.flag} ${selectedCurrency.name} (${selectedCurrency.code})`;
    
    const confirmationKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ]);
    
    await mockCtx.reply(confirmationMessage, confirmationKeyboard);
    
    console.log('✅ Currency selection tests completed');
  } catch (error) {
    console.error('❌ Currency selection test failed:', error);
  }
}

// Run the test
testCurrencySelection().then(() => {
  console.log('🏁 Currency selection test completed');
}).catch((error) => {
  console.error('💥 Currency selection test failed with error:', error);
});