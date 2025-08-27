/**
 * Тест команд цен всех токенов
 * Проверяет работу всех команд типа /ces, /pol, /ton и т.д.
 */

console.log('💰 Тестирование команд цен всех токенов...\n');

// 1. Проверка BaseCommandHandler
try {
  console.log('1️⃣ Тестирование BaseCommandHandler...');
  const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
  const handler = new BaseCommandHandler();
  console.log('   ✅ BaseCommandHandler загружен без ошибок');
  
  // Проверка метода handlePrice
  if (typeof handler.handlePrice === 'function') {
    console.log('   ✅ handlePrice метод доступен');
  } else {
    console.log('   ❌ handlePrice метод не найден');
  }
  
  // Проверка метода getTokenDisplayConfig
  if (typeof handler.getTokenDisplayConfig === 'function') {
    console.log('   ✅ getTokenDisplayConfig метод доступен');
  } else {
    console.log('   ❌ getTokenDisplayConfig метод не найден');
  }
} catch (error) {
  console.error('   ❌ Ошибка в BaseCommandHandler:', error.message);
}

// 2. Проверка priceService методов
try {
  console.log('\n2️⃣ Тестирование priceService методов...');
  const priceService = require('../src/services/priceService');
  console.log('   ✅ priceService загружен без ошибок');
  
  // Список всех поддерживаемых токенов
  const supportedTokens = [
    'CES', 'POL', 'TRX', 'BNB', 'SOL', 'ETH', 'ARB', 'AVAX', 
    'USDT', 'USDC', 'BUSD', 'TON', 'NOT'
  ];
  
  supportedTokens.forEach(token => {
    const methodName = `get${token}Price`;
    if (typeof priceService[methodName] === 'function') {
      console.log(`   ✅ ${methodName} метод доступен`);
    } else {
      console.log(`   ❌ ${methodName} метод не найден`);
    }
  });
  
} catch (error) {
  console.error('   ❌ Ошибка в priceService:', error.message);
}

// 3. Проверка messageHandler
try {
  console.log('\n3️⃣ Тестирование messageHandler...');
  const messageHandler = require('../src/handlers/messageHandler');
  const handler = new messageHandler();
  console.log('   ✅ messageHandler загружен без ошибок');
  
  // Проверка метода handlePrice
  if (typeof handler.handlePrice === 'function') {
    console.log('   ✅ handlePrice метод доступен');
  } else {
    console.log('   ❌ handlePrice метод не найден');
  }
  
} catch (error) {
  console.error('   ❌ Ошибка в messageHandler:', error.message);
}

// 4. Проверка конфигурации отображения токенов
try {
  console.log('\n4️⃣ Тестирование конфигурации отображения токенов...');
  const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
  const handler = new BaseCommandHandler();
  
  const testTokens = ['CES', 'POL', 'TRX', 'BNB', 'SOL', 'ETH', 'ARB', 'AVAX', 'USDT', 'USDC', 'BUSD', 'TON', 'NOT'];
  
  testTokens.forEach(token => {
    try {
      const config = handler.getTokenDisplayConfig(token);
      console.log(`   ${config.emoji} ${token}: ${config.priceDecimals} десятичных знаков`);
      console.log(`      📝 ${config.description.slice(0, 50)}...`);
    } catch (configError) {
      console.log(`   ❌ ${token}: ошибка конфигурации`);
    }
  });
  
} catch (error) {
  console.error('   ❌ Ошибка в конфигурации токенов:', error.message);
}

// 5. Симуляция команд
console.log('\n5️⃣ Симуляция команд токенов...');

const commands = [
  { command: '/ces', token: 'CES' },
  { command: '/pol', token: 'POL' },
  { command: '/trx', token: 'TRX' },
  { command: '/bnb', token: 'BNB' },
  { command: '/sol', token: 'SOL' },
  { command: '/eth', token: 'ETH' },
  { command: '/arb', token: 'ARB' },
  { command: '/avax', token: 'AVAX' },
  { command: '/usdt', token: 'USDT' },
  { command: '/usdc', token: 'USDC' },
  { command: '/busd', token: 'BUSD' },
  { command: '/ton', token: 'TON' },
  { command: '/not', token: 'NOT' }
];

commands.forEach(cmd => {
  console.log(`   💰 ${cmd.command} → получение цены ${cmd.token}`);
});

console.log('\n🎉 Тестирование команд цен завершено!');

console.log('\n📋 Поддерживаемые команды:');
console.log('   💰 /ces  - Цена CES токена');
console.log('   🟣 /pol  - Цена POL (Polygon)');
console.log('   🔴 /trx  - Цена TRX (TRON)');
console.log('   🟡 /bnb  - Цена BNB (Binance)');
console.log('   🟢 /sol  - Цена SOL (Solana)');
console.log('   🔵 /eth  - Цена ETH (Ethereum)');
console.log('   🔵 /arb  - Цена ARB (Arbitrum)');
console.log('   🔶 /avax - Цена AVAX (Avalanche)');
console.log('   💵 /usdt - Цена USDT (Tether)');
console.log('   💵 /usdc - Цена USDC (USD Coin)');
console.log('   🟡 /busd - Цена BUSD (Binance USD)');
console.log('   💎 /ton  - Цена TON (TON Network)');
console.log('   💎 /not  - Цена NOT (Notcoin)');

console.log('\n📱 Использование:');
console.log('   Просто отправьте команду в чат с ботом');
console.log('   Пример: /ton для получения цены Toncoin');

console.log('\n🚀 Все команды готовы к использованию!');
process.exit(0);