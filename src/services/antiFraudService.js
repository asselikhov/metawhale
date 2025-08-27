/**
 * Anti-Fraud Service for P2P Trading
 * Обеспечивает безопасность P2P торговли через анализ паттернов и поведения пользователей
 */

const { User, P2POrder, P2PTrade } = require('../database/models');

class AntiFraudService {
  constructor() {
    // Пороговые значения для детекции подозрительной активности
    this.THRESHOLDS = {
      MAX_ORDERS_PER_HOUR: 10,          // Максимум ордеров в час
      MAX_ORDERS_PER_DAY: 50,           // Максимум ордеров в день 
      MAX_FAILED_ATTEMPTS: 3,           // Максимум неудачных попыток
      MIN_ACCOUNT_AGE_DAYS: 1,          // Минимальный возраст аккаунта
      SUSPICIOUS_PRICE_DEVIATION: 0.15, // 15% отклонение от рынка = подозрительно
      MAX_TRADE_AMOUNT_NEW_USER: 1000,  // Максимальная сумма для новых пользователей
      VELOCITY_CHECK_WINDOW: 60 * 60 * 1000, // 1 час для проверки скорости
    };
    
    // Кэш для временного хранения проверок
    this.suspiciousActivityCache = new Map();
    this.rateLimit = new Map();
  }

  /**
   * Основная функция проверки безопасности для создания ордера
   * @param {string} chatId - ID пользователя
   * @param {Object} orderData - Данные ордера
   * @returns {Object} - Результат проверки безопасности
   */
  async checkOrderSecurity(chatId, orderData) {
    try {
      console.log(`🔍 [ANTI-FRAUD] Проверка безопасности ордера для ${chatId}`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        return {
          allowed: false,
          reason: 'Пользователь не найден',
          riskLevel: 'HIGH'
        };
      }

      // Проверки безопасности
      const checks = await Promise.all([
        this.checkAccountAge(user),
        this.checkOrderVelocity(chatId),
        this.checkPriceManipulation(orderData),
        this.checkReputationHistory(user),
        this.checkSuspiciousPatterns(chatId, orderData)
      ]);

      // Анализируем результаты
      const risks = checks.filter(check => !check.passed);
      const highRisks = risks.filter(risk => risk.riskLevel === 'HIGH');
      const mediumRisks = risks.filter(risk => risk.riskLevel === 'MEDIUM');

      let riskLevel, allowed, reason;

      if (highRisks.length > 0) {
        riskLevel = 'HIGH';
        allowed = false;
        reason = `Высокий риск: ${highRisks.map(r => r.reason).join(', ')}`;
      } else if (mediumRisks.length >= 2) {
        riskLevel = 'MEDIUM';
        allowed = false;
        reason = `Средний риск (множественный): ${mediumRisks.map(r => r.reason).join(', ')}`;
      } else if (mediumRisks.length === 1) {
        riskLevel = 'MEDIUM';
        allowed = true; // Разрешаем, но с предупреждением
        reason = `Предупреждение: ${mediumRisks[0].reason}`;
      } else {
        riskLevel = 'LOW';
        allowed = true;
        reason = 'Проверки безопасности пройдены';
      }

      // Логируем результат
      console.log(`🔍 [ANTI-FRAUD] Результат для ${chatId}: ${allowed ? 'РАЗРЕШЕНО' : 'ЗАБЛОКИРОВАНО'} (${riskLevel})`);
      
      if (!allowed) {
        // Увеличиваем счетчик подозрительной активности
        this.incrementSuspiciousActivity(chatId);
      }

      return {
        allowed,
        reason,
        riskLevel,
        checks: risks.length > 0 ? risks : null
      };

    } catch (error) {
      console.error('🔍 [ANTI-FRAUD] Ошибка проверки безопасности:', error);
      return {
        allowed: false,
        reason: 'Ошибка системы безопасности',
        riskLevel: 'HIGH'
      };
    }
  }

