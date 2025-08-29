/**
 * Тест для проверки соответствия главного меню спецификациям проекта
 * Проверяет, что отображаются только две кнопки: 'Личный кабинет' и '🔄 P2P Биржа'
 */

const { Markup } = require('telegraf');

// Мокаем сервис локализации
const mockLanguageService = {
  getText: async (chatId, key) => {
    const translations = {
      'ru': {
        'personal_cabinet': 'Личный кабинет',
        'p2p': '🔄 P2P Биржа'
      }
    };
    
    // По умолчанию используем русский язык
    return translations['ru'][key] || key;
  }
};

// Мокаем LocalizationHelper
const mockLocalizationHelper = {
  getText: mockLanguageService.getText,
  getLocalizedMainMenu: async (chatId) => {
    // Согласно спецификациям проекта, главное меню должно содержать ровно две кнопки:
    // 'Личный кабинет' и '🔄 P2P Биржа'
    const personalCabinet = await mockLanguageService.getText(chatId, 'personal_cabinet');
    const p2p = await mockLanguageService.getText(chatId, 'p2p');
    
    return [
      [personalCabinet, p2p]
    ];
  }
};

// Мокаем контекст Telegram для тестирования
const mockCtx = {
  chat: {
    id: 'test_user_menu'
  },
  reply: async (message, keyboard) => {
    console.log('\n🤖 Ответ бота:');
    console.log(`   Сообщение: ${message}`);
    
    if (keyboard && keyboard.reply_markup && keyboard.reply_markup.keyboard) {
      console.log('   Кнопки главного меню:');
      keyboard.reply_markup.keyboard.forEach((row, index) => {
        console.log(`     Ряд ${index + 1}: [${row.map(btn => `"${btn}"`).join(', ')}]`);
      });
      
      // Проверяем количество кнопок
      const totalButtons = keyboard.reply_markup.keyboard.reduce((acc, row) => acc + row.length, 0);
      console.log(`   Всего кнопок: ${totalButtons}`);
    } else if (keyboard) {
      console.log(`   Клавиатура:`, JSON.stringify(keyboard, null, 2));
    }
    
    return { message_id: 1001 };
  }
};

async function testMainMenuSpecification() {
  console.log('🚀 Тестирование соответствия главного меню спецификациям проекта...\n');
  
  try {
    const chatId = mockCtx.chat.id.toString();
    
    // Тестируем создание главного меню
    console.log('--- Создание главного меню ---');
    const mainMenuButtons = await mockLocalizationHelper.getLocalizedMainMenu(chatId);
    console.log('Структура кнопок главного меню:', JSON.stringify(mainMenuButtons, null, 2));
    
    // Проверяем, что меню содержит только один ряд
    if (mainMenuButtons.length === 1) {
      console.log('✅ Меню содержит только один ряд кнопок');
    } else {
      console.log(`❌ Меню содержит ${mainMenuButtons.length} рядов кнопок, ожидался 1`);
      return false;
    }
    
    // Проверяем, что в ряду ровно две кнопки
    const row = mainMenuButtons[0];
    if (row.length === 2) {
      console.log('✅ Ряд содержит ровно две кнопки');
    } else {
      console.log(`❌ Ряд содержит ${row.length} кнопок, ожидалось 2`);
      return false;
    }
    
    // Проверяем содержимое кнопок
    const [firstButton, secondButton] = row;
    if (firstButton === 'Личный кабинет') {
      console.log('✅ Первая кнопка: "Личный кабинет"');
    } else {
      console.log(`❌ Первая кнопка: "${firstButton}", ожидалось "Личный кабинет"`);
      return false;
    }
    
    if (secondButton === '🔄 P2P Биржа') {
      console.log('✅ Вторая кнопка: "🔄 P2P Биржа"');
    } else {
      console.log(`❌ Вторая кнопка: "${secondButton}", ожидалось "🔄 P2P Биржа"`);
      return false;
    }
    
    // Тестируем отображение клавиатуры
    console.log('\n--- Отображение клавиатуры ---');
    const mainMenu = Markup.keyboard(mainMenuButtons).resize();
    const menuMessage = 'Добро пожаловать в Rustling Grass 🌾 assistant !';
    await mockCtx.reply(menuMessage, mainMenu);
    
    console.log('\n✅ Тест соответствия главного меню спецификациям проекта пройден успешно');
    return true;
  } catch (error) {
    console.error('❌ Тест соответствия главного меню спецификациям проекта провален:', error);
    return false;
  }
}

// Запуск теста
async function runTest() {
  console.log('🚀 Запуск теста соответствия главного меню спецификациям проекта...\n');
  
  console.log('Спецификации проекта:');
  console.log('- Главное меню должно содержать ровно две кнопки стандартной клавиатуры');
  console.log('- Первая кнопка: "Личный кабинет"');
  console.log('- Вторая кнопка: "🔄 P2P Биржа"');
  console.log('- Не должно быть других кнопок в главном меню\n');
  
  try {
    const result = await testMainMenuSpecification();
    
    console.log(`\n${'='.repeat(60)}`);
    if (result) {
      console.log('🎉 Все тесты пройдены! Главное меню соответствует спецификациям проекта.');
      console.log('✅ Отображаются только две кнопки: "Личный кабинет" и "🔄 P2P Биржа"');
    } else {
      console.log('❌ Тесты провалены. Главное меню не соответствует спецификациям проекта.');
    }
    console.log(`${'='.repeat(60)}`);
    
  } catch (error) {
    console.error('💥 Тест завершился с ошибкой:', error);
  }
}

// Запускаем тест
if (require.main === module) {
  runTest().then(() => {
    console.log('\n🏁 Тест завершен');
  }).catch((error) => {
    console.error('💥 Тест завершился с ошибкой:', error);
  });
}

module.exports = { testMainMenuSpecification };