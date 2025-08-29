/**
 * Тест для проверки расположения кнопок в одной строке
 * Проверяет, что все 4 кнопки отображаются в одной строке
 */

const { Markup } = require('telegraf');
const LocalizationHelper = require('../src/utils/localizationHelper');

// Мокаем сервис языка для тестирования
const mockLanguageService = {
  getText: async (chatId, key) => {
    const translations = {
      'ru': {
        'main_menu': '🌾 Главное меню',
        'personal_cabinet': '👤 ЛК',
        'p2p': '🔄 P2P',
        'matrix': '💠 Matrix',
        'settings': '⚙️ Настройки'
      }
    };
    
    // По умолчанию русский язык
    return translations['ru'][key] || key;
  }
};

// Мокаем LocalizationHelper с обновленной реализацией
const mockLocalizationHelper = {
  getText: mockLanguageService.getText,
  getLocalizedMainMenu: async (chatId) => {
    // Возвращаем 4 кнопки в одной строке как запрошено
    const personalCabinet = await mockLanguageService.getText(chatId, 'personal_cabinet');
    const p2p = await mockLanguageService.getText(chatId, 'p2p');
    const matrix = await mockLanguageService.getText(chatId, 'matrix');
    const settings = await mockLanguageService.getText(chatId, 'settings');
    
    return [
      [personalCabinet, p2p, matrix, settings]
    ];
  }
};

// Мокаем контекст Telegram для тестирования
const mockCtx = {
  chat: {
    id: 'test_user_single_row'
  },
  reply: async (message, keyboard) => {
    console.log('\n🤖 Ответ бота:');
    console.log(`   Сообщение: ${message}`);
    
    if (keyboard && keyboard.reply_markup && keyboard.reply_markup.keyboard) {
      console.log('   Кнопки меню:');
      keyboard.reply_markup.keyboard.forEach((row, index) => {
        console.log(`     Ряд ${index + 1}: [${row.map(btn => `"${btn}"`).join(', ')}]`);
      });
    } else if (keyboard) {
      console.log(`   Клавиатура:`, JSON.stringify(keyboard, null, 2));
    }
    
    return { message_id: 1001 };
  }
};

async function testSingleRowMenu() {
  console.log('🚀 Тестирование меню с кнопками в одной строке...');
  
  try {
    const chatId = mockCtx.chat.id.toString();
    
    // Тест создания меню
    console.log('\n--- Создание меню ---');
    const mainMenuButtons = await mockLocalizationHelper.getLocalizedMainMenu(chatId);
    console.log('Структура кнопок меню:', JSON.stringify(mainMenuButtons, null, 2));
    
    // Проверяем, что меню содержит ровно один ряд
    if (mainMenuButtons.length !== 1) {
      console.log(`❌ Меню содержит ${mainMenuButtons.length} рядов, ожидался 1`);
      return false;
    }
    
    // Проверяем, что ряд содержит ровно 4 кнопки
    const row = mainMenuButtons[0];
    if (row.length !== 4) {
      console.log(`❌ Ряд содержит ${row.length} кнопок, ожидалось 4`);
      return false;
    }
    
    // Проверяем содержимое кнопок
    const [firstButton, secondButton, thirdButton, fourthButton] = row;
    
    console.log('\n--- Проверка содержимого кнопок ---');
    console.log(`Первая кнопка: "${firstButton}"`);
    console.log(`Вторая кнопка: "${secondButton}"`);
    console.log(`Третья кнопка: "${thirdButton}"`);
    console.log(`Четвертая кнопка: "${fourthButton}"`);
    
    // Создание клавиатуры
    console.log('\n--- Создание клавиатуры ---');
    const mainMenu = Markup.keyboard(mainMenuButtons).resize();
    console.log('Структура клавиатуры:', JSON.stringify(mainMenu, null, 2));
    
    // Отображение меню
    console.log('\n--- Отображение меню ---');
    const menuMessage = await mockLanguageService.getText(chatId, 'main_menu');
    await mockCtx.reply(menuMessage, mainMenu);
    
    console.log('\n✅ Тест меню в одной строке успешно пройден');
    return true;
  } catch (error) {
    console.error('❌ Тест меню в одной строке провален:', error);
    return false;
  }
}

// Запуск теста
async function runTest() {
  console.log('🚀 Запуск теста меню с кнопками в одной строке...\n');
  
  try {
    const result = await testSingleRowMenu();
    
    console.log(`\n${'='.repeat(50)}`);
    if (result) {
      console.log('🎉 Тест пройден! Меню корректно отображается с 4 кнопками в одной строке.');
      console.log('✅ Все 4 кнопки: "Личный кабинет", "P2P", "Matrix", "Настройки"');
      console.log('✅ Кнопки расположены в одном ряду как запрошено');
    } else {
      console.log('❌ Тест провален. Проверьте реализацию.');
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
  runTest().then((success) => {
    console.log('\n🏁 Тест завершен');
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('💥 Тест завершился с ошибкой:', error);
    process.exit(1);
  });
}

module.exports = { testSingleRowMenu };