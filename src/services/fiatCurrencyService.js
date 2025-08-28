/**
 * Fiat Currency Service
 * Централизованный сервис для работы с 10 фиатными валютами в P2P торговой системе
 * 
 * Поддерживаемые валюты:
 * USD, RUB, EUR, CNY, INR, NGN, VND, KRW, JPY, BRL
 */

const axios = require('axios');
const Decimal = require('decimal.js');
const config = require('../config/configuration');

class FiatCurrencyService {
  constructor() {
    // Кэш обменных курсов (TTL: 15 минут)
    this.exchangeRatesCache = new Map();
    this.cacheExpiry = 15 * 60 * 1000; // 15 минут
    this.lastUpdateTime = 0;
    
    // Базовая валюта для расчетов
    this.baseCurrency = 'USD';
    
    // Конфигурация поддерживаемых валют
    this.supportedCurrencies = this.initializeCurrencyConfig();
    
    // API endpoints для получения курсов
    this.exchangeRateAPIs = [
      {
        name: 'exchangerate-api',
        url: 'https://api.exchangerate-api.com/v4/latest/USD',
        timeout: 5000,
        priority: 1
      },
      {
        name: 'fixer-io',
        url: 'https://api.fixer.io/latest',
        params: { base: 'USD', access_key: process.env.FIXER_API_KEY },
        timeout: 8000,
        priority: 2
      }
    ];
  }

  /**
   * Инициализация конфигурации валют
   */
  initializeCurrencyConfig() {
    return {
      USD: {
        code: 'USD',
        name: 'US Dollar',
        nameRu: 'Доллар США',
        symbol: '$',
        symbolPosition: 'before', // before/after amount
        decimals: 2,
        flag: '🇺🇸',
        isBaseCurrency: true,
        popularityIndex: 1
      },
      RUB: {
        code: 'RUB',
        name: 'Russian Ruble',
        nameRu: 'Российский рубль',
        symbol: '₽',
        symbolPosition: 'after',
        decimals: 2,
        flag: '🇷🇺',
        isBaseCurrency: false,
        popularityIndex: 2 // Высокий приоритет как текущая валюта
      },
      EUR: {
        code: 'EUR',
        name: 'Euro',
        nameRu: 'Евро',
        symbol: '€',
        symbolPosition: 'before',
        decimals: 2,
        flag: '🇪🇺',
        isBaseCurrency: false,
        popularityIndex: 3
      },
      CNY: {
        code: 'CNY',
        name: 'Chinese Yuan',
        nameRu: 'Китайский юань',
        symbol: '¥',
        symbolPosition: 'before',
        decimals: 2,
        flag: '🇨🇳',
        isBaseCurrency: false,
        popularityIndex: 4
      },
      INR: {
        code: 'INR',
        name: 'Indian Rupee',
        nameRu: 'Индийская рупия',
        symbol: '₹',
        symbolPosition: 'before',
        decimals: 2,
        flag: '🇮🇳',
        isBaseCurrency: false,
        popularityIndex: 5
      },
      NGN: {
        code: 'NGN',
        name: 'Nigerian Naira',
        nameRu: 'Нигерийская найра',
        symbol: '₦',
        symbolPosition: 'before',
        decimals: 2,
        flag: '🇳🇬',
        isBaseCurrency: false,
        popularityIndex: 6
      },
      VND: {
        code: 'VND',
        name: 'Vietnamese Dong',
        nameRu: 'Вьетнамский донг',
        symbol: '₫',
        symbolPosition: 'after',
        decimals: 0, // VND не использует дробные части
        flag: '🇻🇳',
        isBaseCurrency: false,
        popularityIndex: 7
      },
      KRW: {
        code: 'KRW',
        name: 'South Korean Won',
        nameRu: 'Южнокорейская вона',
        symbol: '₩',
        symbolPosition: 'before',
        decimals: 0, // KRW не использует дробные части
        flag: '🇰🇷',
        isBaseCurrency: false,
        popularityIndex: 8
      },
      JPY: {
        code: 'JPY',
        name: 'Japanese Yen',
        nameRu: 'Японская иена',
        symbol: '¥',
        symbolPosition: 'before',
        decimals: 0, // JPY не использует дробные части
        flag: '🇯🇵',
        isBaseCurrency: false,
        popularityIndex: 9
      },
      BRL: {
        code: 'BRL',
        name: 'Brazilian Real',
        nameRu: 'Бразильский реал',
        symbol: 'R$',
        symbolPosition: 'before',
        decimals: 2,
        flag: '🇧🇷',
        isBaseCurrency: false,
        popularityIndex: 10
      }
    };
  }

