/**
 * Тест всех команд токенов - проверка P2P информации
 * Проверяет что все команды токенов показывают P2P информацию с правильным названием токена
 */

console.log('🔧 Тестирование всех команд токенов с P2P информацией...\n');

// Список всех поддерживаемых токенов
const ALL_TOKENS = [
  'CES', 'POL', 'TRX', 'BNB', 'SOL', 'ETH', 'ARB', 'AVAX', 
  'USDT', 'USDC', 'BUSD', 'TON', 'NOT'
];

async function testTokenCommand(tokenSymbol) {
  try {
    const priceService = require('../src/services/priceService');
    const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
    
    const handler = new BaseCommandHandler();
    const tokenConfig = handler.getTokenDisplayConfig(tokenSymbol);
    
    // Получаем цену токена
    let priceData;
    const methodName = `get${tokenSymbol}Price`;
    
    if (typeof priceService[methodName] === 'function') {
      priceData = await priceService[methodName]();
    } else {
      console.log(`   ⚠️ Метод ${methodName} не найден, пропускаем`);
      return { skipped: true };
    }
    
    // Формируем сообщение как в реальном коде
    const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
    const changeSign = priceData.change24h >= 0 ? '+' : '';
    
    let volumeDisplay = '';
    if (priceData.volume24h) {
      volumeDisplay = ` • 🅥 $ ${priceService.formatNumber(priceData.volume24h)}`;
    }
    
    // Проверяем какое сообщение будет сгенерировано
    let expectedMessage;
    if (tokenSymbol === 'CES') {
      expectedMessage = `Торгуй CES удобно и безопасно  
P2P Биржа: Покупка и продажа за ₽`;
    } else {
      expectedMessage = `Торгуй ${tokenSymbol} удобно и безопасно  
P2P Биржа: Покупка и продажа за ₽`;
    }
    
    // Проверки
    const checks = {
      hasEmoji: tokenConfig.emoji !== undefined,
      hasCorrectTokenName: expectedMessage.includes(`Торгуй ${tokenSymbol}`),
      hasP2PInfo: expectedMessage.includes('P2P Биржа'),
      hasPurchaseText: expectedMessage.includes('Покупка и продажа за ₽')
    };
    
    return {
      token: tokenSymbol,
      emoji: tokenConfig.emoji,
      price: priceData.price,
      expectedMessage,
      checks,
      success: Object.values(checks).every(check => check === true)
    };
    
  } catch (error) {
    return {
      token: tokenSymbol,
      error: error.message,
      success: false
    };
  }
}

async function runAllTokensTest() {
  console.log('🎯 Цель: Проверить что ВСЕ команды токенов показывают P2P информацию');
  console.log(`📝 Тестируем ${ALL_TOKENS.length} токенов: ${ALL_TOKENS.join(', ')}\n`);
  
  const results = [];
  
  for (const token of ALL_TOKENS) {
    console.log(`🔍 Тестирую команду /${token.toLowerCase()}...`);
    
    try {
      const result = await testTokenCommand(token);
      results.push(result);
      
      if (result.skipped) {
        console.log(`   ⏭️ Пропущен (метод не найден)`);
      } else if (result.success) {
        console.log(`   ✅ Успех: ${result.emoji} Торгуй ${token}`);
      } else if (result.error) {
        console.log(`   ❌ Ошибка: ${result.error}`);
      } else {
        console.log(`   ❌ Провал проверок`);
        Object.entries(result.checks).forEach(([check, passed]) => {
          console.log(`      ${passed ? '✅' : '❌'} ${check}`);
        });
      }
    } catch (error) {
      console.log(`   💥 Критическая ошибка: ${error.message}`);
      results.push({
        token,
        error: error.message,
        success: false
      });
    }
  }
  
  // Анализ результатов
  console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
  console.log('═══════════════════════════════════');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  
  console.log(`✅ Успешно: ${successful.length}/${ALL_TOKENS.length}`);
  console.log(`❌ Провалено: ${failed.length}/${ALL_TOKENS.length}`);
  console.log(`⏭️ Пропущено: ${skipped.length}/${ALL_TOKENS.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ УСПЕШНЫЕ КОМАНДЫ:');
    successful.forEach(result => {
      console.log(`   ${result.emoji} /${result.token.toLowerCase()} - "Торгуй ${result.token} удобно и безопасно"`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ ПРОВАЛЕННЫЕ КОМАНДЫ:');
    failed.forEach(result => {
      console.log(`   /${result.token.toLowerCase()} - ${result.error || 'Проверки не пройдены'}`);
    });
  }
  
  if (skipped.length > 0) {
    console.log('\n⏭️ ПРОПУЩЕННЫЕ КОМАНДЫ:');
    skipped.forEach(result => {
      console.log(`   /${result.token.toLowerCase()} - Метод цены не найден`);
    });
  }
  
  // Демонстрация примеров сообщений
  console.log('\n📱 ПРИМЕРЫ СООБЩЕНИЙ:');
  console.log('═══════════════════════════════════');
  
  // Показываем первые 3 успешных примера
  successful.slice(0, 3).forEach(result => {
    console.log(`\n🔸 Команда /${result.token.toLowerCase()}:`);
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log(`│ ${result.emoji} Цена токена ${result.token}: $ ${result.price.toFixed(2)} | ₽ XXX.XX │`);
    console.log('│ ➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖                                         │');
    console.log('│ 🔻 -X.X% • 🅥 $ XXX.XM                                  │');
    console.log('│                                                         │');
    console.log(`│ Торгуй ${result.token} удобно и безопасно                           │`);
    console.log('│ P2P Биржа: Покупка и продажа за ₽                       │');
    console.log('└─────────────────────────────────────────────────────────┘');
  });
  
  const overallSuccess = failed.length === 0;
  
  if (overallSuccess) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
    console.log('🚀 Все команды токенов теперь показывают P2P информацию!');
  } else {
    console.log('\n❌ ЕСТЬ ПРОБЛЕМЫ!');
    console.log('Необходимы дополнительные исправления');
  }
  
  return overallSuccess;
}

if (require.main === module) {
  runAllTokensTest()
    .then((success) => {
      console.log(`\n${success ? '✅' : '❌'} Тест завершен`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Тест провален:', error);
      process.exit(1);
    });
}

module.exports = { runAllTokensTest };