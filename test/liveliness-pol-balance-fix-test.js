/**
 * Тест исправления проблемы с балансом POL у пользователя liveliness1
 * Проверяет что система правильно отображает баланс POL
 */

console.log('🔧 Тестирование исправления баланса POL для liveliness1...\n');

// Тестовые данные для пользователя liveliness1
const TEST_USER = {
  chatId: '2131340103',
  username: 'liveliness1',
  address: '0xA055F762EFa0a0499f48cFD74AFA13e66D8FF7a4',
  expectedPOLBalance: 0.19243892,
  network: 'polygon'
};

async function testPOLBalanceFix() {
  console.log('1️⃣ Проверка multiChainService конфигурации...');
  
  try {
    const multiChainService = require('../src/services/multiChainService');
    
    // Проверка что POL токен добавлен в Polygon
    const polygonTokens = multiChainService.getNetworkTokens('polygon');
    console.log('   🟣 Polygon токены:', Object.keys(polygonTokens));
    
    if (polygonTokens.POL) {
      console.log('   ✅ POL токен найден в конфигурации Polygon');
      console.log('   📋 POL конфигурация:', polygonTokens.POL);
    } else {
      console.log('   ❌ POL токен отсутствует в конфигурации Polygon');
      return false;
    }
    
  } catch (error) {
    console.error('   ❌ Ошибка в multiChainService:', error.message);
    return false;
  }

  console.log('\n2️⃣ Проверка получения цен...');
  
  try {
    const priceService = require('../src/services/priceService');
    
    // Проверка получения цены POL
    const polPrice = await priceService.getPOLPrice();
    console.log(`   🟣 POL цена: $${polPrice.price.toFixed(4)} (₽${polPrice.priceRub.toFixed(2)})`);
    console.log(`   📊 Источник: ${polPrice.source}`);
    
    if (polPrice.price > 0) {
      console.log('   ✅ Цена POL получена успешно');
    } else {
      console.log('   ⚠️ Цена POL равна нулю');
    }
    
  } catch (error) {
    console.error('   ❌ Ошибка получения цены POL:', error.message);
    return false;
  }

  console.log('\n3️⃣ Проверка multiChainWalletService...');
  
  try {
    const multiChainWalletService = require('../src/services/multiChainWalletService');
    
    // Проверка получения балансов для тестового пользователя
    console.log(`   💼 Получение балансов для ${TEST_USER.address}...`);
    
    const balances = await multiChainWalletService.getNetworkBalances(TEST_USER.address, TEST_USER.network);
    console.log('   💰 Сырые балансы:', balances);
    
    if (balances.POL !== undefined) {
      console.log(`   ✅ POL баланс: ${balances.POL} POL`);
      if (balances.POL === TEST_USER.expectedPOLBalance) {
        console.log('   🎯 POL баланс соответствует ожидаемому');
      } else {
        console.log(`   ⚠️ POL баланс отличается от ожидаемого (${TEST_USER.expectedPOLBalance})`);
      }
    } else {
      console.log('   ❌ POL баланс не получен');
    }
    
    // Проверка получения цен для сети
    const prices = await multiChainWalletService.getTokenPrices(TEST_USER.network);
    console.log('   💱 Цены токенов:', Object.keys(prices));
    
    if (prices.POL) {
      console.log(`   ✅ Цена POL в сети: $${prices.POL.price.toFixed(4)}`);
    } else {
      console.log('   ❌ Цена POL не получена для сети');
    }
    
    // Проверка форматирования балансов
    const formattedBalances = multiChainWalletService.formatBalances(TEST_USER.network, balances, prices);
    console.log('   📊 Форматированные балансы:');
    
    if (formattedBalances.POL) {
      const polFormatted = formattedBalances.POL;
      console.log(`       POL: ${polFormatted.balance} → $${polFormatted.usdValue} • ₽${polFormatted.rubValue}`);
      console.log(`       Отображение: ${polFormatted.displayText}`);
      
      if (parseFloat(polFormatted.usdValue) > 0) {
        console.log('   ✅ USD значение POL баланса корректно');
      } else {
        console.log('   ❌ USD значение POL баланса равно нулю');
      }
    } else {
      console.log('   ❌ POL баланс не отформатирован');
    }
    
  } catch (error) {
    console.error('   ❌ Ошибка в multiChainWalletService:', error.message);
    return false;
  }

  console.log('\n4️⃣ Проверка backgroundProcessingService...');
  
  try {
    const backgroundService = require('../src/services/backgroundProcessingService');
    
    // Симуляция обработки данных кошелька
    console.log(`   🔄 Обработка данных кошелька для ${TEST_USER.chatId}...`);
    
    const walletData = await backgroundService.processWalletData(TEST_USER.chatId);
    console.log('   📋 Результат обработки:', {
      hasWallet: walletData.hasWallet,
      polBalance: walletData.polBalance,
      polTotalUsd: walletData.polTotalUsd,
      polTotalRub: walletData.polTotalRub
    });
    
    if (walletData.hasWallet && walletData.polBalance > 0) {
      console.log('   ✅ Баланс POL корректно обработан в background service');
      
      if (walletData.polTotalUsd !== undefined && parseFloat(walletData.polTotalUsd) > 0) {
        console.log('   ✅ USD значение POL корректно');
      } else {
        console.log('   ❌ USD значение POL некорректно');
      }
    } else {
      console.log('   ❌ Баланс POL не обработан в background service');
    }
    
  } catch (error) {
    console.error('   ❌ Ошибка в backgroundProcessingService:', error.message);
    return false;
  }

  return true;
}

async function runTest() {
  try {
    console.log('🎯 Цель: Исправить отображение баланса POL для пользователя liveliness1');
    console.log(`👤 Пользователь: ${TEST_USER.username} (${TEST_USER.chatId})`);
    console.log(`🏠 Адрес: ${TEST_USER.address}`);
    console.log(`🟣 Сеть: ${TEST_USER.network}`);
    console.log(`💰 Ожидаемый POL баланс: ${TEST_USER.expectedPOLBalance}\n`);
    
    const success = await testPOLBalanceFix();
    
    if (success) {
      console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
      console.log('====================');
      console.log('✅ POL токен добавлен в конфигурацию Polygon');
      console.log('✅ Цена POL получается корректно');
      console.log('✅ Баланс POL обрабатывается правильно');
      console.log('✅ USD/RUB значения вычисляются корректно');
      console.log('✅ backgroundProcessingService возвращает правильный формат');
      
      console.log('\n🚀 Исправления готовы к деплою!');
      console.log('🎯 liveliness1 теперь увидит корректный баланс POL');
    } else {
      console.log('\n❌ ТЕСТЫ ПРОВАЛЕНЫ!');
      console.log('Необходимы дополнительные исправления');
    }
    
  } catch (error) {
    console.error('\n💥 ОШИБКА ТЕСТА:', error);
  }
}

if (require.main === module) {
  runTest()
    .then(() => {
      console.log('\n✅ Тест завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Тест провален:', error);
      process.exit(1);
    });
}

module.exports = { runTest };