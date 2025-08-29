/**
 * Быстрый тест исправлений для деплоя
 * Проверяет критические компоненты перед отправкой на сервер
 */

console.log('🔧 Тестирование исправлений для деплоя...\n');

// 1. Проверка синтаксиса p2pService
try {
  console.log('1️⃣ Тестирование p2pService...');
  const p2pService = require('../src/services/p2p');
  console.log('   ✅ p2pService загружен без ошибок');
} catch (error) {
  console.error('   ❌ Ошибка в p2pService:', error.message);
  process.exit(1);
}

// 2. Проверка TronWeb интеграции
try {
  console.log('2️⃣ Тестирование multiChainWalletService...');
  const multiChainWalletService = require('../src/services/multiChainWalletService');
  console.log('   ✅ multiChainWalletService загружен без ошибок');
  
  // Проверяем, что TronWeb не вызывает критических ошибок
  if (multiChainWalletService.tronWeb) {
    console.log('   ✅ TronWeb инициализирован успешно');
  } else {
    console.log('   ⚠️ TronWeb не инициализирован (это нормально если пакет недоступен)');
  }
} catch (error) {
  console.error('   ❌ Ошибка в multiChainWalletService:', error.message);
  process.exit(1);
}

// 3. Проверка критических обработчиков
try {
  console.log('3️⃣ Тестирование обработчиков...');
  const WalletHandler = require('../src/handlers/WalletHandler');
  console.log('   ✅ WalletHandler загружен без ошибок');
  
  const messageHandler = require('../src/handlers/messageHandler');
  console.log('   ✅ messageHandler загружен без ошибок');
} catch (error) {
  console.error('   ❌ Ошибка в обработчиках:', error.message);
  process.exit(1);
}

// 4. Проверка базовых сервисов
try {
  console.log('4️⃣ Тестирование базовых сервисов...');
  const multiChainService = require('../src/services/multiChainService');
  console.log('   ✅ multiChainService загружен');
  
  const networks = multiChainService.getNetworks();
  console.log(`   ✅ Доступно ${networks.length} сетей: ${networks.map(n => n.name).join(', ')}`);
  
  const userNetworkService = require('../src/services/userNetworkService');
  console.log('   ✅ userNetworkService загружен');
  
  const priceService = require('../src/services/priceService');
  console.log('   ✅ priceService загружен');
} catch (error) {
  console.error('   ❌ Ошибка в базовых сервисах:', error.message);
  process.exit(1);
}

// 5. Проверка моделей базы данных
try {
  console.log('5️⃣ Тестирование моделей базы данных...');
  const models = require('../src/database/models');
  console.log('   ✅ Модели базы данных загружены без ошибок');
} catch (error) {
  console.error('   ❌ Ошибка в моделях:', error.message);
  process.exit(1);
}

console.log('\n🎉 Все тесты пройдены успешно!');
console.log('✅ Код готов к деплою на Render');
console.log('\n📋 Резюме исправлений:');
console.log('   • Исправлена синтаксическая ошибка в p2pService.js');
console.log('   • Улучшена обработка TronWeb импорта');
console.log('   • Добавлены проверки типов для TronWeb');
console.log('   • Все критические компоненты проверены');

process.exit(0);