  /**
   * Проверка возраста аккаунта
   */
  async checkAccountAge(user) {
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const ageInDays = accountAge / (1000 * 60 * 60 * 24);
    
    if (ageInDays < this.THRESHOLDS.MIN_ACCOUNT_AGE_DAYS) {
      return {
        passed: false,
        reason: 'Слишком новый аккаунт',
        riskLevel: 'MEDIUM'
      };
    }
    
    return { passed: true };
  }

  /**
   * Проверка скорости создания ордеров (анти-спам)
   */
  async checkOrderVelocity(chatId) {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    const dayAgo = now - (24 * 60 * 60 * 1000);

    // Считаем ордера за последний час и день
    const [ordersLastHour, ordersLastDay] = await Promise.all([
      P2POrder.countDocuments({
        userId: await User.findOne({ chatId }).select('_id'),
        createdAt: { $gte: new Date(hourAgo) }
      }),
      P2POrder.countDocuments({
        userId: await User.findOne({ chatId }).select('_id'),
        createdAt: { $gte: new Date(dayAgo) }
      })
    ]);

    if (ordersLastHour >= this.THRESHOLDS.MAX_ORDERS_PER_HOUR) {
      return {
        passed: false,
        reason: `Превышен лимит ордеров в час (${ordersLastHour}/${this.THRESHOLDS.MAX_ORDERS_PER_HOUR})`,
        riskLevel: 'HIGH'
      };
    }

    if (ordersLastDay >= this.THRESHOLDS.MAX_ORDERS_PER_DAY) {
      return {
        passed: false,
        reason: `Превышен дневной лимит ордеров (${ordersLastDay}/${this.THRESHOLDS.MAX_ORDERS_PER_DAY})`,
        riskLevel: 'MEDIUM'
      };
    }

    return { passed: true };
  }

  /**
   * Проверка на манипуляции ценой
   */
  async checkPriceManipulation(orderData) {
    try {
      // Получаем среднюю рыночную цену за последние 24 часа
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const marketPrices = await P2POrder.aggregate([
        {
          $match: {
            createdAt: { $gte: dayAgo },
            status: { $in: ['active', 'completed'] }
          }
        },
        {
          $group: {
            _id: null,
            avgPrice: { $avg: '$pricePerToken' },
            minPrice: { $min: '$pricePerToken' },
            maxPrice: { $max: '$pricePerToken' }
          }
        }
      ]);

      if (marketPrices.length === 0) {
        return { passed: true }; // Нет данных для сравнения
      }

      const { avgPrice, minPrice, maxPrice } = marketPrices[0];
      const { pricePerToken } = orderData;
      
      // Проверяем отклонение от средней цены
      const deviation = Math.abs(pricePerToken - avgPrice) / avgPrice;
      
      if (deviation > this.THRESHOLDS.SUSPICIOUS_PRICE_DEVIATION) {
        return {
          passed: false,
          reason: `Подозрительная цена: отклонение ${(deviation * 100).toFixed(1)}% от рынка`,
          riskLevel: 'MEDIUM'
        };
      }

      // Проверяем экстремальные цены
      if (pricePerToken < minPrice * 0.5 || pricePerToken > maxPrice * 2) {
        return {
          passed: false,
          reason: 'Экстремальная цена вне рыночного диапазона',
          riskLevel: 'HIGH'
        };
      }

      return { passed: true };

    } catch (error) {
      console.error('Ошибка проверки цены:', error);
      return { passed: true }; // При ошибке не блокируем
    }
  }

  /**
   * Проверка истории репутации
   */
  async checkReputationHistory(user) {
    if (!user.p2pProfile) {
      return {
        passed: false,
        reason: 'Не заполнен P2P профиль',
        riskLevel: 'MEDIUM'
      };
    }

    // Проверяем количество неудачных сделок
    const failedTrades = await P2PTrade.countDocuments({
      $or: [{ makerId: user._id }, { takerId: user._id }],
      status: { $in: ['cancelled', 'disputed', 'failed'] }
    });

    const totalTrades = await P2PTrade.countDocuments({
      $or: [{ makerId: user._id }, { takerId: user._id }]
    });

    if (totalTrades > 5 && failedTrades / totalTrades > 0.3) {
      return {
        passed: false,
        reason: `Высокий процент неудачных сделок (${Math.round(failedTrades / totalTrades * 100)}%)`,
        riskLevel: 'MEDIUM'
      };
    }

    return { passed: true };
  }

