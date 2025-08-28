/**
 * Демонстрация мультивалютного UI для P2P торговли
 * 
 * Показывает новые возможности интерфейса:
 * - Выбор из 10 фиатных валют
 * - Интуитивные флаги стран
 * - Автоматическое форматирование цен
 * - Поддержка всех валют в формах создания ордеров
 */

const fiatCurrencyService = require('../src/services/fiatCurrencyService');

class MultiCurrencyUIDemo {
  async runUIDemo() {
    try {
      console.log('🎨 ДЕМОНСТРАЦИЯ МУЛЬТИВАЛЮТНОГО UI');
      console.log('='.repeat(60));
      
      await this.demonstrateCurrencySelectionUI();
      await this.demonstrateOrderCreationUI();
      await this.demonstrateMarketDisplayUI();
      
      console.log('\n✅ UI ДЕМОНСТРАЦИЯ ЗАВЕРШЕНА!');
      
    } catch (error) {
      console.error('❌ Ошибка UI демонстрации:', error);
    }
  }

  /**
   * Демонстрация интерфейса выбора валют
   */
  async demonstrateCurrencySelectionUI() {
    console.log('\n💱 ИНТЕРФЕЙС ВЫБОРА ВАЛЮТ');
    console.log('-'.repeat(40));
    
    const currencies = fiatCurrencyService.getSupportedCurrencies();
    
    console.log('📋 Меню выбора валюты (как в Telegram боте):');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  📈 ПОКУПКА CES ТОКЕНОВ                │');
    console.log('│  ➖➖➖➖➖➖➖➖➖➖➖                 │');
    console.log('│  💱 Выберите валюту для торговли:      │');
    console.log('│                                         │');
    
    // Показываем кнопки валют (по 2 в строке)
    for (let i = 0; i < currencies.length; i += 2) {
      const currency1 = currencies[i];
      const currency2 = currencies[i + 1];
      
      let row = '│  ';
      row += `[${currency1.flag} ${currency1.code} ${currency1.symbol}]`;
      
      if (currency2) {
        // Добавляем отступ для выравнивания
        row += '  ';
        row += `[${currency2.flag} ${currency2.code} ${currency2.symbol}]`;
      }
      
      // Дополняем строку до нужной длины
      while (row.length < 41) {
        row += ' ';
      }
      row += '│';
      
      console.log(row);
    }
    
    console.log('│                                         │');
    console.log('│              [🔙 Назад]                 │');
    console.log('└─────────────────────────────────────────┘');
  }

  /**
   * Демонстрация создания ордера с валютой
   */
  async demonstrateOrderCreationUI() {
    console.log('\n📝 ИНТЕРФЕЙС СОЗДАНИЯ ОРДЕРА');
    console.log('-'.repeat(40));
    
    // Пример выбранной валюты
    const selectedCurrency = 'USD';
    const currency = fiatCurrencyService.getCurrencyMetadata(selectedCurrency);
    
    console.log('💰 Форма создания ордера после выбора валюты:');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  📈 ПОКУПКА CES ТОКЕНОВ                │');
    console.log('│  ➖➖➖➖➖➖➖➖➖➖➖                 │');
    console.log(`│  ${currency.flag} Валюта: ${currency.nameRu} (${currency.code})    │`);
    console.log('│  Текущая рыночная цена: $2.50 / CES 🟢 │');
    console.log('│                                         │');
    console.log('│  ⚠️ Введите [кол-во, CES] [цена_за_то  │');
    console.log('│  кен, $] [мин_сумма, $] [макс_сумма, $] │');
    console.log('│  💡 Пример: 10 2.45 25 245             │');
    console.log('│                                         │');
    console.log('│  Информация:                            │');
    console.log('│  • Минимальная сумма в USD: эквивалент  │');
    console.log('│    10 $                                 │');
    console.log('│  • Комиссия платформы: 1% (только с    │');
    console.log('│    мейкеров)                            │');
    console.log('│                                         │');
    console.log('│    [🔄 Обновить цену]                   │');
    console.log('│    [💱 Сменить валюту]                  │');
    console.log('│    [🔙 Назад]                           │');
    console.log('└─────────────────────────────────────────┘');
    
    // Показываем пример подтверждения
    console.log('\n📋 Подтверждение ордера:');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  📈 Подтверждение ордера на покупку     │');
    console.log('│  ➖➖➖➖➖➖➖➖➖➖➖                 │');
    console.log(`│  ${currency.flag} Валюта: ${currency.nameRu} (${currency.code})    │`);
    console.log('│  Количество: 10 CES                     │');
    console.log('│  Цена за токен: $2.45                   │');
    console.log('│  Общая сумма: $24.50                    │');
    console.log('│  Мин. сумма: $25.00                     │');
    console.log('│  Макс. сумма: $245.00                   │');
    console.log('│  Комиссия: 0.10 CES (1%)               │');
    console.log('│                                         │');
    console.log('│  ⚠️ Подтвердить создание ордера?       │');
    console.log('│                                         │');
    console.log('│    [✅ Подтвердить]  [❌ Отмена]        │');
    console.log('└─────────────────────────────────────────┘');
  }