  /**
   * Получить все поддерживаемые валюты
   */
  getSupportedCurrencies() {
    return Object.values(this.supportedCurrencies)
      .sort((a, b) => a.popularityIndex - b.popularityIndex);
  }

  /**
   * Получить метаданные валюты
   */
  getCurrencyMetadata(currencyCode) {
    const currency = this.supportedCurrencies[currencyCode?.toUpperCase()];
    if (!currency) {
      throw new Error(`Валюта ${currencyCode} не поддерживается`);
    }
    return currency;
  }

  /**
   * Проверить, поддерживается ли валюта
   */
  isCurrencySupported(currencyCode) {
    return !!this.supportedCurrencies[currencyCode?.toUpperCase()];
  }

  /**
   * Получить актуальный курс валюты к USD
   */
  async getExchangeRate(fromCurrency, toCurrency = 'USD') {
    try {
      fromCurrency = fromCurrency.toUpperCase();
      toCurrency = toCurrency.toUpperCase();

      // Проверяем поддержку валют
      if (!this.isCurrencySupported(fromCurrency) || !this.isCurrencySupported(toCurrency)) {
        throw new Error(`Неподдерживаемая валютная пара: ${fromCurrency}/${toCurrency}`);
      }

      // Если валюты одинаковые
      if (fromCurrency === toCurrency) {
        return 1.0;
      }

      // Обновляем курсы если нужно
      await this.updateExchangeRatesIfNeeded();

      // Если одна из валют USD
      if (fromCurrency === 'USD') {
        const rate = this.exchangeRatesCache.get(`USD_${toCurrency}`);
        return rate ? rate.rate : null;
      }
      
      if (toCurrency === 'USD') {
        const rate = this.exchangeRatesCache.get(`USD_${fromCurrency}`);
        return rate ? (1 / rate.rate) : null;
      }

      // Конвертация через USD (треугольная арбитраж)
      const fromToUSD = await this.getExchangeRate(fromCurrency, 'USD');
      const usdToTarget = await this.getExchangeRate('USD', toCurrency);
      
      if (fromToUSD && usdToTarget) {
        return new Decimal(fromToUSD).mul(usdToTarget).toNumber();
      }

      throw new Error(`Не удалось получить курс ${fromCurrency}/${toCurrency}`);

    } catch (error) {
      console.error(`❌ Ошибка получения курса ${fromCurrency}/${toCurrency}:`, error.message);
      return this.getFallbackRate(fromCurrency, toCurrency);
    }
  }

  /**
   * Конвертировать сумму между валютами
   */
  async convertAmount(amount, fromCurrency, toCurrency) {
    try {
      if (!amount || amount <= 0) {
        return 0;
      }

      const rate = await this.getExchangeRate(fromCurrency, toCurrency);
      if (!rate) {
        throw new Error(`Курс ${fromCurrency}/${toCurrency} недоступен`);
      }

      // Используем Decimal.js для точных вычислений
      const result = new Decimal(amount).mul(rate);
      
      // Округляем до нужного количества знаков
      const targetCurrency = this.getCurrencyMetadata(toCurrency);
      return result.toDecimalPlaces(targetCurrency.decimals).toNumber();

    } catch (error) {
      console.error(`❌ Ошибка конвертации ${amount} ${fromCurrency} в ${toCurrency}:`, error.message);
      throw error;
    }
  }

