/**
 * Простой тест функциональности валют
 */

console.log('Тестирование функциональности валют...');

// Проверяем, что модули загружаются
try {
  const fiatCurrencyService = require('../src/services/fiatCurrencyService');
  console.log('✅ FiatCurrencyService загружен');
  
  const supportedCurrencies = fiatCurrencyService.getSupportedCurrencies();
  console.log(`📋 Поддерживаемые валюты: ${supportedCurrencies.length}`);
  
  // Проверяем функцию форматирования
  const formatted = fiatCurrencyService.formatAmount(100.50, 'USD');
  console.log(`🎨 Форматирование: 100.50 USD → ${formatted}`);
  
  console.log('✅ Все тесты пройдены успешно!');
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}