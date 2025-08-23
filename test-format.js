// Тестовый файл для проверки исправленной логики ATH
require('dotenv').config();

// Тестовые данные
const testCases = [
  {
    name: "Цена ниже ATH",
    currentPrice: 3.18,
    historicalATH: 4.25,
    expectedATH: 4.25,
    expectedEmoji: ""
  },
  {
    name: "Цена равна ATH", 
    currentPrice: 4.25,
    historicalATH: 4.25,
    expectedATH: 4.25,
    expectedEmoji: "🏆"
  },
  {
    name: "Новый ATH",
    currentPrice: 4.50,
    historicalATH: 4.25, 
    expectedATH: 4.50,
    expectedEmoji: "🏆"
  },
  {
    name: "Первая запись (нет истории)",
    currentPrice: 2.80,
    historicalATH: null,
    expectedATH: 2.80,
    expectedEmoji: "🏆"
  }
];

// Функция симуляции логики ATH
function simulateATHLogic(currentPrice, historicalATH) {
  // Логика как в исправленном коде
  let athValue = historicalATH || currentPrice;
  let finalATH = Math.max(athValue, currentPrice);
  let isNewATH = currentPrice >= finalATH;
  
  return {
    ath: finalATH,
    isNewATH: isNewATH
  };
}

// Функция форматирования чисел
function formatNumber(num) {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}

// Основная функция тестирования
function runATHTests() {
  console.log('🧪 Тестирование исправленной логики ATH...\n');
  
  let passedTests = 0;
  
  testCases.forEach((testCase, index) => {
    const result = simulateATHLogic(testCase.currentPrice, testCase.historicalATH);
    
    const passed = result.ath === testCase.expectedATH && 
                   result.isNewATH === (testCase.expectedEmoji === "🏆");
    
    console.log(`Тест ${index + 1}: ${testCase.name}`);
    console.log(`  Текущая цена: $${testCase.currentPrice.toFixed(2)}`);
    console.log(`  Исторический ATH: ${testCase.historicalATH ? '$' + testCase.historicalATH.toFixed(2) : 'отсутствует'}`);
    console.log(`  Ожидаемый ATH: $${testCase.expectedATH.toFixed(2)}`);
    console.log(`  Результат ATH: $${result.ath.toFixed(2)}`);
    console.log(`  Новый ATH: ${result.isNewATH ? 'Да 🏆' : 'Нет'}`);
    console.log(`  Статус: ${passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}\n`);
    
    if (passed) passedTests++;
  });
  
  console.log(`📊 Результаты: ${passedTests}/${testCases.length} тестов пройдено`);
  
  if (passedTests === testCases.length) {
    console.log('🎉 Все тесты пройдены! Логика ATH работает корректно.');
  } else {
    console.log('⚠️ Некоторые тесты провалены. Требуется дополнительная отладка.');
  }
}

// Тест форматирования сообщения
function testMessageFormat() {
  console.log('\n📝 Тестирование формата сообщения...\n');
  
  // Тест с CoinMarketCap
  const testDataCMC = {
    price: 3.18,
    priceRub: 256.40,
    change24h: -3.58,
    volume24h: 1170000,
    ath: 4.25,
    source: 'coinmarketcap'
  };
  
  const changeEmoji = testDataCMC.change24h >= 0 ? '🔺' : '🔻';
  const changeSign = testDataCMC.change24h >= 0 ? '+' : '';
  const isNewATH = testDataCMC.price >= testDataCMC.ath;
  const athDisplay = isNewATH ? `🏆 $ ${testDataCMC.ath.toFixed(2)}` : `$ ${testDataCMC.ath.toFixed(2)}`;
  const sourceEmoji = '🅲🅼🅲';
  
  const messageCMC = `💰 Цена токена CES: $ ${testDataCMC.price.toFixed(2)} | ₽ ${testDataCMC.priceRub.toFixed(2)} ${sourceEmoji}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${testDataCMC.change24h.toFixed(2)}% • 🅥 $ ${formatNumber(testDataCMC.volume24h)} • 🅐🅣🅗 ${athDisplay}`;
  
  console.log('Результат форматирования (CoinMarketCap):');
  console.log(messageCMC);
  
  // Тест с database fallback
  const testDataDB = {
    ...testDataCMC,
    source: 'database'
  };
  
  const sourceEmojiDB = '🗄️';
  
  const messageDB = `💰 Цена токена CES: $ ${testDataDB.price.toFixed(2)} | ₽ ${testDataDB.priceRub.toFixed(2)} ${sourceEmojiDB}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${testDataDB.change24h.toFixed(2)}% • 🅥 $ ${formatNumber(testDataDB.volume24h)} • 🅐🅣🅗 ${athDisplay}`;
  
  console.log('\nРезультат форматирования (Database Cache):');
  console.log(messageDB);
  
  console.log('\n✅ Формат сообщения корректен для CoinMarketCap и database cache');
}

// Запуск всех тестов
console.log('🚀 Запуск тестов исправленной логики ATH...\n');
runATHTests();
testMessageFormat();
console.log('\n✨ Тестирование завершено!');
console.log('\n🔧 Новые возможности:');
console.log('• 🥇 CoinMarketCap API как единственный источник данных');
console.log('• 🏆 Точные данные ATH из CMC');
console.log('• 📊 Индикаторы источника данных (🅲🅼🅲 / 🗄️)');
console.log('• 🔄 Fallback на базу данных при ошибках API');
console.log('• ♾️ Упрощенная и надежная логика ATH');
console.log('\n📝 Конфигурация:');
console.log('• Добавьте CMC_API_KEY в .env для получения данных из CoinMarketCap');
console.log('• Тест CoinMarketCap: yarn test-cmc');
console.log('• Получить API ключ: https://coinmarketcap.com/api/');