  /**
   * Форматировать сумму с символом валюты
   */
  formatAmount(amount, currencyCode, options = {}) {
    try {
      const currency = this.getCurrencyMetadata(currencyCode);
      const {
        showCurrencyCode = false,
        useGrouping = true,
        customSymbol = null
      } = options;

      // Округляем до нужного количества знаков
      const roundedAmount = new Decimal(amount || 0)
        .toDecimalPlaces(currency.decimals)
        .toNumber();

      // Форматируем число
      const formattedNumber = roundedAmount.toLocaleString('ru-RU', {
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
        useGrouping: useGrouping
      });

      const symbol = customSymbol || currency.symbol;
      const code = showCurrencyCode ? ` ${currency.code}` : '';

      // Размещаем символ в зависимости от валюты
      if (currency.symbolPosition === 'before') {
        return `${symbol}${formattedNumber}${code}`;
      } else {
        return `${formattedNumber} ${symbol}${code}`;
      }

    } catch (error) {
      console.error(`❌ Ошибка форматирования ${amount} ${currencyCode}:`, error.message);
      return `${amount} ${currencyCode}`;
    }
  }

  /**
   * Получить отображение нескольких валют для суммы
   */
  async getMultiCurrencyDisplay(amount, baseCurrency, targetCurrencies = ['USD', 'RUB', 'EUR']) {
    try {
      const conversions = [];
      
      for (const targetCurrency of targetCurrencies) {
        if (targetCurrency === baseCurrency) continue;
        
        try {
          const convertedAmount = await this.convertAmount(amount, baseCurrency, targetCurrency);
          const formatted = this.formatAmount(convertedAmount, targetCurrency);
          conversions.push({
            currency: targetCurrency,
            amount: convertedAmount,
            formatted: formatted,
            flag: this.getCurrencyMetadata(targetCurrency).flag
          });
        } catch (error) {
          console.warn(`⚠️ Пропуск конвертации в ${targetCurrency}: ${error.message}`);
        }
      }

      return conversions;

    } catch (error) {
      console.error('❌ Ошибка мультивалютного отображения:', error.message);
      return [];
    }
  }

