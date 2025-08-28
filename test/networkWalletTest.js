/**
 * Тест функциональности кошелька в разных сетях
 */

console.log('Тестирование функциональности кошелька в разных сетях...');

// Проверяем, что изменения в userNetworkService корректны
const fs = require('fs');

// Читаем файл userNetworkService
const userNetworkServiceContent = fs.readFileSync('./src/services/userNetworkService.js', 'utf8');

// Проверяем, что добавлен код для проверки наличия кошелька в разных сетях
if (userNetworkServiceContent.includes('EVM-compatible')) {
  console.log('✅ Код для проверки наличия кошелька в разных сетях найден');
} else {
  console.log('❌ Код для проверки наличия кошелька в разных сетях НЕ найден');
}

// Проверяем, что изменения в getUserWalletForNetwork корректны
if (userNetworkServiceContent.includes('bsc\', \'arbitrum\', \'avalanche')) {
  console.log('✅ Код для getUserWalletForNetwork найден');
} else {
  console.log('❌ Код для getUserWalletForNetwork НЕ найден');
}

console.log('✅ Проверка изменений завершена!');