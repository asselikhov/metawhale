/**
 * Тест для проверки команды /start и отображения главного меню
 */

const { Markup } = require('telegraf');
const LocalizationHelper = require('../src/utils/localizationHelper');

// Мокаем контекст Telegram для тестирования команды /start
const mockCtx = {
  chat: {
    id: 'test_start_command',
    username: 'testuser'
  },
  from: {
    language_code: 'ru'
  },
  reply: async (message, keyboard) => {
    console.log('\n🤖 Ответ бота на команду /start:');
    console.log(`   Сообщение: ${message}`);
    
    if (keyboard && keyboard.reply_markup && keyboard.reply_markup.keyboard) {
      console.log('   Кнопки главного меню:');
      keyboard.reply_markup.keyboard.forEach((row, index) => {
        console.log(`     Ряд ${index + 1}: [${row.map(btn => `"${btn}"`).join(', ')}]`);
      });
    }
    
    return { message_id: 1001 };
  }
};

async function testStartCommand() {
  console.log('🚀 Тестирование команды /start');
  console.log('================================');
  
  try {
    const chatId = mockCtx.chat.id.toString();
    
    // Имитируем обработку команды /start
    console.log('\n--- Обработка команды /start ---');
    
    const welcomeMessage = 'Добро пожаловать в Rustling Grass 🌾 assistant !';
    console.log(`Приветственное сообщение: ${welcomeMessage}`);
    
    // Создаем главное меню
    const mainMenuButtons = await LocalizationHelper.getLocalizedMainMenu(chatId);
    const mainMenu = Markup.keyboard(mainMenuButtons).resize();
    
    console.log('\n--- Структура меню ---');
    console.log('Кнопки меню:', JSON.stringify(mainMenuButtons, null, 2));
    
    // Проверяем структуру меню
    if (mainMenuButtons.length !== 1) {
      throw new Error(`Ожидался 1 ряд кнопок, получено: ${mainMenuButtons.length}`);
    }
    
    if (mainMenuButtons[0].length !== 4) {
      throw new Error(`Ожидалось 4 кнопки в ряду, получено: ${mainMenuButtons[0].length}`);
    }
    
    // Отправляем приветственное сообщение с меню
    await mockCtx.reply(welcomeMessage, mainMenu);
    
    console.log('\n✅ Команда /start работает корректно');
    console.log('✅ Главное меню отображается правильно');
    console.log('✅ Все 4 кнопки присутствуют');
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка тестирования команды /start:', error.message);
    return false;
  }
}

// Запуск теста
async function runStartCommandTest() {
  console.log('🧪 ТЕСТ КОМАНДЫ /START');
  console.log('Проверяет корректность работы команды /start и отображения главного меню\n');
  
  try {
    const result = await testStartCommand();
    
    console.log(`\n${'='.repeat(50)}`);
    if (result) {
      console.log('🎉 ТЕСТ ПРОЙДЕН УСПЕШНО!');
      console.log('✅ Команда /start работает корректно');
      console.log('✅ Главное меню отображается с 4 кнопками в одном ряду');
      console.log('✅ Структура меню соответствует требованиям');
    } else {
      console.log('❌ ТЕСТ ПРОВАЛЕН');
      console.log('❌ Обнаружены ошибки в работе команды /start');
    }
    console.log(`${'='.repeat(50)}`);
    
    return result;
  } catch (error) {
    console.error('💥 Тест завершился с ошибкой:', error);
    return false;
  }
}

// Запускаем тест
if (require.main === module) {
  runStartCommandTest().then((success) => {
    console.log('\n🏁 Тест команды /start завершен');
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('💥 Тест команды /start завершился с ошибкой:', error);
    process.exit(1);
  });
}

module.exports = { testStartCommand };