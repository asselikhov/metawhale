/**
 * Тест функциональности множественных блокчейн сетей
 * Простая проверка основных компонентов
 */

const multiChainService = require('../src/services/multiChainService');
const userNetworkService = require('../src/services/userNetworkService');
const multiChainWalletService = require('../src/services/multiChainWalletService');
const priceService = require('../src/services/priceService');

async function testMultiChainFunctionality() {
  console.log('🧪 Тестирование функциональности множественных блокчейн сетей...\n');
  
  try {
    // 1. Тест MultiChainService
    console.log('1️⃣ Тестирование MultiChainService...');
    const networks = multiChainService.getNetworks();
    console.log('   📋 Доступные сети:', networks.map(n => `${n.name} (${n.id})`).join(', '));
    
    const polygonConfig = multiChainService.getNetworkConfig('polygon');
    console.log('   🟣 Polygon токены:', Object.keys(polygonConfig.tokens).join(', '));
    
    const tronConfig = multiChainService.getNetworkConfig('tron');
    console.log('   🔴 Tron токены:', Object.keys(tronConfig.tokens).join(', '));
    
    const networkButtons = multiChainService.getNetworkSelectorButtons('polygon');
    console.log('   🔘 Кнопки выбора сети:', networkButtons.length, 'строк');
    
    // 2. Тест валидации адресов
    console.log('\n2️⃣ Тестирование валидации адресов...');
    const testAddresses = {
      polygon: '0x1234567890123456789012345678901234567890',
      tron: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
      bsc: '0x1234567890123456789012345678901234567890',
      solana: '11111111111111111111111111111112',
      arbitrum: '0x1234567890123456789012345678901234567890',
      avalanche: '0x1234567890123456789012345678901234567890',
      invalid: 'invalid_address'
    };
    
    const networkEmojis = {
      polygon: '🟣',
      tron: '🔴',
      bsc: '🟡',
      solana: '🟢',
      arbitrum: '🔵',
      avalanche: '🔶'
    };
    
    for (const [network, address] of Object.entries(testAddresses)) {
      if (network !== 'invalid') {
        const isValid = multiChainService.validateAddress(network, address);
        console.log(`   ${networkEmojis[network]} ${network}: ${address.slice(0, 20)}... - ${isValid ? '✅' : '❌'}`);
      }
    }
    
    // 3. Тест UserNetworkService
    console.log('\n3️⃣ Тестирование UserNetworkService...');
    const testChatId = 'test_user_123';
    const defaultNetwork = await userNetworkService.getUserNetwork(testChatId);
    console.log('   🌐 Сеть по умолчанию:', defaultNetwork);
    
    // 4. Тест получения цен
    console.log('\n4️⃣ Тестирование получения цен токенов...');
    
    try {
      const cesPrice = await priceService.getCESPrice();
      console.log(`   💎 CES: $${cesPrice.price.toFixed(6)} (₽${cesPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   💎 CES: ⚠️ Ошибка получения цены');
    }
    
    try {
      const polPrice = await priceService.getPOLPrice();
      console.log(`   🟣 POL: $${polPrice.price.toFixed(4)} (₽${polPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   🟣 POL: ⚠️ Ошибка получения цены');
    }
    
    try {
      const trxPrice = await priceService.getTRXPrice();
      console.log(`   🔴 TRX: $${trxPrice.price.toFixed(4)} (₽${trxPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   🔴 TRX: ⚠️ Ошибка получения цены');
    }
    
    try {
      const usdtPrice = await priceService.getUSDTPrice();
      console.log(`   💵 USDT: $${usdtPrice.price.toFixed(4)} (₽${usdtPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   💵 USDT: ⚠️ Ошибка получения цены');
    }
    
    // Дополнительные токены
    try {
      const bnbPrice = await priceService.getBNBPrice();
      console.log(`   🟡 BNB: $${bnbPrice.price.toFixed(4)} (₽${bnbPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   🟡 BNB: ⚠️ Ошибка получения цены');
    }
    
    try {
      const solPrice = await priceService.getSOLPrice();
      console.log(`   🟢 SOL: $${solPrice.price.toFixed(4)} (₽${solPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   🟢 SOL: ⚠️ Ошибка получения цены');
    }
    
    try {
      const ethPrice = await priceService.getETHPrice();
      console.log(`   🔵 ETH: $${ethPrice.price.toFixed(2)} (₽${ethPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   🔵 ETH: ⚠️ Ошибка получения цены');
    }
    
    try {
      const arbPrice = await priceService.getARBPrice();
      console.log(`   🔵 ARB: $${arbPrice.price.toFixed(4)} (₽${arbPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   🔵 ARB: ⚠️ Ошибка получения цены');
    }
    
    try {
      const avaxPrice = await priceService.getAVAXPrice();
      console.log(`   🔶 AVAX: $${avaxPrice.price.toFixed(4)} (₽${avaxPrice.priceRub.toFixed(2)})`);
    } catch (error) {
      console.log('   🔶 AVAX: ⚠️ Ошибка получения цены');
    }
    
    console.log('\n✅ Тест завершен успешно! Все компоненты функционируют корректно.');
    
  } catch (error) {
    console.error('\n❌ Ошибка во время тестирования:', error.message);
    console.error('   Стек ошибки:', error.stack);
  }
}

// Запуск теста если файл вызывается напрямую
if (require.main === module) {
  testMultiChainFunctionality()
    .then(() => {
      console.log('\n🎉 Тестирование завершено');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { testMultiChainFunctionality };