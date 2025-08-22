const fs = require('fs');
require('dotenv').config();

console.log('🔍 Проверка конфигурации CES Price Telegram Bot\n');

// Проверка переменных окружения
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'MONGODB_URI',
  'CES_CONTRACT_ADDRESS',
  'COINGECKO_API_URL'
];

let configOk = true;

console.log('📋 Проверка переменных окружения:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value !== 'your_bot_token_here') {
    console.log(`✅ ${varName}: настроен`);
  } else {
    console.log(`❌ ${varName}: НЕ НАСТРОЕН`);
    configOk = false;
  }
});

console.log('\n📁 Проверка файлов проекта:');
const requiredFiles = [
  'package.json',
  'index.js',
  '.env',
  'README.md',
  '.gitignore'
];

requiredFiles.forEach(fileName => {
  if (fs.existsSync(fileName)) {
    console.log(`✅ ${fileName}: существует`);
  } else {
    console.log(`❌ ${fileName}: НЕ НАЙДЕН`);
    configOk = false;
  }
});

console.log('\n🌐 Информация о токене CES:');
console.log(`📋 Контракт: ${process.env.CES_CONTRACT_ADDRESS}`);
console.log(`🔗 Сеть: Polygon`);
console.log(`⏰ Интервал API: ${process.env.API_CALL_INTERVAL || 10000}мс`);

console.log('\n📅 Расписание рассылок:');
console.log('🌅 Утро: 8:00 МСК');
console.log('🌆 Вечер: 20:00 МСК');

if (configOk) {
  console.log('\n🎉 Конфигурация выглядит корректно!');
  console.log('📝 Следующие шаги:');
  console.log('   1. npm install');
  console.log('   2. Настройте .env файл с реальными токенами');
  console.log('   3. npm start');
} else {
  console.log('\n⚠️ Обнаружены проблемы с конфигурацией!');
  console.log('📝 Исправьте указанные выше ошибки перед запуском.');
}

console.log('\n' + '='.repeat(50));