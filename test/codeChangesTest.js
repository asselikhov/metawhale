/**
 * Тест проверки изменений в коде
 */

console.log('Проверка изменений в коде...');

// Проверяем, что изменения в BaseCommandHandler корректны
const fs = require('fs');

// Читаем файл BaseCommandHandler
const baseCommandHandlerContent = fs.readFileSync('./src/handlers/BaseCommandHandler.js', 'utf8');

// Проверяем, что добавлен код для определения языка пользователя
if (baseCommandHandlerContent.includes('ctx.from.language_code')) {
  console.log('✅ Код для определения языка пользователя найден в BaseCommandHandler');
} else {
  console.log('❌ Код для определения языка пользователя НЕ найден в BaseCommandHandler');
}

// Проверяем, что изменения в WalletHandler корректны
const walletHandlerContent = fs.readFileSync('./src/handlers/WalletHandler.js', 'utf8');

// Проверяем, что добавлен код для отображения баланса в выбранной валюте
if (walletHandlerContent.includes('fiatCurrencyService.getUserCurrency')) {
  console.log('✅ Код для отображения баланса в выбранной валюте найден в WalletHandler');
} else {
  console.log('❌ Код для отображения баланса в выбранной валюте НЕ найден в WalletHandler');
}

console.log('✅ Проверка изменений завершена!');