  /**
   * Проверка подозрительных паттернов
   */
  async checkSuspiciousPatterns(chatId, orderData) {
    // Проверяем кэш подозрительной активности
    const suspiciousCount = this.suspiciousActivityCache.get(chatId) || 0;
    
    if (suspiciousCount >= this.THRESHOLDS.MAX_FAILED_ATTEMPTS) {
      return {
        passed: false,
        reason: 'Превышен лимит подозрительной активности',
        riskLevel: 'HIGH'
      };
    }

    // Проверяем паттерн очень больших сумм для новых пользователей
    const user = await User.findOne({ chatId });
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const ageInDays = accountAge / (1000 * 60 * 60 * 24);
    
    const orderValue = orderData.amount * orderData.pricePerToken;
    
    if (ageInDays < 7 && orderValue > this.THRESHOLDS.MAX_TRADE_AMOUNT_NEW_USER) {
      return {
        passed: false,
        reason: `Слишком большая сумма для нового пользователя: ₽${orderValue.toFixed(2)}`,
        riskLevel: 'MEDIUM'
      };
    }

    return { passed: true };
  }

  /**
   * Увеличивает счетчик подозрительной активности
   */
  incrementSuspiciousActivity(chatId) {
    const current = this.suspiciousActivityCache.get(chatId) || 0;
    this.suspiciousActivityCache.set(chatId, current + 1);
    
    // Автоматически очищаем через час
    setTimeout(() => {
      this.suspiciousActivityCache.delete(chatId);
    }, 60 * 60 * 1000);
  }

  /**
   * Проверка банковских реквизитов на валидность
   */
  validateBankDetails(bankDetails) {
    const validationResults = [];
    
    for (const [bankCode, details] of Object.entries(bankDetails)) {
      const validation = this.validateSingleBankDetail(bankCode, details);
      if (!validation.valid) {
        validationResults.push({
          bank: bankCode,
          issue: validation.issue
        });
      }
    }
    
    return {
      valid: validationResults.length === 0,
      issues: validationResults
    };
  }

  /**
   * Валидация одного банковского реквизита
   */
  validateSingleBankDetail(bankCode, details) {
    // Проверяем обязательные поля
    if (!details.cardNumber || !details.cardHolder) {
      return {
        valid: false,
        issue: 'Отсутствуют обязательные данные карты'
      };
    }

    // Проверяем формат номера карты (базовая проверка)
    const cardNumber = details.cardNumber.replace(/\s/g, '');
    if (!/^\d{16,19}$/.test(cardNumber)) {
      return {
        valid: false,
        issue: 'Неверный формат номера карты'
      };
    }

    // Проверяем имя держателя карты
    if (details.cardHolder.length < 2 || !/^[A-Za-zА-Яа-я\s]+$/.test(details.cardHolder)) {
      return {
        valid: false,
        issue: 'Неверный формат имени держателя карты'
      };
    }

    return { valid: true };
  }

  /**
   * Получение статистики безопасности
   */
  getSecurityStats() {
    return {
      suspiciousActivityCount: this.suspiciousActivityCache.size,
      rateLimitedUsers: this.rateLimit.size,
      thresholds: this.THRESHOLDS
    };
  }

  /**
   * Очистка кэшей (для админских функций)
   */
  clearCaches() {
    this.suspiciousActivityCache.clear();
    this.rateLimit.clear();
    console.log('🔍 [ANTI-FRAUD] Кэши безопасности очищены');
  }
}

module.exports = new AntiFraudService();