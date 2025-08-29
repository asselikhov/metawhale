/**
 * Тест для проверки загрузки всех модулей
 */

async function testModuleLoading() {
  console.log('🚀 Тестирование загрузки модулей...');
  
  try {
    // Тест импорта основных модулей
    console.log('\n--- Тестирование основных модулей ---');
    
    // Попробуем импортировать app.js
    console.log('1. Импорт src/app.js...');
    const app = require('../src/app.js');
    console.log('   ✅ Успешно');
    
    // Попробуем импортировать TelegramBot
    console.log('2. Импорт src/modules/bot/TelegramBot.js...');
    const TelegramBot = require('../src/modules/bot/TelegramBot.js');
    console.log('   ✅ Успешно');
    
    // Попробуем импортировать MessageHandler из bot module
    console.log('3. Импорт src/modules/bot/MessageHandler.js...');
    const BotMessageHandler = require('../src/modules/bot/MessageHandler.js');
    console.log('   ✅ Успешно');
    
    // Попробуем импортировать messageHandler из handlers
    console.log('4. Импорт src/handlers/messageHandler.js...');
    const messageHandler = require('../src/handlers/messageHandler.js');
    console.log('   ✅ Успешно');
    
    // Попробуем импортировать BaseCommandHandler
    console.log('5. Импорт src/handlers/base/BaseCommandHandler.js...');
    const BaseCommandHandler = require('../src/handlers/base/BaseCommandHandler.js');
    console.log('   ✅ Успешно');
    
    // Попробуем импортировать handlers index
    console.log('6. Импорт src/handlers/index.js...');
    const handlersIndex = require('../src/handlers/index.js');
    console.log('   ✅ Успешно');
    
    // Попробуем импортировать core modules
    console.log('7. Импорт src/modules/core/index.js...');
    const coreModules = require('../src/modules/core/index.js');
    console.log('   ✅ Успешно');
    
    // Попробуем импортировать bot modules
    console.log('8. Импорт src/modules/bot/index.js...');
    const botModules = require('../src/modules/bot/index.js');
    console.log('   ✅ Успешно');
    
    console.log('\n🎉 Все модули загружаются успешно!');
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка загрузки модулей:', error.message);
    console.error('Стек ошибки:', error.stack);
    return false;
  }
}

// Запуск теста
if (require.main === module) {
  testModuleLoading().then(success => {
    console.log('\n🏁 Тест загрузки модулей завершен');
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Тест завершился с ошибкой:', error);
    process.exit(1);
  });
}

module.exports = { testModuleLoading };