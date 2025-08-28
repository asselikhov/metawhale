/**
 * Демонстрация мультивалютной P2P торговой системы
 * 
 * Показывает возможности новой системы:
 * - Работа с 10 фиатными валютами
 * - Автоматическая конвертация валют
 * - Мультивалютное отображение цен
 * - Резервирование средств в разных валютах
 */

const fiatCurrencyService = require('../src/services/fiatCurrencyService');
const fiatReserveService = require('../src/services/fiatReserveService');

class MultiCurrencyP2PDemo {
  async runDemo() {
    try {
      console.log('🌍 ДЕМОНСТРАЦИЯ МУЛЬТИВАЛЮТНОЙ P2P СИСТЕМЫ');
      console.log('='.repeat(70));
      
      // Демонстрация 1: Поддерживаемые валюты
      await this.demonstrateSupportedCurrencies();
      
      // Демонстрация 2: Курсы валют и конвертация
      await this.demonstrateExchangeRates();
      
      // Демонстрация 3: Форматирование валют
      await this.demonstrateCurrencyFormatting();
      
      // Демонстрация 4: Мультивалютные ордера
      await this.demonstrateMultiCurrencyOrders();
      
      // Демонстрация 5: Сценарии торговли
      await this.demonstrateTradingScenarios();
      
      console.log('\n🎉 ДЕМОНСТРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!');
      
    } catch (error) {
      console.error('❌ Ошибка демонстрации:', error);
    }
  }

  /**
   * Демонстрация поддерживаемых валют
   */
  async demonstrateSupportedCurrencies() {
    console.log('\n💰 ПОДДЕРЖИВАЕМЫЕ ВАЛЮТЫ');
    console.log('-'.repeat(40));
    
    const currencies = fiatCurrencyService.getSupportedCurrencies();
    
    console.log('📋 Список поддерживаемых валют:');
    currencies.forEach((currency, index) => {
      console.log(`  ${index + 1}. ${currency.flag} ${currency.code} - ${currency.nameRu}`);
      console.log(`     Символ: ${currency.symbol}, Десятичные знаки: ${currency.decimals}`);
    });
    
    console.log(`\n✅ Всего поддерживается: ${currencies.length} валют`);
  }

  /**
   * Демонстрация курсов валют и конвертации
   */
  async demonstrateExchangeRates() {
    console.log('\n💱 КУРСЫ ВАЛЮТ И КОНВЕРТАЦИЯ');
    console.log('-'.repeat(40));
    
    // Обновляем курсы
    console.log('🔄 Обновление курсов валют...');
    const updateResult = await fiatCurrencyService.updateAllExchangeRates();
    
    if (updateResult.success) {
      console.log(`✅ Обновлено курсов: ${updateResult.updatedCount}`);
    } else {
      console.log(`⚠️ Используются fallback курсы: ${updateResult.error}`);
    }
    
    // Показываем курсы основных валют к USD
    const majorCurrencies = ['RUB', 'EUR', 'CNY', 'JPY'];
    console.log('\n📊 Курсы валют к USD:');
    
    for (const currency of majorCurrencies) {
      try {
        const rate = await fiatCurrencyService.getExchangeRate('USD', currency);
        const metadata = fiatCurrencyService.getCurrencyMetadata(currency);
        console.log(`  ${metadata.flag} 1 USD = ${fiatCurrencyService.formatAmount(rate, currency)}`);
      } catch (error) {
        console.log(`  ${currency}: Ошибка получения курса`);
      }
    }
    
    // Демонстрация конвертации
    console.log('\n🔄 Примеры конвертации:');
    const conversionExamples = [
      { amount: 100, from: 'USD', to: 'RUB' },
      { amount: 100, from: 'EUR', to: 'USD' },
      { amount: 10000, from: 'JPY', to: 'USD' },
      { amount: 500, from: 'CNY', to: 'EUR' }
    ];
    
    for (const example of conversionExamples) {
      try {
        const converted = await fiatCurrencyService.convertAmount(example.amount, example.from, example.to);
        const fromFormatted = fiatCurrencyService.formatAmount(example.amount, example.from);
        const toFormatted = fiatCurrencyService.formatAmount(converted, example.to);
        console.log(`  ${fromFormatted} → ${toFormatted}`);
      } catch (error) {
        console.log(`  Ошибка конвертации ${example.from}/${example.to}`);
      }
    }
  }