  /**
   * Демонстрация отображения рынка
   */
  async demonstrateMarketDisplayUI() {
    console.log('\n📊 ОТОБРАЖЕНИЕ РЫНКА С ВАЛЮТАМИ');
    console.log('-'.repeat(40));
    
    // Получаем валюты для примеров
    const usd = fiatCurrencyService.getCurrencyMetadata('USD');
    const eur = fiatCurrencyService.getCurrencyMetadata('EUR');
    const rub = fiatCurrencyService.getCurrencyMetadata('RUB');
    const cny = fiatCurrencyService.getCurrencyMetadata('CNY');
    
    console.log('💹 Список ордеров на рынке:');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  📊 РЫНОК                               │');
    console.log('│  ➖➖➖➖➖➖➖➖➖➖➖                 │');
    console.log('│                                         │');
    console.log(`│  💰 Купить 100 CES по $2.18 за токен   │`);
    console.log(`│      ${usd.flag} ${usd.code} • Общая сумма: $218.00      │`);
    console.log('│      👤 @user1 ⭐⭐⭐⭐⭐               │');
    console.log('│                                         │');
    console.log(`│  💰 Продать 50 CES по €2.15 за токен   │`);
    console.log(`│      ${eur.flag} ${eur.code} • Общая сумма: €107.50      │`);
    console.log('│      👤 @user2 ⭐⭐⭐⭐☆               │');
    console.log('│                                         │');
    console.log(`│  💰 Купить 200 CES по ₽258.80 за токен │`);
    console.log(`│      ${rub.flag} ${rub.code} • Общая сумма: ₽51,760.00   │`);
    console.log('│      👤 @user3 ⭐⭐⭐☆☆               │');
    console.log('│                                         │');
    console.log(`│  💰 Продать 75 CES по ¥18.50 за токен  │`);
    console.log(`│      ${cny.flag} ${cny.code} • Общая сумма: ¥1,387       │`);
    console.log('│      👤 @user4 ⭐⭐⭐⭐⭐               │');
    console.log('│                                         │');
    console.log('│  📄 Страница 1 из 3                    │');
    console.log('│     [⬅️ Назад] [➡️ Далее]              │');
    console.log('│                                         │');
    console.log('│         [🔙 Назад к P2P]                │');
    console.log('└─────────────────────────────────────────┘');
    
    console.log('\n🔍 Особенности мультивалютного отображения:');
    console.log('• Флаги стран для быстрой идентификации валют');
    console.log('• Правильное форматирование цен для каждой валюты');
    console.log('• Автоматическая локализация чисел');
    console.log('• Учет особенностей валют (JPY без копеек, etc.)');
    console.log('• Интуитивные символы валют (₽, $, €, ¥, etc.)');
  }
}

// Запуск демонстрации если скрипт вызван напрямую
if (require.main === module) {
  const demo = new MultiCurrencyUIDemo();
  demo.runUIDemo()
    .then(() => {
      console.log('\n✅ UI демонстрация завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Ошибка UI демонстрации:', error);
      process.exit(1);
    });
}

module.exports = MultiCurrencyUIDemo;