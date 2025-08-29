/**
 * Ruble Reserve Service
 * Управление резервами рублей у мейкеров
 */

const { RubleReserve } = require('../database/models');

class RubleReserveService {
  constructor() {
    this.reserveAmounts = new Map(); // userId -> total reserved amount
  }

  /**
   * Резервирует рубли при создании ордера
   * @param {string} userId - ID пользователя (мейкера)
   * @param {string} orderId - ID ордера
   * @param {number} amount - Сумма в рублях для резервирования
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async reserveForOrder(userId, orderId, amount) {
    try {
      // Проверяем, есть ли уже резерв для этого ордера
      const existingReserve = await RubleReserve.findOne({ 
        userId, 
        orderId, 
        status: 'reserved' 
      });
      
      if (existingReserve) {
        return { success: false, message: 'Резерв уже существует для этого ордера' };
      }
      
      // Создаём новый резерв
      const reserve = new RubleReserve({
        userId,
        orderId,
        amount,
        type: 'order_reserve',
        status: 'reserved',
        reason: 'Резерв для ордера на покупку CES'
      });
      
      await reserve.save();
      
      // Обновляем общую сумму резерва в памяти
      const currentReserved = this.reserveAmounts.get(userId) || 0;
      this.reserveAmounts.set(userId, currentReserved + amount);
      
      console.log(`💰 Зарезервировано ${amount} ₽ для пользователя ${userId}, ордер ${orderId}`);
      return { success: true };
      
    } catch (error) {
      console.error('Ошибка резервирования рублей:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Переводит резерв из ордера в сделку
   * @param {string} userId - ID пользователя
   * @param {string} orderId - ID ордера
   * @param {string} tradeId - ID сделки
   * @param {number} amount - Сумма для перевода
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async transferOrderToTrade(userId, orderId, tradeId, amount) {
    try {
      // Находим резерв ордера
      const orderReserve = await RubleReserve.findOne({
        userId,
        orderId,
        status: 'reserved',
        type: 'order_reserve'
      });
      
      if (!orderReserve) {
        return { success: false, message: 'Резерв ордера не найден' };
      }
      
      if (orderReserve.amount < amount) {
        return { success: false, message: 'Недостаточно зарезервированных средств' };
      }
      
      // Обновляем резерв ордера
      if (orderReserve.amount === amount) {
        orderReserve.status = 'used';
        orderReserve.releasedAt = new Date();
      } else {
        orderReserve.amount -= amount;
      }
      await orderReserve.save();
      
      // Создаём резерв для сделки
      const tradeReserve = new RubleReserve({
        userId,
        tradeId,
        amount,
        type: 'trade_reserve',
        status: 'reserved',
        reason: 'Резерв для активной сделки'
      });
      
      await tradeReserve.save();
      
      console.log(`💱 Переведено ${amount} ₽ из резерва ордера в резерв сделки для пользователя ${userId}`);
      return { success: true };
      
    } catch (error) {
      console.error('Ошибка перевода резерва:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Освобождает резерв при отмене ордера
   * @param {string} userId - ID пользователя
   * @param {string} orderId - ID ордера
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async releaseOrderReserve(userId, orderId) {
    try {
      const reserve = await RubleReserve.findOne({
        userId,
        orderId,
        status: 'reserved',
        type: 'order_reserve'
      });
      
      if (!reserve) {
        return { success: false, message: 'Резерв не найден' };
      }
      
      reserve.status = 'released';
      reserve.releasedAt = new Date();
      reserve.reason = 'Ордер отменён';
      
      await reserve.save();
      
      // Обновляем общую сумму резерва в памяти
      const currentReserved = this.reserveAmounts.get(userId) || 0;
      this.reserveAmounts.set(userId, Math.max(0, currentReserved - reserve.amount));
      
      console.log(`💰 Освобождён резерв ${reserve.amount} ₽ для пользователя ${userId}, ордер ${orderId}`);
      return { success: true, amount: reserve.amount };
      
    } catch (error) {
      console.error('Ошибка освобождения резерва ордера:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Освобождает резерв при завершении сделки
   * @param {string} userId - ID пользователя
   * @param {string} tradeId - ID сделки
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async releaseTradeReserve(userId, tradeId) {
    try {
      const reserve = await RubleReserve.findOne({
        userId,
        tradeId,
        status: 'reserved',
        type: 'trade_reserve'
      });
      
      if (!reserve) {
        return { success: false, message: 'Резерв сделки не найден' };
      }
      
      reserve.status = 'used';
      reserve.releasedAt = new Date();
      reserve.reason = 'Сделка завершена, средства потрачены';
      
      await reserve.save();
      
      // Обновляем общую сумму резерва в памяти
      const currentReserved = this.reserveAmounts.get(userId) || 0;
      this.reserveAmounts.set(userId, Math.max(0, currentReserved - reserve.amount));
      
      console.log(`💰 Резерв сделки ${reserve.amount} ₽ отмечен как использованный для пользователя ${userId}`);
      return { success: true, amount: reserve.amount };
      
    } catch (error) {
      console.error('Ошибка освобождения резерва сделки:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Возвращает резерв при отмене сделки
   * @param {string} userId - ID пользователя
   * @param {string} tradeId - ID сделки
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async refundTradeReserve(userId, tradeId) {
    try {
      const reserve = await RubleReserve.findOne({
        userId,
        tradeId,
        status: 'reserved',
        type: 'trade_reserve'
      });
      
      if (!reserve) {
        return { success: false, message: 'Резерв сделки не найден' };
      }
      
      reserve.status = 'released';
      reserve.releasedAt = new Date();
      reserve.reason = 'Сделка отменена, средства возвращены';
      
      await reserve.save();
      
      // Обновляем общую сумму резерва в памяти
      const currentReserved = this.reserveAmounts.get(userId) || 0;
      this.reserveAmounts.set(userId, Math.max(0, currentReserved - reserve.amount));
      
      console.log(`💰 Возвращён резерв сделки ${reserve.amount} ₽ для пользователя ${userId}`);
      return { success: true, amount: reserve.amount };
      
    } catch (error) {
      console.error('Ошибка возврата резерва сделки:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Получает общую сумму зарезервированных рублей пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>}
   */
  async getTotalReserved(userId) {
    try {
      const reserves = await RubleReserve.find({
        userId,
        status: 'reserved'
      });
      
      const total = reserves.reduce((sum, reserve) => sum + reserve.amount, 0);
      
      // Обновляем кэш
      this.reserveAmounts.set(userId, total);
      
      return total;
      
    } catch (error) {
      console.error('Ошибка получения общего резерва:', error);
      return 0;
    }
  }

  /**
   * Получает доступный баланс рублей пользователя
   * Примечание: в данной версии мы предполагаем, что у пользователя достаточно средств
   * В реальной системе здесь была бы интеграция с банковскими API
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>}
   */
  async getAvailableBalance(userId) {
    try {
      // В данной реализации возвращаем фиксированную сумму для демо
      // В реальной системе здесь была бы проверка реального баланса
      const reservedAmount = await this.getTotalReserved(userId);
      const totalBalance = 1000000; // 1,000,000 рублей для демо
      
      return Math.max(0, totalBalance - reservedAmount);
      
    } catch (error) {
      console.error('Ошибка получения доступного баланса:', error);
      return 0;
    }
  }
}

module.exports = new RubleReserveService();