/**
 * Test Escrow Timeout Configuration
 * Проверяет настройки времени заморозки токенов
 */

require('dotenv').config();
const config = require('../src/config/configuration');

console.log('🕐 Проверка настроек времени заморозки токенов');
console.log('================================================');

console.log('\n📋 Текущие настройки:');
console.log(`   - Время заморозки: ${config.escrow.timeoutMinutes} минут`);
console.log(`   - Время спора: ${config.escrow.disputeTimeoutMinutes} минут`);
console.log(`   - Смарт-контракт: ${config.escrow.useSmartContract ? 'Включен' : 'Выключен'}`);
if (config.escrow.contractAddress) {
  console.log(`   - Адрес контракта: ${config.escrow.contractAddress}`);
}

console.log('\n🎭 Тестирование форматирования времени:');
const testTimes = [15, 30, 60, 90, 120, 1440, 2880];

testTimes.forEach(minutes => {
  const formatted = config.escrow.displayFormat.minutes(minutes);
  console.log(`   - ${minutes} минут = \"${formatted}\"`);
});

console.log('\n✅ Проверка настроек завершена');

// Тестирование изменения настроек
console.log('\n🔧 Тестирование изменения настроек...');

// Имитируем различные значения
const testValues = {
  ESCROW_TIMEOUT_MINUTES: '45',
  ESCROW_DISPUTE_TIMEOUT_MINUTES: '720'
};

Object.entries(testValues).forEach(([key, value]) => {
  const oldValue = process.env[key];
  process.env[key] = value;
  
  // Перезагружаем конфигурацию
  delete require.cache[require.resolve('../src/config/configuration')];
  const newConfig = require('../src/config/configuration');
  
  console.log(`\n📝 Если ${key}=${value}:`);
  console.log(`   - Время заморозки: ${newConfig.escrow.displayFormat.minutes(newConfig.escrow.timeoutMinutes)}`);
  console.log(`   - Время спора: ${newConfig.escrow.displayFormat.minutes(newConfig.escrow.disputeTimeoutMinutes)}`);
  
  // Восстанавливаем старое значение
  if (oldValue) {
    process.env[key] = oldValue;
  } else {
    delete process.env[key];
  }
});

// Восстанавливаем оригинальную конфигурацию
delete require.cache[require.resolve('../src/config/configuration')];
const originalConfig = require('../src/config/configuration');

console.log('\n🎉 Тестирование завершено успешно!');
console.log('\n💡 Для изменения времени заморозки:');
console.log('   1. Отредактируйте .env файл');
console.log('   2. Измените ESCROW_TIMEOUT_MINUTES=<минуты>');
console.log('   3. Перезапустите бота');
console.log('\nПример: ESCROW_TIMEOUT_MINUTES=60 (1 час)');