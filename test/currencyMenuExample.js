/**
 * Example of currency selection menu display
 */

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_currency_menu'
  },
  reply: async (message, keyboard) => {
    console.log('🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard.reply_markup.inline_keyboard.map(row => 
        row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))), null, 2));
    }
    return { message_id: 2002 };
  }
};

async function showCurrencyMenuExample() {
  console.log('🚀 Displaying currency selection menu example...');
  
  try {
    // Settings menu with currency option
    console.log('\n--- Settings Menu with Currency Option ---');
    const settingsMessage = '⚙️ Настройки\n' +
                          '➖➖➖➖➖➖➖➖➖➖➖';
    
    const { Markup } = require('telegraf');
    const settingsKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🌍 Выберите язык', 'select_language')],
      [Markup.button.callback('🔗 Выберите сеть', 'select_network')],
      [Markup.button.callback('💰 Выберите валюту', 'select_currency')],
      [Markup.button.callback('🔙 Назад', 'back_to_menu')]
    ]);
    
    await mockCtx.reply(settingsMessage, settingsKeyboard);
    
    // Currency selection menu
    console.log('\n--- Currency Selection Menu ---');
    const currencyMessage = '💰 Выберите фиатную валюту:';
    
    // Supported currencies
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
    const currencyButtons = [];
    for (let i = 0; i < supportedCurrencies.length; i += 2) {
      const row = [];
      
      // First currency in row
      const currency1 = supportedCurrencies[i];
      const isSelected1 = currency1.code === 'RUB'; // RUB is selected
      const buttonText1 = isSelected1 
        ? `${currency1.flag} ${currency1.name} (${currency1.code}) ✅` 
        : `${currency1.flag} ${currency1.name} (${currency1.code})`;
      row.push(Markup.button.callback(buttonText1, `select_currency_${currency1.code}`));
      
      // Second currency in row (if exists)
      if (i + 1 < supportedCurrencies.length) {
        const currency2 = supportedCurrencies[i + 1];
        const isSelected2 = currency2.code === 'RUB';
        const buttonText2 = isSelected2 
          ? `${currency2.flag} ${currency2.name} (${currency2.code}) ✅` 
          : `${currency2.flag} ${currency2.name} (${currency2.code})`;
        row.push(Markup.button.callback(buttonText2, `select_currency_${currency2.code}`));
      }
      
      currencyButtons.push(row);
    }
    
    // Add back button
    currencyButtons.push([Markup.button.callback('🔙 Назад', 'settings_menu')]);
    
    const currencyKeyboard = Markup.inlineKeyboard(currencyButtons);
    
    await mockCtx.reply(currencyMessage, currencyKeyboard);
    
    // Currency confirmation
    console.log('\n--- Currency Confirmation ---');
    const selectedCurrency = supportedCurrencies.find(c => c.code === 'USD');
    const confirmationMessage = `✅ Валюта установлена: ${selectedCurrency.flag} ${selectedCurrency.name} (${selectedCurrency.code})`;
    
    const confirmationKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад', 'settings_menu')]
    ]);
    
    await mockCtx.reply(confirmationMessage, confirmationKeyboard);
    
    console.log('✅ Currency menu example completed');
  } catch (error) {
    console.error('❌ Currency menu example failed:', error);
  }
}

// Run the example
showCurrencyMenuExample().then(() => {
  console.log('🏁 Currency menu example finished');
}).catch((error) => {
  console.error('💥 Currency menu example failed with error:', error);
});