  /**
   * Демонстрация форматирования валют
   */
  async demonstrateCurrencyFormatting() {
    console.log('\n🎨 ФОРМАТИРОВАНИЕ ВАЛЮТ');
    console.log('-'.repeat(40));
    
    const amounts = [0.99, 15.50, 1234.56, 999999.99];
    const currencies = ['USD', 'RUB', 'EUR', 'JPY', 'VND'];
    
    console.log('💰 Примеры форматирования разных сумм:');
    
    for (const amount of amounts) {
      console.log(`\n  Сумма: ${amount}`);
      for (const currency of currencies) {
        try {
          const formatted = fiatCurrencyService.formatAmount(amount, currency);
          const metadata = fiatCurrencyService.getCurrencyMetadata(currency);
          console.log(`    ${metadata.flag} ${currency}: ${formatted}`);
        } catch (error) {
          console.log(`    ${currency}: Ошибка форматирования`);
        }
      }
    }
    
    // Демонстрация мультивалютного отображения
    console.log('\n🌍 Мультивалютное отображение цен:');
    const baseAmount = 100;
    const baseCurrency = 'USD';
    
    try {
      const conversions = await fiatCurrencyService.getMultiCurrencyDisplay(
        baseAmount, 
        baseCurrency, 
        ['RUB', 'EUR', 'CNY', 'JPY']
      );
      
      console.log(`  Базовая цена: ${fiatCurrencyService.formatAmount(baseAmount, baseCurrency)}`);
      console.log('  Эквиваленты:');
      
      conversions.forEach(conversion => {
        console.log(`    ${conversion.flag} ${conversion.formatted}`);
      });
      
    } catch (error) {
      console.log('  Ошибка мультивалютного отображения');
    }
  }

  /**
   * Демонстрация мультивалютных ордеров
   */
  async demonstrateMultiCurrencyOrders() {
    console.log('\n📋 МУЛЬТИВАЛЮТНЫЕ P2P ОРДЕРА');
    console.log('-'.repeat(40));
    
    // Примеры ордеров в разных валютах
    const orderExamples = [
      {
        type: 'buy',
        amount: 100,
        pricePerToken: 15.50,
        currency: 'USD',
        description: 'Покупка CES за доллары'
      },
      {
        type: 'sell',
        amount: 50,
        pricePerToken: 1200,
        currency: 'RUB',
        description: 'Продажа CES за рубли'
      },
      {
        type: 'buy',
        amount: 200,
        pricePerToken: 13.20,
        currency: 'EUR',
        description: 'Покупка CES за евро'
      },
      {
        type: 'sell',
        amount: 75,
        pricePerToken: 110,
        currency: 'CNY',
        description: 'Продажа CES за юани'
      }
    ];
    
    console.log('📊 Примеры мультивалютных ордеров:');
    
    for (let i = 0; i < orderExamples.length; i++) {
      const order = orderExamples[i];
      const metadata = fiatCurrencyService.getCurrencyMetadata(order.currency);
      const totalValue = order.amount * order.pricePerToken;
      
      console.log(`\n  ${i + 1}. ${order.description}`);
      console.log(`     ${metadata.flag} ${order.type.toUpperCase()}: ${order.amount} CES`);
      console.log(`     Цена: ${fiatCurrencyService.formatAmount(order.pricePerToken, order.currency)} за токен`);
      console.log(`     Общая стоимость: ${fiatCurrencyService.formatAmount(totalValue, order.currency)}`);
      
      // Показываем USD эквиваленты
      try {
        const priceInUSD = await fiatCurrencyService.convertAmount(order.pricePerToken, order.currency, 'USD');
        const totalInUSD = await fiatCurrencyService.convertAmount(totalValue, order.currency, 'USD');
        
        console.log(`     USD эквивалент: $${priceInUSD.toFixed(4)} за токен ($${totalInUSD.toFixed(2)} общая)`);
      } catch (error) {
        console.log('     USD эквивалент: недоступен');
      }
    }
  }

