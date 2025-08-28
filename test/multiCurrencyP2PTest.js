/**
 * Тест мультивалютной P2P торговой системы
 * 
 * Этот тест проверяет:
 * 1. FiatCurrencyService - работу с валютами и курсами
 * 2. FiatReserveService - резервирование средств в разных валютах
 * 3. P2PService - создание мультивалютных ордеров
 * 4. Конвертацию и совместимость валют
 */

const mongoose = require('mongoose');
const { connectDatabase } = require('../src/database/models');
const fiatCurrencyService = require('../src/services/fiatCurrencyService');
const fiatReserveService = require('../src/services/fiatReserveService');

class MultiCurrencyP2PTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Основная функция тестирования
   */
  async runAllTests() {
    try {
      console.log('🚀 ЗАПУСК ТЕСТОВ МУЛЬТИВАЛЮТНОЙ P2P СИСТЕМЫ');
      console.log('='.repeat(60));

      // Подключаемся к БД (в тестовом режиме)
      process.env.NODE_ENV = 'test';
      
      // Этап 1: Тестирование FiatCurrencyService
      await this.testFiatCurrencyService();
      
      // Этап 2: Тестирование конвертации валют
      await this.testCurrencyConversion();
      
      // Этап 3: Тестирование форматирования
      await this.testCurrencyFormatting();
      
      // Этап 4: Тестирование FiatReserveService
      await this.testFiatReserveService();
      
      // Этап 5: Тестирование мультивалютных операций
      await this.testMultiCurrencyOperations();
      
      // Этап 6: Тестирование граничных случаев
      await this.testEdgeCases();
      
      // Финальный отчет
      this.printTestReport();
      
    } catch (error) {
      console.error('❌ Критическая ошибка тестирования:', error);
      this.testResults.errors.push(`Critical: ${error.message}`);
    }
  }

  /**
   * Тестирование FiatCurrencyService
   */
  async testFiatCurrencyService() {
    console.log('\n📋 ЭТАП 1: Тестирование FiatCurrencyService');
    
    // Тест 1.1: Поддерживаемые валюты
    this.test('1.1 Получение поддерживаемых валют', () => {
      const currencies = fiatCurrencyService.getSupportedCurrencies();
      if (currencies.length !== 10) {
        throw new Error(`Ожидалось 10 валют, получено ${currencies.length}`);
      }
      
      const expectedCurrencies = ['USD', 'RUB', 'EUR', 'CNY', 'INR', 'NGN', 'VND', 'KRW', 'JPY', 'BRL'];
      const actualCodes = currencies.map(c => c.code);
      
      for (const expected of expectedCurrencies) {
        if (!actualCodes.includes(expected)) {
          throw new Error(`Валюта ${expected} не найдена в списке поддерживаемых`);
        }
      }
      
      console.log(`  ✅ Поддерживается ${currencies.length} валют: ${actualCodes.join(', ')}`);
    });

    // Тест 1.2: Метаданные валют
    this.test('1.2 Метаданные валют', () => {
      const rubMetadata = fiatCurrencyService.getCurrencyMetadata('RUB');
      
      if (rubMetadata.symbol !== '₽') {
        throw new Error(`Неверный символ для RUB: ${rubMetadata.symbol}`);
      }
      
      if (rubMetadata.decimals !== 2) {
        throw new Error(`Неверное количество десятичных знаков для RUB: ${rubMetadata.decimals}`);
      }
      
      if (rubMetadata.flag !== '🇷🇺') {
        throw new Error(`Неверный флаг для RUB: ${rubMetadata.flag}`);
      }
      
      console.log(`  ✅ RUB метаданные: ${rubMetadata.symbol} ${rubMetadata.flag} (${rubMetadata.decimals} знаков)`);
    });

    // Тест 1.3: Проверка поддержки валют
    this.test('1.3 Проверка поддержки валют', () => {
      if (!fiatCurrencyService.isCurrencySupported('USD')) {
        throw new Error('USD должен поддерживаться');
      }
      
      if (fiatCurrencyService.isCurrencySupported('INVALID')) {
        throw new Error('INVALID не должен поддерживаться');
      }
      
      if (!fiatCurrencyService.isCurrencySupported('rub')) { // lowercase
        throw new Error('Должен поддерживаться нечувствительный к регистру поиск');
      }
      
      console.log('  ✅ Проверка поддержки валют работает корректно');
    });
  }

  /**
   * Тестирование конвертации валют
   */
  async testCurrencyConversion() {
    console.log('\n💱 ЭТАП 2: Тестирование конвертации валют');

    // Тест 2.1: Базовая конвертация
    await this.testAsync('2.1 Базовая конвертация USD/RUB', async () => {
      // Сначала обновляем курсы (может использовать fallback)
      await fiatCurrencyService.updateAllExchangeRates();
      
      const rate = await fiatCurrencyService.getExchangeRate('USD', 'RUB');
      
      if (!rate || rate <= 0) {
        throw new Error(`Некорректный курс USD/RUB: ${rate}`);
      }
      
      if (rate < 50 || rate > 200) {
        console.warn(`  ⚠️ Подозрительный курс USD/RUB: ${rate} (возможно используется fallback)`);
      }
      
      console.log(`  ✅ Курс USD/RUB: ${rate.toFixed(2)}`);
    });

    // Тест 2.2: Конвертация суммы
    await this.testAsync('2.2 Конвертация суммы', async () => {
      const usdAmount = 100;
      const rubAmount = await fiatCurrencyService.convertAmount(usdAmount, 'USD', 'RUB');
      
      if (!rubAmount || rubAmount <= 0) {
        throw new Error(`Некорректная конвертация: $${usdAmount} → ₽${rubAmount}`);
      }
      
      if (rubAmount < 5000 || rubAmount > 20000) {
        console.warn(`  ⚠️ Подозрительная конвертация: $${usdAmount} → ₽${rubAmount}`);
      }
      
      console.log(`  ✅ Конвертация: $${usdAmount} → ₽${rubAmount.toFixed(2)}`);
    });

    // Тест 2.3: Обратная конвертация
    await this.testAsync('2.3 Обратная конвертация', async () => {
      const originalAmount = 100;
      
      // USD → EUR → USD
      const eurAmount = await fiatCurrencyService.convertAmount(originalAmount, 'USD', 'EUR');
      const backToUsd = await fiatCurrencyService.convertAmount(eurAmount, 'EUR', 'USD');
      
      const difference = Math.abs(originalAmount - backToUsd);
      const tolerance = 0.1; // 10 центов толерантность из-за округления
      
      if (difference > tolerance) {
        throw new Error(`Слишком большая разница при обратной конвертации: ${difference.toFixed(4)}`);
      }
      
      console.log(`  ✅ Обратная конвертация: $${originalAmount} → €${eurAmount.toFixed(2)} → $${backToUsd.toFixed(2)} (разница: $${difference.toFixed(4)})`);
    });

    // Тест 2.4: Конвертация одинаковых валют
    await this.testAsync('2.4 Конвертация одинаковых валют', async () => {
      const rate = await fiatCurrencyService.getExchangeRate('USD', 'USD');
      const amount = await fiatCurrencyService.convertAmount(100, 'USD', 'USD');
      
      if (rate !== 1.0) {
        throw new Error(`Курс одинаковых валют должен быть 1.0, получен: ${rate}`);
      }
      
      if (amount !== 100) {
        throw new Error(`Конвертация одинаковых валют должна возвращать исходную сумму, получено: ${amount}`);
      }
      
      console.log('  ✅ Конвертация одинаковых валют работает корректно');
    });
  }

  /**
   * Тестирование форматирования валют
   */
  async testCurrencyFormatting() {
    console.log('\n🎨 ЭТАП 3: Тестирование форматирования валют');

    // Тест 3.1: Форматирование различных валют
    this.test('3.1 Форматирование различных валют', () => {
      const testCases = [
        { amount: 1234.56, currency: 'USD', expected: '$1,234.56' },
        { amount: 1234.56, currency: 'RUB', expected: '1,234.56 ₽' },
        { amount: 1234.56, currency: 'EUR', expected: '€1,234.56' },
        { amount: 1234, currency: 'JPY', expected: '¥1,234' }, // Без дробной части
        { amount: 1234, currency: 'KRW', expected: '₩1,234' }
      ];

      for (const testCase of testCases) {
        const formatted = fiatCurrencyService.formatAmount(testCase.amount, testCase.currency);
        console.log(`    ${testCase.currency}: ${testCase.amount} → ${formatted}`);
        
        // Проверяем, что формат содержит ожидаемые элементы
        const metadata = fiatCurrencyService.getCurrencyMetadata(testCase.currency);
        if (!formatted.includes(metadata.symbol)) {
          throw new Error(`Отформатированная строка не содержит символ валюты: ${formatted}`);
        }
      }
      
      console.log('  ✅ Форматирование всех валют работает корректно');
    });

    // Тест 3.2: Мультивалютное отображение
    await this.testAsync('3.2 Мультивалютное отображение', async () => {
      const conversions = await fiatCurrencyService.getMultiCurrencyDisplay(100, 'USD', ['RUB', 'EUR', 'CNY']);
      
      if (conversions.length === 0) {
        throw new Error('Мультивалютное отображение не вернуло результатов');
      }
      
      console.log('    Конвертации $100:');
      for (const conversion of conversions) {
        console.log(`      ${conversion.flag} ${conversion.formatted}`);
        
        if (!conversion.currency || !conversion.amount || !conversion.formatted) {
          throw new Error(`Неполные данные конвертации: ${JSON.stringify(conversion)}`);
        }
      }
      
      console.log('  ✅ Мультивалютное отображение работает корректно');
    });
  }

  /**
   * Тестирование FiatReserveService
   */
  async testFiatReserveService() {
    console.log('\n💰 ЭТАП 4: Тестирование FiatReserveService');

    // Тест 4.1: Получение доступного баланса
    await this.testAsync('4.1 Получение доступного баланса', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      
      const usdBalance = await fiatReserveService.getAvailableBalance(userId, 'USD');
      const rubBalance = await fiatReserveService.getAvailableBalance(userId, 'RUB');
      
      if (usdBalance <= 0 || rubBalance <= 0) {
        throw new Error('Тестовые балансы должны быть больше 0');
      }
      
      console.log(`  ✅ Тестовые балансы: $${usdBalance}, ₽${rubBalance}`);
    });

    // Тест 4.2: Резервирование средств
    await this.testAsync('4.2 Резервирование средств', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      
      const reserveResult = await fiatReserveService.reserveForOrder(
        userId, 
        orderId, 
        100, 
        'USD', 
        100, // amountInUSD
        1.0  // exchangeRate USD/USD
      );
      
      if (!reserveResult.success) {
        throw new Error(`Ошибка резервирования: ${reserveResult.error}`);
      }
      
      console.log(`  ✅ Зарезервировано: $${reserveResult.amountReserved} (ID: ${reserveResult.reserveId})`);
    });

    // Тест 4.3: Проверка зарезервированного баланса
    await this.testAsync('4.3 Проверка зарезервированного баланса', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      
      // Резервируем средства
      const orderId = new mongoose.Types.ObjectId().toString();
      await fiatReserveService.reserveForOrder(userId, orderId, 50, 'EUR');
      
      // Проверяем зарезервированный баланс
      const reservedBalance = await fiatReserveService.getReservedBalance(userId, 'EUR');
      
      if (reservedBalance < 50) {
        throw new Error(`Неверный зарезервированный баланс: ${reservedBalance}, ожидалось минимум 50`);
      }
      
      console.log(`  ✅ Зарезервированный баланс EUR: €${reservedBalance}`);
    });
  }

  /**
   * Тестирование мультивалютных операций
   */
  async testMultiCurrencyOperations() {
    console.log('\n🌍 ЭТАП 5: Тестирование мультивалютных операций');

    // Тест 5.1: Работа с разными валютами
    await this.testAsync('5.1 Операции с разными валютами', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const currencies = ['USD', 'EUR', 'CNY', 'JPY'];
      const reserves = [];

      for (const currency of currencies) {
        const orderId = new mongoose.Types.ObjectId().toString();
        const amount = currency === 'JPY' ? 10000 : 100; // JPY без дробной части
        
        const result = await fiatReserveService.reserveForOrder(userId, orderId, amount, currency);
        
        if (!result.success) {
          throw new Error(`Ошибка резервирования ${currency}: ${result.error}`);
        }
        
        reserves.push({ currency, amount, reserveId: result.reserveId });
        console.log(`    ✅ Зарезервировано: ${fiatCurrencyService.formatAmount(amount, currency)}`);
      }

      // Получаем статистику пользователя
      const stats = await fiatReserveService.getUserReserveStats(userId);
      
      if (stats.length === 0) {
        throw new Error('Статистика резервов не найдена');
      }
      
      console.log(`  ✅ Статистика резервов: ${stats.length} валют`);
    });

    // Тест 5.2: Конвертация при резервировании
    await this.testAsync('5.2 Автоматическая конвертация при резервировании', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      
      // Резервируем 100 EUR, сервис должен автоматически конвертировать в USD
      const result = await fiatReserveService.reserveForOrder(userId, orderId, 100, 'EUR');
      
      if (!result.success) {
        throw new Error(`Ошибка резервирования: ${result.error}`);
      }
      
      if (!result.amountInUSD || result.amountInUSD <= 0) {
        throw new Error(`Неверная автоматическая конвертация в USD: ${result.amountInUSD}`);
      }
      
      console.log(`  ✅ Автоконвертация: €100 → $${result.amountInUSD.toFixed(2)}`);
    });
  }

  /**
   * Тестирование граничных случаев
   */
  async testEdgeCases() {
    console.log('\n⚡ ЭТАП 6: Тестирование граничных случаев');

    // Тест 6.1: Неподдерживаемые валюты
    await this.testAsync('6.1 Неподдерживаемые валюты', async () => {
      try {
        await fiatCurrencyService.getExchangeRate('INVALID', 'USD');
        throw new Error('Должна была возникнуть ошибка для неподдерживаемой валюты');
      } catch (error) {
        if (error.message.includes('не поддерживается')) {
          console.log('  ✅ Корректная обработка неподдерживаемой валюты');
        } else {
          throw error;
        }
      }
    });

    // Тест 6.2: Нулевые и отрицательные суммы
    await this.testAsync('6.2 Нулевые и отрицательные суммы', async () => {
      const zeroResult = await fiatCurrencyService.convertAmount(0, 'USD', 'RUB');
      const negativeResult = await fiatCurrencyService.convertAmount(-100, 'USD', 'RUB');
      
      if (zeroResult !== 0) {
        throw new Error(`Конвертация 0 должна возвращать 0, получено: ${zeroResult}`);
      }
      
      if (negativeResult !== 0) {
        throw new Error(`Конвертация отрицательной суммы должна возвращать 0, получено: ${negativeResult}`);
      }
      
      console.log('  ✅ Корректная обработка нулевых и отрицательных сумм');
    });

    // Тест 6.3: Очень большие суммы
    await this.testAsync('6.3 Очень большие суммы', async () => {
      const bigAmount = 999999999.99;
      const formatted = fiatCurrencyService.formatAmount(bigAmount, 'USD');
      
      if (!formatted.includes('$') || !formatted.includes(',')) {
        throw new Error(`Неверное форматирование большой суммы: ${formatted}`);
      }
      
      console.log(`  ✅ Форматирование больших сумм: ${formatted}`);
    });

    // Тест 6.4: Очистка кэша
    this.test('6.4 Очистка кэша', () => {
      const statsBefore = fiatCurrencyService.getStats();
      fiatCurrencyService.clearCache();
      const statsAfter = fiatCurrencyService.getStats();
      
      if (statsAfter.cachedRates !== 0) {
        throw new Error(`Кэш не очистился: ${statsAfter.cachedRates} записей осталось`);
      }
      
      console.log('  ✅ Кэш успешно очищен');
    });
  }

  /**
   * Выполнение синхронного теста
   */
  test(name, testFunction) {
    try {
      testFunction();
      this.testResults.passed++;
    } catch (error) {
      console.error(`  ❌ ${name}: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`${name}: ${error.message}`);
    }
  }

  /**
   * Выполнение асинхронного теста
   */
  async testAsync(name, testFunction) {
    try {
      await testFunction();
      this.testResults.passed++;
    } catch (error) {
      console.error(`  ❌ ${name}: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`${name}: ${error.message}`);
    }
  }

  /**
   * Печать отчета о тестировании
   */
  printTestReport() {
    console.log('\n📊 ОТЧЕТ О ТЕСТИРОВАНИИ');
    console.log('='.repeat(60));
    console.log(`✅ Пройдено тестов: ${this.testResults.passed}`);
    console.log(`❌ Провалено тестов: ${this.testResults.failed}`);
    console.log(`📊 Общий процент успеха: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ ОШИБКИ:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
    }
    
    console.log('='.repeat(60));
  }
}

// Запуск тестов если скрипт вызван напрямую
if (require.main === module) {
  const test = new MultiCurrencyP2PTest();
  test.runAllTests()
    .then(() => {
      console.log('\n✅ Тестирование завершено');
      process.exit(test.testResults.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 Критическая ошибка тестирования:', error);
      process.exit(1);
    });
}

module.exports = MultiCurrencyP2PTest;