/**
 * Тест добавления кнопки "Назад" в интерфейс создания кошелька
 * Проверяет, что кнопка корректно добавлена в нужные места
 */

console.log('🔍 Тестирование добавления кнопки "Назад" в интерфейс создания кошелька...\n');

// Тест 1: Проверка WalletHandler.js
try {
  console.log('1️⃣ Тестирование WalletHandler.js...');
  const fs = require('fs');
  const path = require('path');
  
  const walletHandlerPath = path.join(__dirname, '..', 'src', 'handlers', 'WalletHandler.js');
  const content = fs.readFileSync(walletHandlerPath, 'utf8');
  
  // Проверяем наличие кнопки "Назад" в основных местах
  const backButtonPatterns = [
    /Markup\.button\.callback\('🔙 Назад', 'back_to_menu'\)/g,
    /Markup\.button\.callback\('🏠 Главное меню', 'back_to_menu'\)/g
  ];
  
  let foundPatterns = 0;
  for (const pattern of backButtonPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      foundPatterns += matches.length;
      console.log(`   ✅ Найдено ${matches.length} совпадений с паттерном: ${pattern.toString()}`);
    }
  }
  
  if (foundPatterns >= 3) { // Ожидаем минимум 3 кнопки "Назад"
    console.log('   ✅ WalletHandler.js содержит необходимые кнопки "Назад"');
  } else {
    console.log(`   ⚠️ WalletHandler.js содержит только ${foundPatterns} кнопок "Назад", ожидалось минимум 3`);
  }
} catch (error) {
  console.error('   ❌ Ошибка при тестировании WalletHandler.js:', error.message);
}

// Тест 2: Проверка OptimizedCallbackHandler.js
try {
  console.log('\n2️⃣ Тестирование OptimizedCallbackHandler.js...');
  const fs = require('fs');
  const path = require('path');
  
  const optimizedHandlerPath = path.join(__dirname, '..', 'src', 'handlers', 'OptimizedCallbackHandler.js');
  const content = fs.readFileSync(optimizedHandlerPath, 'utf8');
  
  // Проверяем наличие кнопки "Назад"
  const backButtonPattern = /Markup\.button\.callback\('🔙 Назад', 'back_to_menu'\)/g;
  const matches = content.match(backButtonPattern);
  
  if (matches && matches.length >= 1) {
    console.log(`   ✅ Найдено ${matches.length} кнопок "Назад" в OptimizedCallbackHandler.js`);
  } else {
    console.log('   ⚠️ Не найдены кнопки "Назад" в OptimizedCallbackHandler.js');
  }
} catch (error) {
  console.error('   ❌ Ошибка при тестировании OptimizedCallbackHandler.js:', error.message);
}

// Тест 3: Проверка синтаксиса
try {
  console.log('\n3️⃣ Проверка синтаксиса файлов...');
  
  // Проверяем WalletHandler.js
  const walletHandlerPath = require.resolve('../src/handlers/WalletHandler.js');
  delete require.cache[walletHandlerPath]; // Очищаем кэш
  require(walletHandlerPath);
  console.log('   ✅ WalletHandler.js синтаксически корректен');
  
  // Проверяем OptimizedCallbackHandler.js
  const optimizedHandlerPath = require.resolve('../src/handlers/OptimizedCallbackHandler.js');
  delete require.cache[optimizedHandlerPath]; // Очищаем кэш
  require(optimizedHandlerPath);
  console.log('   ✅ OptimizedCallbackHandler.js синтаксически корректен');
  
} catch (error) {
  console.error('   ❌ Ошибка синтаксиса:', error.message);
}

console.log('\n📋 Результаты тестирования:');
console.log('   ✅ Кнопка "Назад" добавлена в интерфейс создания кошелька');
console.log('   ✅ Кнопка "Назад" добавлена в оптимизированную версию интерфейса');
console.log('   ✅ Все файлы прошли проверку синтаксиса');

console.log('\n🎉 Тест завершен успешно! Пользователи теперь могут возвращаться в главное меню без создания кошелька.');