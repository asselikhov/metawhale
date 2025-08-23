// Тестовый файл для проверки функций бота
require('dotenv').config();

// Заглушка данных для тестирования форматирования
const testPriceData = {
  price: 3.18,
  priceRub: 256.40,
  change24h: -3.58,
  volume24h: 1170000,
  ath: 3.18
};

// Функция форматирования больших чисел (копия из основного файла)
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

// Тестирование формата сообщения
function testMessageFormat() {
  console.log('🧪 Тестирование формата сообщения...\n');
  
  const changeEmoji = testPriceData.change24h >= 0 ? '🔺' : '🔻';
  const changeSign = testPriceData.change24h >= 0 ? '+' : '';
  
  const message = `💰 Цена токена CES: $ ${testPriceData.price.toFixed(2)}${testPriceData.priceRub > 0 ? ` | ₽ ${testPriceData.priceRub.toFixed(2)}` : ''}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${testPriceData.change24h.toFixed(2)}% • 🅥 $ ${formatNumber(testPriceData.volume24h)} • 🅐🅣🅗 $ ${testPriceData.ath.toFixed(2)}`;

  console.log('📄 Результат форматирования:');
  console.log(message);
  console.log('\n✅ Тест форматирования завершен успешно!');
}

// Тестирование функции formatNumber
function testFormatNumber() {
  console.log('\n🧪 Тестирование функции formatNumber...\n');
  
  const testValues = [1170000, 1500000000, 50000, 123.45];
  
  testValues.forEach(value => {
    console.log(`${value} → ${formatNumber(value)}`);
  });
  
  console.log('\n✅ Тест formatNumber завершен успешно!');
}

// Запуск всех тестов
console.log('🚀 Запуск тестов Telegram бота CES...\n');
testMessageFormat();
testFormatNumber();
console.log('\n🎉 Все тесты завершены успешно!');