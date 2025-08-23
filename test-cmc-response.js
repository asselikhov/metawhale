// Тестирование полного ответа CoinMarketCap API
require('dotenv').config();
const axios = require('axios');

async function testCMCResponse() {
  console.log('🔍 Тестирование полного ответа CoinMarketCap API...\n');
  
  try {
    if (!process.env.CMC_API_KEY) {
      console.log('❌ CMC API ключ не найден');
      return;
    }

    console.log('📡 Делаем запрос к CoinMarketCap...');
    
    const response = await axios.get(
      'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
          'Accept': 'application/json'
        },
        params: {
          id: '36465', // ID для Whalebit (CES) на Polygon
          convert: 'USD'
        },
        timeout: 10000
      }
    );

    console.log('✅ Ответ получен, статус:', response.status);
    
    if (response.data && response.data.data && response.data.data['36465']) {
      const cesData = response.data.data['36465'];
      const quote = cesData.quote.USD;
      
      console.log('\n📊 ПОЛНАЯ СТРУКТУРА ДАННЫХ:');
      console.log('='.repeat(50));
      console.log(JSON.stringify(cesData, null, 2));
      console.log('='.repeat(50));
      
      console.log('\n💰 ЦЕНА И ATH:');
      console.log(`Цена: $${quote.price}`);
      console.log(`ATH в ответе: ${quote.ath ? `$${quote.ath}` : 'ОТСУТСТВУЕТ'}`);
      console.log(`Все ключи в quote.USD:`, Object.keys(quote));
      
      console.log('\n🔍 ПРОВЕРКА ATH:');
      if (quote.ath) {
        console.log(`✅ ATH доступен: $${quote.ath}`);
      } else {
        console.log(`❌ ATH НЕ ДОСТУПЕН в бесплатном плане`);
        console.log(`🔄 Используем текущую цену как ATH: $${quote.price}`);
      }
      
      console.log('\n💱 ВАЛЮТНАЯ КОНВЕРТАЦИЯ:');
      console.log(`Доступные валюты в ответе:`, Object.keys(cesData.quote));
      console.log(`RUB в ответе: ${cesData.quote.RUB ? 'ДА' : 'НЕТ'}`);
      
      if (!cesData.quote.RUB) {
        console.log(`❌ Рубли НЕ ДОСТУПНЫ в бесплатном плане`);
        console.log(`💡 Нужен дополнительный API для конвертации USD → RUB`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.log('HTTP Status:', error.response.status);
      console.log('Response:', error.response.data);
    }
  }
}

// Запускаем тест
testCMCResponse().catch(console.error);