// Тестовый файл для проверки интеграции CoinMarketCap API
require('dotenv').config();
const axios = require('axios');

async function testCMCIntegration() {
  console.log('🧪 Тестирование интеграции CoinMarketCap API...\n');
  
  if (!process.env.CMC_API_KEY) {
    console.log('❌ CMC_API_KEY не найден в переменных окружения');
    console.log('📋 Добавьте в .env файл: CMC_API_KEY=your_api_key_here');
    console.log('🔗 Получить API ключ: https://coinmarketcap.com/api/');
    return;
  }
  
  console.log('✅ CMC API ключ найден');
  console.log('🔍 Поиск токена CES в CoinMarketCap...\n');
  
  try {
    // Тест поиска по символу CES
    const response = await axios.get(
      'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
          'Accept': 'application/json'
        },
        params: {
          symbol: 'CES',
          convert: 'USD,RUB'
        },
        timeout: 10000
      }
    );
    
    console.log('📊 Ответ CoinMarketCap API:');
    console.log('Status:', response.status);
    console.log('Credits used:', response.headers['x-cmcpro-api-plan-credit-limit-daily-used'] || 'N/A');
    console.log('Credits remaining:', response.headers['x-cmcpro-api-plan-credit-limit-daily-remaining'] || 'N/A');
    
    if (response.data && response.data.data && response.data.data.CES) {
      const cesTokens = response.data.data.CES;
      console.log(`\n🎯 Найдено ${cesTokens.length} токен(ов) с символом CES:`);
      
      cesTokens.forEach((token, index) => {
        console.log(`\n--- Токен ${index + 1} ---`);
        console.log(`ID: ${token.id}`);
        console.log(`Название: ${token.name}`);
        console.log(`Символ: ${token.symbol}`);
        console.log(`Платформа: ${token.platform?.name || 'Неизвестно'}`);
        console.log(`Адрес контракта: ${token.platform?.token_address || 'N/A'}`);
        
        if (token.quote && token.quote.USD) {
          const quote = token.quote.USD;
          console.log(`\n💰 Цена: $${quote.price?.toFixed(4) || 'N/A'}`);
          console.log(`📈 Изменение 24ч: ${quote.percent_change_24h?.toFixed(2) || 'N/A'}%`);
          console.log(`💎 Рыночная кап: $${quote.market_cap ? (quote.market_cap / 1e6).toFixed(2) + 'M' : 'N/A'}`);
          console.log(`📊 Объем 24ч: $${quote.volume_24h ? (quote.volume_24h / 1e6).toFixed(2) + 'M' : 'N/A'}`);
          console.log(`🏆 ATH: $${quote.ath || 'Недоступно'}`);
          
          // Проверяем наш токен CES на Polygon
          if (token.platform?.token_address?.toLowerCase() === '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610') {
            console.log(`\n🎯 ЭТО НАШ ТОКЕН CES на Polygon!`);
            console.log(`✅ Точное совпадение контракта найдено`);
          }
        }
        
        if (token.quote && token.quote.RUB) {
          console.log(`💰 Цена в рублях: ₽${token.quote.RUB.price?.toFixed(2) || 'N/A'}`);
        }
      });
      
      console.log('\n🎉 Тест CoinMarketCap API успешно завершен!');
      console.log('💡 CoinMarketCap предоставляет более надежные данные ATH');
    } else {
      console.log('⚠️ Токен CES не найден в CoinMarketCap');
      console.log('Возможные причины:');
      console.log('• Токен не листится на CoinMarketCap');
      console.log('• Используется другой символ');
      console.log('• Токен еще не добавлен в базу данных CMC');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при обращении к CoinMarketCap API:');
    console.error('Сообщение:', error.message);
    
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n🔑 Проблема с авторизацией:');
        console.log('• Проверьте правильность API ключа');
        console.log('• Убедитесь, что ключ активен');
      } else if (error.response.status === 429) {
        console.log('\n⏱️ Превышен лимит запросов:');
        console.log('• Используется бесплатный план с ограничениями');
        console.log('• Попробуйте позже');
      }
    }
  }
}

// Дополнительный тест поиска по ID
async function testCMCByID() {
  if (!process.env.CMC_API_KEY) return;
  
  console.log('\n🔍 Дополнительный поиск по возможным ID токена CES...\n');
  
  const possibleIds = [1027, 2700, 8916, 7129]; // Некоторые возможные ID для CES токенов
  
  for (const id of possibleIds) {
    try {
      const response = await axios.get(
        'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
        {
          headers: {
            'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
            'Accept': 'application/json'
          },
          params: {
            id: id,
            convert: 'USD'
          },
          timeout: 5000
        }
      );
      
      if (response.data && response.data.data && response.data.data[id]) {
        const token = response.data.data[id];
        if (token.symbol === 'CES') {
          console.log(`✅ Найден CES токен по ID ${id}: ${token.name}`);
        }
      }
    } catch (err) {
      // Игнорируем ошибки для дополнительного поиска
    }
  }
}

// Запуск тестов
console.log('🚀 Запуск тестов CoinMarketCap API...\n');
testCMCIntegration().then(() => {
  return testCMCByID();
}).then(() => {
  console.log('\n✨ Все тесты завершены!');
}).catch(console.error);