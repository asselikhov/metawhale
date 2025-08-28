/**
 * Fiat Reserve Service
 * Управление резервами фиатных валют для P2P торговой системы
 * Заменяет rubleReserveService для поддержки мультивалютности
 */

const mongoose = require('mongoose');
const { FiatReserve, RubleReserve, User } = require('../database/models');
const fiatCurrencyService = require('./fiatCurrencyService');
const Decimal = require('decimal.js');

class FiatReserveService {
  constructor() {
    this.defaultCurrency = 'RUB'; // Для обратной совместимости
  }

  /**
   * Резервирование средств для ордера
   * @param {string} userId - ID пользователя
   * @param {string} orderId - ID ордера
   * @param {number} amount - Сумма в локальной валюте
   * @param {string} currency - Валюта (USD, RUB, EUR, etc.)
   * @param {number} amountInUSD - Эквивалент в USD
   * @param {number} exchangeRate - Курс валюты к USD на момент резервирования
   * @returns {Promise<{success: boolean, reserveId?: string, error?: string}>}
   */
  async reserveForOrder(userId, orderId, amount, currency = 'RUB', amountInUSD = null, exchangeRate = null) {
    try {
      console.log(`💰 Резервирование ${fiatCurrencyService.formatAmount(amount, currency)} для ордера ${orderId}`);
      
      // Проверяем поддержку валюты
      if (!fiatCurrencyService.isCurrencySupported(currency)) {
        return { success: false, error: `Валюта ${currency} не поддерживается` };
      }

      // Получаем курс и USD эквивалент если не переданы
      if (!amountInUSD || !exchangeRate) {
        try {
          exchangeRate = await fiatCurrencyService.getExchangeRate(currency, 'USD');
          amountInUSD = await fiatCurrencyService.convertAmount(amount, currency, 'USD');
        } catch (conversionError) {
          return { 
            success: false, 
            error: `Ошибка конвертации валют: ${conversionError.message}` 
          };
        }
      }

      // Проверяем доступный баланс
      const availableBalance = await this.getAvailableBalance(userId, currency);
      if (availableBalance < amount) {
        return { 
          success: false, 
          error: `Недостаточно средств. Доступно: ${fiatCurrencyService.formatAmount(availableBalance, currency)}, требуется: ${fiatCurrencyService.formatAmount(amount, currency)}` 
        };
      }

      // Создаем новый резерв
      const fiatReserve = new FiatReserve({
        userId: new mongoose.Types.ObjectId(userId),
        orderId: new mongoose.Types.ObjectId(orderId),
        amount: amount,
        currency: currency,
        amountInUSD: amountInUSD,
        exchangeRate: exchangeRate,
        type: 'order_reserve',
        status: 'reserved',
        reason: `Резерв для ордера ${orderId}`
      });

      await fiatReserve.save();

      console.log(`✅ Зарезервировано ${fiatCurrencyService.formatAmount(amount, currency)} (${fiatCurrencyService.formatAmount(amountInUSD, 'USD')}) ID: ${fiatReserve._id}`);
      
      return { 
        success: true, 
        reserveId: fiatReserve._id.toString(),
        amountReserved: amount,
        currency: currency,
        amountInUSD: amountInUSD
      };

    } catch (error) {
      console.error('❌ Ошибка резервирования средств:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Резервирование средств для сделки
   */
  async reserveForTrade(userId, tradeId, amount, currency = 'RUB', amountInUSD = null, exchangeRate = null) {
    try {
      console.log(`🤝 Резервирование ${fiatCurrencyService.formatAmount(amount, currency)} для сделки ${tradeId}`);
      
      // Аналогично reserveForOrder, но с типом 'trade_reserve'
      if (!fiatCurrencyService.isCurrencySupported(currency)) {
        return { success: false, error: `Валюта ${currency} не поддерживается` };
      }

      if (!amountInUSD || !exchangeRate) {
        try {
          exchangeRate = await fiatCurrencyService.getExchangeRate(currency, 'USD');
          amountInUSD = await fiatCurrencyService.convertAmount(amount, currency, 'USD');
        } catch (conversionError) {
          return { 
            success: false, 
            error: `Ошибка конвертации валют: ${conversionError.message}` 
          };
        }
      }

      const fiatReserve = new FiatReserve({
        userId: new mongoose.Types.ObjectId(userId),
        tradeId: new mongoose.Types.ObjectId(tradeId),
        amount: amount,
        currency: currency,
        amountInUSD: amountInUSD,
        exchangeRate: exchangeRate,
        type: 'trade_reserve',
        status: 'reserved',
        reason: `Резерв для сделки ${tradeId}`
      });

      await fiatReserve.save();

      console.log(`✅ Зарезервировано для сделки: ${fiatCurrencyService.formatAmount(amount, currency)}`);
      
      return { 
        success: true, 
        reserveId: fiatReserve._id.toString(),
        amountReserved: amount,
        currency: currency,
        amountInUSD: amountInUSD
      };

    } catch (error) {
      console.error('❌ Ошибка резервирования для сделки:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Перевод резерва из ордера в сделку
   */
  async transferOrderToTrade(userId, orderId, tradeId, amount, currency = 'RUB') {
    try {
      console.log(`🔄 Перевод резерва из ордера ${orderId} в сделку ${tradeId}`);

      // Находим резерв ордера
      const orderReserve = await FiatReserve.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        orderId: new mongoose.Types.ObjectId(orderId),
        currency: currency,
        type: 'order_reserve',
        status: 'reserved'
      });

      if (!orderReserve) {
        return { success: false, error: 'Резерв ордера не найден' };
      }

      if (orderReserve.amount < amount) {
        return { 
          success: false, 
          error: `Недостаточно средств в резерве. Доступно: ${fiatCurrencyService.formatAmount(orderReserve.amount, currency)}, требуется: ${fiatCurrencyService.formatAmount(amount, currency)}` 
        };
      }

      // Создаем резерв сделки
      const tradeReserve = new FiatReserve({
        userId: orderReserve.userId,
        tradeId: new mongoose.Types.ObjectId(tradeId),
        amount: amount,
        currency: currency,
        amountInUSD: amount * orderReserve.exchangeRate,
        exchangeRate: orderReserve.exchangeRate,
        type: 'trade_reserve',
        status: 'reserved',
        reason: `Перевод из ордера ${orderId} в сделку ${tradeId}`
      });

      await tradeReserve.save();

      // Обновляем резерв ордера
      if (orderReserve.amount === amount) {
        // Весь резерв переводится
        orderReserve.status = 'used';
        orderReserve.releasedAt = new Date();
      } else {
        // Частичный перевод - уменьшаем сумму
        orderReserve.amount -= amount;
        orderReserve.amountInUSD -= (amount * orderReserve.exchangeRate);
      }

      await orderReserve.save();

      console.log(`✅ Резерв переведен: ${fiatCurrencyService.formatAmount(amount, currency)}`);
      
      return { 
        success: true, 
        tradeReserveId: tradeReserve._id.toString(),
        remainingOrderReserve: orderReserve.amount
      };

    } catch (error) {
      console.error('❌ Ошибка перевода резерва:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Освобождение резерва ордера
   */
  async releaseOrderReserve(userId, orderId, currency = null) {
    try {
      console.log(`🔓 Освобождение резерва ордера ${orderId}`);

      const query = {
        userId: new mongoose.Types.ObjectId(userId),
        orderId: new mongoose.Types.ObjectId(orderId),
        type: 'order_reserve',
        status: 'reserved'
      };

      if (currency) {
        query.currency = currency;
      }

      const result = await FiatReserve.updateMany(
        query,
        {
          $set: {
            status: 'released',
            releasedAt: new Date(),
            reason: 'Освобождение резерва ордера'
          }
        }
      );

      console.log(`✅ Освобождено резервов ордера: ${result.modifiedCount}`);
      
      return { 
        success: true, 
        releasedCount: result.modifiedCount 
      };

    } catch (error) {
      console.error('❌ Ошибка освобождения резерва ордера:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Освобождение резерва сделки
   */
  async releaseTradeReserve(userId, tradeId, currency = null) {
    try {
      console.log(`🔓 Освобождение резерва сделки ${tradeId}`);

      const query = {
        userId: new mongoose.Types.ObjectId(userId),
        tradeId: new mongoose.Types.ObjectId(tradeId),
        type: 'trade_reserve',
        status: 'reserved'
      };

      if (currency) {
        query.currency = currency;
      }

      const result = await FiatReserve.updateMany(
        query,
        {
          $set: {
            status: 'released',
            releasedAt: new Date(),
            reason: 'Освобождение резерва сделки'
          }
        }
      );

      console.log(`✅ Освобождено резервов сделки: ${result.modifiedCount}`);
      
      return { 
        success: true, 
        releasedCount: result.modifiedCount 
      };

    } catch (error) {
      console.error('❌ Ошибка освобождения резерва сделки:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение доступного баланса пользователя в указанной валюте
   */
  async getAvailableBalance(userId, currency = 'RUB') {
    try {
      // Для начала возвращаем фиксированные балансы для тестирования
      // В реальной системе это должно быть интегрировано с внешней платежной системой
      
      const mockBalances = {
        'USD': 1000.00,
        'RUB': 100000.00,
        'EUR': 850.00,
        'CNY': 7000.00,
        'INR': 83000.00,
        'NGN': 775000.00,
        'VND': 24000000.00,
        'KRW': 1320000.00,
        'JPY': 149000.00,
        'BRL': 5000.00
      };

      const totalBalance = mockBalances[currency] || 0;

      // Вычитаем зарезервированные средства
      const reservedAmount = await this.getReservedBalance(userId, currency);
      const availableBalance = totalBalance - reservedAmount;

      return Math.max(0, availableBalance); // Не может быть отрицательным

    } catch (error) {
      console.error('❌ Ошибка получения доступного баланса:', error);
      return 0;
    }
  }

  /**
   * Получение суммы зарезервированных средств
   */
  async getReservedBalance(userId, currency = 'RUB') {
    try {
      const result = await FiatReserve.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            currency: currency,
            status: 'reserved'
          }
        },
        {
          $group: {
            _id: null,
            totalReserved: { $sum: '$amount' }
          }
        }
      ]);

      return result.length > 0 ? result[0].totalReserved : 0;

    } catch (error) {
      console.error('❌ Ошибка получения зарезервированного баланса:', error);
      return 0;
    }
  }

  /**
   * Получение статистики резервов пользователя
   */
  async getUserReserveStats(userId) {
    try {
      const stats = await FiatReserve.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $group: {
            _id: {
              currency: '$currency',
              status: '$status'
            },
            totalAmount: { $sum: '$amount' },
            totalAmountInUSD: { $sum: '$amountInUSD' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.currency',
            byStatus: {
              $push: {
                status: '$_id.status',
                totalAmount: '$totalAmount',
                totalAmountInUSD: '$totalAmountInUSD',
                count: '$count'
              }
            }
          }
        }
      ]);

      return stats;

    } catch (error) {
      console.error('❌ Ошибка получения статистики резервов:', error);
      return [];
    }
  }

  /**
   * Миграция рублевого резерва в фиатный резерв
   */
  async migrateRubleReserve(rubleReserveId) {
    try {
      const rubleReserve = await RubleReserve.findById(rubleReserveId);
      if (!rubleReserve) {
        return { success: false, error: 'Рублевый резерв не найден' };
      }

      if (rubleReserve.isMigrated) {
        return { success: false, error: 'Резерв уже мигрирован' };
      }

      // Получаем курс RUB/USD
      const exchangeRate = await fiatCurrencyService.getExchangeRate('RUB', 'USD');
      const amountInUSD = await fiatCurrencyService.convertAmount(rubleReserve.amount, 'RUB', 'USD');

      // Создаем новый фиатный резерв
      const fiatReserve = new FiatReserve({
        userId: rubleReserve.userId,
        orderId: rubleReserve.orderId,
        tradeId: rubleReserve.tradeId,
        amount: rubleReserve.amount,
        currency: 'RUB',
        amountInUSD: amountInUSD,
        exchangeRate: exchangeRate,
        type: rubleReserve.type,
        status: rubleReserve.status,
        reason: rubleReserve.reason,
        createdAt: rubleReserve.createdAt,
        releasedAt: rubleReserve.releasedAt
      });

      await fiatReserve.save();

      // Помечаем рублевый резерв как мигрированный
      rubleReserve.isMigrated = true;
      rubleReserve.migratedToFiatReserveId = fiatReserve._id;
      await rubleReserve.save();

      console.log(`✅ Мигрирован рублевый резерв ${rubleReserveId} → ${fiatReserve._id}`);
      
      return { 
        success: true, 
        newFiatReserveId: fiatReserve._id.toString(),
        migratedAmount: rubleReserve.amount,
        currency: 'RUB'
      };

    } catch (error) {
      console.error('❌ Ошибка миграции рублевого резерва:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение общей статистики всех резервов
   */
  async getGlobalStats() {
    try {
      const stats = await FiatReserve.aggregate([
        {
          $group: {
            _id: {
              currency: '$currency',
              status: '$status'
            },
            totalAmount: { $sum: '$amount' },
            totalAmountInUSD: { $sum: '$amountInUSD' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.currency',
            totalAmountInUSD: { $sum: '$totalAmountInUSD' },
            byStatus: {
              $push: {
                status: '$_id.status',
                totalAmount: '$totalAmount',
                totalAmountInUSD: '$totalAmountInUSD',
                count: '$count'
              }
            }
          }
        },
        {
          $sort: { totalAmountInUSD: -1 }
        }
      ]);

      // Добавляем итоговую статистику
      const totalStats = await FiatReserve.aggregate([
        {
          $group: {
            _id: null,
            totalReservesInUSD: { $sum: '$amountInUSD' },
            totalReserves: { $sum: 1 },
            totalUsers: { $addToSet: '$userId' }
          }
        },
        {
          $project: {
            _id: 0,
            totalReservesInUSD: 1,
            totalReserves: 1,
            uniqueUsers: { $size: '$totalUsers' }
          }
        }
      ]);

      return {
        byCurrency: stats,
        totals: totalStats[0] || { totalReservesInUSD: 0, totalReserves: 0, uniqueUsers: 0 }
      };

    } catch (error) {
      console.error('❌ Ошибка получения глобальной статистики:', error);
      return { byCurrency: [], totals: { totalReservesInUSD: 0, totalReserves: 0, uniqueUsers: 0 } };
    }
  }
}

module.exports = new FiatReserveService();