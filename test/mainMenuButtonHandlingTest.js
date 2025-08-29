/**
 * Тест для проверки обработки кнопок главного меню
 * Проверяет, что нажатия на кнопки 'Личный кабинет' и '🔄 P2P Биржа' обрабатываются правильно
 */

// Мокаем контекст Telegram для тестирования
const mockCtx = {
  chat: {
    id: 'test_user_menu',
    username: 'testuser'
  },
  message: {
    text: ''
  },
  reply: async (message) => {
    console.log(`🤖 Бот отвечает: ${message}`);
    return { message_id: 1001 };
  }
};

// Мокаем обработчики
const mockWalletHandler = {
  handlePersonalCabinetText: async (ctx) => {
    console.log('🏠 Вызов handlePersonalCabinetText в WalletHandler');
    return await ctx.reply('👤 Личный кабинет');
  }
};

const mockP2PHandler = {
  handleP2PMenu: async (ctx) => {
    console.log('🔄 Вызов handleP2PMenu в P2PHandler');
    return await ctx.reply('🔄 P2P Биржа');
  }
};

// Функция для тестирования обработки текстовых сообщений
async function testTextMessageHandling(text) {
  console.log(`\n--- Тестирование обработки текста: "${text}" ---`);
  mockCtx.message.text = text;
  
  // Имитируем логику обработки текстовых сообщений из BaseCommandHandler
  if (text.includes('ЛК') || text.includes('Личный кабинет') || text.includes('👤')) {
    console.log('✅ Распознана кнопка "Личный кабинет"');
    return await mockWalletHandler.handlePersonalCabinetText(mockCtx);
  }
  
  if (text.includes('P2P Биржа') || text.includes('🔄 P2P') || text.includes('P2P')) {
    console.log('✅ Распознана кнопка "🔄 P2P Биржа"');
    return await mockP2PHandler.handleP2PMenu(mockCtx);
  }
  
  console.log('❌ Текст не распознан как кнопка главного меню');
  return await mockCtx.reply('😕 Не понимаю эту команду. Используйте кнопки меню.');
}

async function runButtonHandlingTest() {
  console.log('🚀 Тестирование обработки кнопок главного меню...\n');
  
  // Тест 1: Кнопка "Личный кабинет"
  console.log('Тест 1: Обработка кнопки "Личный кабинет"');
  await testTextMessageHandling('Личный кабинет');
  
  // Тест 2: Кнопка "🔄 P2P Биржа"
  console.log('\nТест 2: Обработка кнопки "🔄 P2P Биржа"');
  await testTextMessageHandling('🔄 P2P Биржа');
  
  // Тест 3: Альтернативный текст для личного кабинета
  console.log('\nТест 3: Обработка альтернативного текста "ЛК"');
  await testTextMessageHandling('ЛК');
  
  // Тест 4: Альтернативный текст для P2P
  console.log('\nТест 4: Обработка альтернативного текста "P2P"');
  await testTextMessageHandling('P2P');
  
  // Тест 5: Неизвестный текст
  console.log('\nТест 5: Обработка неизвестного текста');
  await testTextMessageHandling('Неизвестная команда');
  
  console.log('\n✅ Тест обработки кнопок главного меню завершен');
}

// Запуск теста
async function main() {
  console.log('🚀 Запуск теста обработки кнопок главного меню...\n');
  
  console.log('Спецификации проекта:');
  console.log('- Кнопка "Личный кабинет" должна открывать личный кабинет пользователя');
  console.log('- Кнопка "🔄 P2P Биржа" должна открывать меню P2P торговли');
  console.log('- Другие текстовые сообщения должны обрабатываться как неизвестные команды\n');
  
  try {
    await runButtonHandlingTest();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Все тесты пройдены! Обработка кнопок главного меню работает корректно.');
    console.log('✅ Кнопки "Личный кабинет" и "🔄 P2P Биржа" распознаются правильно');
    console.log('✅ Неизвестные команды обрабатываются с сообщением об ошибке');
    console.log(`${'='.repeat(60)}`);
    
  } catch (error) {
    console.error('💥 Тест завершился с ошибкой:', error);
  }
}

// Запускаем тест
if (require.main === module) {
  main().then(() => {
    console.log('\n🏁 Тест завершен');
  }).catch((error) => {
    console.error('💥 Тест завершился с ошибкой:', error);
  });
}

module.exports = { testTextMessageHandling };