  /**
   * Обновить все обменные курсы
   */
  async updateAllExchangeRates() {
    try {
      console.log('💱 Обновление курсов валют...');
      
      let ratesData = null;
      
      // Пробуем API в порядке приоритета
      for (const api of this.exchangeRateAPIs) {
        try {
          console.log(`🔄 Попытка получения курсов от ${api.name}...`);
          
          const requestConfig = {
            url: api.url,
            timeout: api.timeout,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'MetawhaleBot/1.0'
            }
          };

          if (api.params) {
            requestConfig.params = api.params;
          }

          const response = await axios(requestConfig);
          
          if (response.data && response.data.rates) {
            ratesData = response.data.rates;
            console.log(`✅ Курсы получены от ${api.name}`);
            break;
          }

        } catch (apiError) {
          console.warn(`⚠️ Ошибка API ${api.name}:`, apiError.message);
          continue;
        }
      }

      if (!ratesData) {
        throw new Error('Все API источники курсов недоступны');
      }

      // Обновляем кэш
      const now = Date.now();
      let updatedCount = 0;

      Object.keys(this.supportedCurrencies).forEach(currency => {
        if (currency === 'USD') return; // Базовая валюта
        
        const rate = ratesData[currency];
        if (rate && rate > 0) {
          this.exchangeRatesCache.set(`USD_${currency}`, {
            rate: rate,
            timestamp: now,
            source: 'api'
          });
          updatedCount++;
        }
      });

      this.lastUpdateTime = now;
      console.log(`💱 Обновлено курсов: ${updatedCount}/10`);

      // Сохраняем в БД для долгосрочного кэширования
      await this.saveExchangeRatesToDB();

      return {
        success: true,
        updatedCount: updatedCount,
        timestamp: now
      };

    } catch (error) {
      console.error('❌ Ошибка обновления курсов валют:', error.message);
      
      // Загружаем последние курсы из БД
      await this.loadExchangeRatesFromDB();
      
      return {
        success: false,
        error: error.message,
        fallbackUsed: true
      };
    }
  }

  /**
   * Обновить курсы если нужно (TTL проверка)
   */
  async updateExchangeRatesIfNeeded() {
    const now = Date.now();
    
    if (now - this.lastUpdateTime > this.cacheExpiry) {
      await this.updateAllExchangeRates();
    }
  }

  /**
   * Получить fallback курс из конфигурации
   */
  getFallbackRate(fromCurrency, toCurrency) {
    // Примерные курсы для fallback (обновляются вручную)
    const fallbackRates = {
      'USD_RUB': 100.0,
      'USD_EUR': 0.85,
      'USD_CNY': 7.20,
      'USD_INR': 83.0,
      'USD_NGN': 775.0,
      'USD_VND': 24000.0,
      'USD_KRW': 1320.0,
      'USD_JPY': 149.0,
      'USD_BRL': 5.0
    };

    if (fromCurrency === 'USD') {
      return fallbackRates[`USD_${toCurrency}`] || null;
    }
    
    if (toCurrency === 'USD') {
      const directRate = fallbackRates[`USD_${fromCurrency}`];
      return directRate ? (1 / directRate) : null;
    }

    // Через USD
    const fromRate = fallbackRates[`USD_${fromCurrency}`];
    const toRate = fallbackRates[`USD_${toCurrency}`];
    
    if (fromRate && toRate) {
      return new Decimal(1).div(fromRate).mul(toRate).toNumber();
    }

    return null;
  }

  /**
   * Сохранить курсы в БД (для персистентности)
   */
  async saveExchangeRatesToDB() {
    try {
      const { ExchangeRate } = require('../database/models');
      const now = new Date();

      for (const [pair, data] of this.exchangeRatesCache) {
        const [base, target] = pair.split('_');
        
        await ExchangeRate.findOneAndUpdate(
          { baseCurrency: base, targetCurrency: target },
          {
            rate: data.rate,
            source: data.source || 'api',
            lastUpdated: now,
            isActive: true
          },
          { upsert: true, new: true }
        );
      }

      console.log('💾 Курсы валют сохранены в БД');

    } catch (error) {
      console.error('❌ Ошибка сохранения курсов в БД:', error.message);
    }
  }

  /**
   * Загрузить курсы из БД
   */
  async loadExchangeRatesFromDB() {
    try {
      const { ExchangeRate } = require('../database/models');
      
      const rates = await ExchangeRate.find({ isActive: true })
        .sort({ lastUpdated: -1 })
        .limit(100);

      let loadedCount = 0;
      const now = Date.now();

      rates.forEach(rate => {
        const pair = `${rate.baseCurrency}_${rate.targetCurrency}`;
        this.exchangeRatesCache.set(pair, {
          rate: rate.rate,
          timestamp: rate.lastUpdated.getTime(),
          source: 'database'
        });
        loadedCount++;
      });

      console.log(`📁 Загружено курсов из БД: ${loadedCount}`);
      return loadedCount;

    } catch (error) {
      console.error('❌ Ошибка загрузки курсов из БД:', error.message);
      return 0;
    }
  }

  /**
   * Получить статистику валютных операций
   */
  getStats() {
    return {
      supportedCurrencies: Object.keys(this.supportedCurrencies).length,
      cachedRates: this.exchangeRatesCache.size,
      lastUpdate: this.lastUpdateTime,
      cacheAge: Date.now() - this.lastUpdateTime,
      isStale: (Date.now() - this.lastUpdateTime) > this.cacheExpiry
    };
  }

  /**
   * Очистить кэш (для тестирования)
   */
  clearCache() {
    this.exchangeRatesCache.clear();
    this.lastUpdateTime = 0;
    console.log('🧹 Кэш курсов валют очищен');
  }
}

module.exports = new FiatCurrencyService();