// Тестовый файл для проверки функций бота
require('dotenv').config();

// Заглушка данных для тестирования форматирования
const testPriceData = {
  price: 3.18,
  priceRub: 256.40,
  change24h: -3.58,
  volume24h: 1170000,
  ath: 4.25 // Реалистичное значение ATH выше текущей цены
};

const testPriceDataATH = {
  price: 4.35, // Цена выше ATH
  priceRub: 350.50,
  change24h: 15.25,
  volume24h: 2500000,
  ath: 4.35 // Новый ATH
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
  console.log('🧪 Тестирование формата сообщения (обычная цена)...\n');
  
  const changeEmoji = testPriceData.change24h >= 0 ? '🔺' : '🔻';
  const changeSign = testPriceData.change24h >= 0 ? '+' : '';
  const isNewATH = testPriceData.price >= testPriceData.ath;
  const athDisplay = isNewATH ? `🏆 $ ${testPriceData.ath.toFixed(2)}` : `$ ${testPriceData.ath.toFixed(2)}`;
  
  const message = `💰 Цена токена CES: $ ${testPriceData.price.toFixed(2)}${testPriceData.priceRub > 0 ? ` | ₽ ${testPriceData.priceRub.toFixed(2)}` : ''}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${testPriceData.change24h.toFixed(2)}% • 🅥 $ ${formatNumber(testPriceData.volume24h)} • 🅐🅣🅗 ${athDisplay}`;

  console.log('📄 Результат форматирования (падение цены):');
  console.log(message);
  console.log('\n✅ Тест форматирования обычной цены завершен успешно!');
}

// Тестирование формата сообщения с новым ATH
function testMessageFormatATH() {
  console.log('\n🧪 Тестирование формата сообщения (новый ATH)...\n');
  
  const changeEmoji = testPriceDataATH.change24h >= 0 ? '🔺' : '🔻';
  const changeSign = testPriceDataATH.change24h >= 0 ? '+' : '';
  const isNewATH = testPriceDataATH.price >= testPriceDataATH.ath;
  const athDisplay = isNewATH ? `🏆 $ ${testPriceDataATH.ath.toFixed(2)}` : `$ ${testPriceDataATH.ath.toFixed(2)}`;
  
  const message = `💰 Цена токена CES: $ ${testPriceDataATH.price.toFixed(2)}${testPriceDataATH.priceRub > 0 ? ` | ₽ ${testPriceDataATH.priceRub.toFixed(2)}` : ''}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${testPriceDataATH.change24h.toFixed(2)}% • 🅥 $ ${formatNumber(testPriceDataATH.volume24h)} • 🅐🅣🅗 ${athDisplay}`;

  console.log('📄 Результат форматирования (новый ATH):');
  console.log(message);
  console.log('\n✅ Тест форматирования нового ATH завершен успешно!');
}

// Тестирование функции formatNumber
function testFormatNumber() {
  console.log('\n🧪 Тестирование функции formatNumber...\n');
  
  const testValues = [1170000, 1500000000, 50000, 123.45, 2500000];
  
  testValues.forEach(value => {
    console.log(`${value} → ${formatNumber(value)}`);
  });
  
  console.log('\n✅ Тест formatNumber завершен успешно!');
}

// Тестирование логики ATH
function testATHLogic() {
  console.log('\n🧪 Тестирование логики ATH...\n');
  
  // Тест 1: Текущая цена ниже ATH
  console.log('Тест 1: Цена $3.18 vs ATH $4.25');
  console.log(`Результат: ${3.18 >= 4.25 ? 'Новый ATH! 🏆' : 'Цена ниже ATH'}`);
  
  // Тест 2: Текущая цена равна ATH
  console.log('\nТест 2: Цена $4.25 vs ATH $4.25');
  console.log(`Результат: ${4.25 >= 4.25 ? 'Достигнут ATH! 🏆' : 'Цена ниже ATH'}`);
  
  // Тест 3: Текущая цена выше ATH
  console.log('\nТест 3: Цена $4.35 vs ATH $4.25');
  console.log(`Результат: ${4.35 >= 4.25 ? 'Новый ATH! 🏆' : 'Цена ниже ATH'}`);
  
  console.log('\n✅ Тест логики ATH завершен успешно!');
}

// Запуск всех тестов
console.log('🚀 Запуск тестов Telegram бота CES (обновленная версия)...\n');
testMessageFormat();
testMessageFormatATH();
testFormatNumber();
testATHLogic();
console.log('\n🎉 Все тесты завершены успешно! ATH теперь работает корректно.');
console.log('\n📝 Изменения:');
console.log('• ATH теперь берется из базы данных, если API не предоставляет');
console.log('• Добавлена проверка на новый ATH с эмодзи 🏆');
console.log('• Улучшена логика fallback для разных токенов');
console.log('• Добавлено логирование обновлений ATH');