  /**
   * Демонстрация торговых сценариев
   */
  async demonstrateTradingScenarios() {
    console.log('\n🤝 СЦЕНАРИИ МУЛЬТИВАЛЮТНОЙ ТОРГОВЛИ');
    console.log('-'.repeat(40));
    
    // Сценарий 1: Автоматический мэтчинг разных валют
    console.log('\n📈 Сценарий 1: Автоматический мэтчинг ордеров в разных валютах');
    
    const buyOrderUSD = {
      currency: 'USD',
      amount: 100,
      pricePerToken: 15.50
    };
    
    const sellOrderEUR = {
      currency: 'EUR',
      amount: 100,
      pricePerToken: 13.20
    };
    
    console.log('  Покупатель предлагает:');
    console.log(`    💰 ${buyOrderUSD.amount} CES по ${fiatCurrencyService.formatAmount(buyOrderUSD.pricePerToken, 'USD')} за токен`);
    
    console.log('  Продавец предлагает:');
    console.log(`    💰 ${sellOrderEUR.amount} CES по ${fiatCurrencyService.formatAmount(sellOrderEUR.pricePerToken, 'EUR')} за токен`);
    
    try {
      // Конвертируем цены в общую валюту (USD) для сравнения
      const buyPriceInUSD = buyOrderUSD.pricePerToken; // Уже в USD
      const sellPriceInUSD = await fiatCurrencyService.convertAmount(sellOrderEUR.pricePerToken, 'EUR', 'USD');
      
      console.log('\n  🔄 Нормализация цен в USD:');
      console.log(`    Покупатель готов платить: $${buyPriceInUSD.toFixed(4)} за токен`);
      console.log(`    Продавец требует: $${sellPriceInUSD.toFixed(4)} за токен`);
      
      if (buyPriceInUSD >= sellPriceInUSD) {
        const profit = buyPriceInUSD - sellPriceInUSD;
        console.log(`  ✅ МЭТЧИНГ ВОЗМОЖЕН! Спред: $${profit.toFixed(4)} в пользу продавца`);
        
        // Показываем итоговую сделку
        const tradePrice = sellPriceInUSD; // Используем цену продавца
        const tradePriceInEUR = await fiatCurrencyService.convertAmount(tradePrice, 'USD', 'EUR');
        
        console.log('\n  📋 Параметры сделки:');
        console.log(`    Количество: ${buyOrderUSD.amount} CES`);
        console.log(`    Цена: $${tradePrice.toFixed(4)} за токен (€${tradePriceInEUR.toFixed(4)})`);
        console.log(`    Покупатель платит: ${fiatCurrencyService.formatAmount(buyOrderUSD.amount * tradePrice, 'USD')}`);
        console.log(`    Продавец получает: ${fiatCurrencyService.formatAmount(sellOrderEUR.amount * tradePriceInEUR, 'EUR')}`);
        
      } else {
        const gap = sellPriceInUSD - buyPriceInUSD;
        console.log(`  ❌ Мэтчинг невозможен. Разрыв цен: $${gap.toFixed(4)}`);
      }
      
    } catch (error) {
      console.log('  ❌ Ошибка при анализе мэтчинга');
    }
    
    // Сценарий 2: Резервирование средств в разных валютах
    console.log('\n🏦 Сценарий 2: Резервирование средств в разных валютах');
    
    const reserveExamples = [
      { currency: 'USD', amount: 1500, description: 'Крупный долларовый ордер' },
      { currency: 'EUR', amount: 1200, description: 'Европейский трейдер' },
      { currency: 'RUB', amount: 120000, description: 'Российский пользователь' },
      { currency: 'CNY', amount: 10000, description: 'Китайский инвестор' }
    ];
    
    for (const example of reserveExamples) {
      console.log(`\n  ${example.description}:`);
      console.log(`    Валюта: ${fiatCurrencyService.getCurrencyMetadata(example.currency).flag} ${example.currency}`);
      console.log(`    Сумма: ${fiatCurrencyService.formatAmount(example.amount, example.currency)}`);
      
      try {
        const usdEquivalent = await fiatCurrencyService.convertAmount(example.amount, example.currency, 'USD');
        console.log(`    USD эквивалент: $${usdEquivalent.toFixed(2)}`);
        
        // Показываем приблизительное количество CES (при цене $15 за токен)
        const approximateCES = usdEquivalent / 15;
        console.log(`    Примерно CES: ${approximateCES.toFixed(2)} токенов`);
        
      } catch (error) {
        console.log('    USD эквивалент: недоступен');
      }
    }
    
    // Сценарий 3: Глобальная статистика
    console.log('\n📊 Сценарий 3: Глобальная аналитика мультивалютной торговли');
    
    try {
      const globalStats = await fiatReserveService.getGlobalStats();
      
      console.log('  💼 Статистика резервов по валютам:');
      if (globalStats.byCurrency && globalStats.byCurrency.length > 0) {
        globalStats.byCurrency.forEach(currencyStats => {
          const metadata = fiatCurrencyService.getCurrencyMetadata(currencyStats._id);
          console.log(`    ${metadata.flag} ${currencyStats._id}: $${currencyStats.totalAmountInUSD.toFixed(2)} USD эквивалент`);
        });
      } else {
        console.log('    (Пока нет данных - это демонстрация)');
      }
      
      console.log('\n  📈 Общая статистика:');
      console.log(`    Общий объем резервов: $${globalStats.totals.totalReservesInUSD.toFixed(2)}`);
      console.log(`    Количество резервов: ${globalStats.totals.totalReserves}`);
      console.log(`    Уникальных пользователей: ${globalStats.totals.uniqueUsers}`);
      
    } catch (error) {
      console.log('  📊 Статистика недоступна (тестовая среда)');
    }
  }
}

// Запуск демонстрации если скрипт вызван напрямую
if (require.main === module) {
  const demo = new MultiCurrencyP2PDemo();
  demo.runDemo()
    .then(() => {
      console.log('\n✅ Демонстрация завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Ошибка демонстрации:', error);
      process.exit(1);
    });
}

module.exports = MultiCurrencyP2PDemo;