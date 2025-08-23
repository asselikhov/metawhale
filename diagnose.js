// Диагностический скрипт для проверки конфигурации бота
require('dotenv').config();
const axios = require('axios');

console.log('🔍 Диагностика конфигурации CES Price Bot...\n');

// Проверка переменных окружения
console.log('📋 Проверка переменных окружения:');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Отсутствует');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Установлен' : '❌ Отсутствует');
console.log('CMC_API_KEY:', process.env.CMC_API_KEY ? '✅ Установлен' : '❌ Отсутствует');
console.log('WEBHOOK_URL:', process.env.WEBHOOK_URL ? '✅ Установлен' : '❌ Отсутствует');
console.log('PORT:', process.env.PORT || '3000 (по умолчанию)');
console.log('API_CALL_INTERVAL:', process.env.API_CALL_INTERVAL || '10000 (по умолчанию)');

if (!process.env.CMC_API_KEY || process.env.CMC_API_KEY === 'your_coinmarketcap_api_key_here') {
  console.log('\n🔑 ВНИМАНИЕ: CMC_API_KEY не настроен правильно!');
  console.log('📝 Для получения API ключа:');
  console.log('1. Перейдите на https://coinmarketcap.com/api/');
  console.log('2. Зарегистрируйтесь и получите бесплатный API ключ');
  console.log('3. Установите CMC_API_KEY в переменных окружения Render');
  console.log('4. Перезапустите сервис\n');
  return;
}

// Тест CoinMarketCap API
async function testCMCAPI() {
  console.log('\n🧪 Тестирование CoinMarketCap API...');
  
  try {
    // Тест 1: Проверка API ключа
    console.log('\n1️⃣ Проверка валидности API ключа...');
    const testResponse = await axios.get(
      'https://pro-api.coinmarketcap.com/v1/key/info',
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    
    if (testResponse.data && testResponse.data.data) {
      const keyInfo = testResponse.data.data;
      console.log('✅ API ключ валиден');
      console.log(`📊 План: ${keyInfo.plan?.name || 'Неизвестно'}`);
      console.log(`📈 Кредиты использовано сегодня: ${keyInfo.usage?.current_day?.credits_used || 0}`);
      console.log(`📉 Лимит кредитов в день: ${keyInfo.usage?.current_day?.credits_left + keyInfo.usage?.current_day?.credits_used || 'Неизвестно'}`);
    }
    
    // Тест 2: Поиск токена CES
    console.log('\n2️⃣ Поиск токена CES...');
    const cesResponse = await axios.get(
      'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
          'Accept': 'application/json'
        },
        params: {
          symbol: 'CES',
          convert: 'USD' // Бесплатный план поддерживает только 1 валюту
        },
        timeout: 10000
      }
    );
    
    if (cesResponse.data && cesResponse.data.data && cesResponse.data.data.CES) {
      const cesTokens = cesResponse.data.data.CES;
      console.log(`✅ Найдено ${cesTokens.length} токен(ов) с символом CES`);
      
      cesTokens.forEach((token, index) => {
        console.log(`\n--- Токен ${index + 1} ---`);
        console.log(`ID: ${token.id}`);
        console.log(`Название: ${token.name}`);
        console.log(`Символ: ${token.symbol}`);
        console.log(`Платформа: ${token.platform?.name || 'Основная сеть'}`);
        console.log(`Адрес контракта: ${token.platform?.token_address || 'N/A'}`);
        
        if (token.quote?.USD) {
          console.log(`Цена: $${token.quote.USD.price?.toFixed(6) || 'N/A'}`);
          console.log(`Изменение 24ч: ${token.quote.USD.percent_change_24h?.toFixed(2) || 'N/A'}%`);
          console.log(`Рыночная кап: $${token.quote.USD.market_cap ? (token.quote.USD.market_cap / 1e6).toFixed(2) + 'M' : 'N/A'}`);
        }
      });
      
      // Ищем токен на Polygon
      const polygonToken = cesTokens.find(token => 
        token.platform?.name?.toLowerCase().includes('polygon') ||
        token.platform?.token_address?.toLowerCase() === '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610'
      );
      
      if (polygonToken) {
        console.log('\n🎯 Найден CES токен на Polygon сети!');
        console.log(`ID для использования: ${polygonToken.id}`);
      } else {
        console.log('\n⚠️ CES токен на Polygon не найден среди результатов');
        console.log('💡 Возможно потребуется использовать конкретный ID токена');
      }
      
    } else {
      console.log('❌ Токен CES не найден в CoinMarketCap');
      console.log('🔍 Возможные причины:');
      console.log('• Токен не листится на CoinMarketCap');
      console.log('• Токен имеет другой символ');
      console.log('• Требуется поиск по ID вместо символа');
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка при тестировании CoinMarketCap API:');
    console.error('Сообщение:', error.message);
    
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n🔑 Проблема с авторизацией:');
        console.log('• API ключ неверный или истек');
        console.log('• Проверьте правильность CMC_API_KEY');
      } else if (error.response.status === 400) {
        console.log('\n📝 Неверный запрос:');
        console.log('• Проверьте параметры запроса');
        console.log('• Возможно, токен CES не существует с таким символом');
      } else if (error.response.status === 429) {
        console.log('\n⏱️ Превышен лимит запросов:');
        console.log('• Исчерпан дневной лимит бесплатного плана');
        console.log('• Попробуйте позже или обновите план');
      }
    }
  }
}

// Тест подключения к MongoDB
async function testMongoDB() {
  if (!process.env.MONGODB_URI) {
    console.log('\n❌ MONGODB_URI не установлен');
    return;
  }
  
  console.log('\n🗄️ Тестирование подключения к MongoDB...');
  
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB успешно');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
  }
}

// Запуск всех тестов
async function runDiagnostics() {
  await testCMCAPI();
  await testMongoDB();
  
  console.log('\n🏁 Диагностика завершена!');
  console.log('\n💡 Рекомендации:');
  console.log('• Убедитесь, что CMC_API_KEY установлен правильно');
  console.log('• Проверьте лимиты API на https://coinmarketcap.com/api/account/');
  console.log('• При проблемах с токеном CES рассмотрите поиск по ID');
  console.log('• Проверьте логи бота для дополнительной информации');
}

runDiagnostics().catch(console.error);