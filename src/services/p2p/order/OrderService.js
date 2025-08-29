/**
 * P2P Order Management Service
 * Handles creation, management, and lifecycle of P2P orders
 */

const { P2POrder, User } = require('../../../database/models');
const walletService = require('../../wallet/walletService');
const rubleReserveService = require('../../rubleReserveService');
const config = require('../../../config/configuration');

class OrderService {
  constructor() {
    this.commissionRate = 0.01; // 1% commission
    this.maxOrderAmount = 10000; // Maximum order amount in CES
    this.minOrderAmount = 1; // Minimum order amount in CES
  }

  // Create a buy order (мейкер создаёт ордер на покупку CES за рубли)
  async createBuyOrder(chatId, amount, pricePerToken, minTradeAmount = 1, maxTradeAmount = null) {
    try {
      console.log(`Создание ордера на покупку: ${amount} CES по ₽${pricePerToken} за токен (chatId: ${chatId})`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        console.log(`Пользователь не найден для chatId: ${chatId}`);
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        console.log(`У пользователя ${chatId} нет кошелька`);
        throw new Error('Сначала создайте кошелек');
      }
      
      // Проверяем профиль P2P
      if (!user.p2pProfile || !user.p2pProfile.isProfileComplete) {
        throw new Error('Заполните профиль P2P для создания ордеров');
      }
      
      // Проверяем лимит: только 1 активный ордер на покупку на пользователя
      const existingBuyOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'buy',
        status: { $in: ['active', 'partial'] }
      });
      
      if (existingBuyOrder) {
        throw new Error('У вас уже есть активный ордер на покупку. Отмените существующий ордер для создания нового.');
      }
      
      // Валидация входных данных
      if (amount <= 0 || pricePerToken <= 0) {
        console.log(`Некорректные данные: amount=${amount}, price=${pricePerToken}`);
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      // Валидация мин/макс сумм
      if (minTradeAmount <= 0) {
        throw new Error('Минимальная сумма должна быть больше 0');
      }
      
      if (maxTradeAmount && maxTradeAmount <= 0) {
        throw new Error('Максимальная сумма должна быть больше 0');
      }
      
      if (minTradeAmount > amount) {
        throw new Error('Минимальная сумма не может быть больше общего количества');
      }
      
      if (maxTradeAmount && maxTradeAmount > amount) {
        throw new Error('Максимальная сумма не может быть больше общего количества');
      }
      
      if (minTradeAmount > (maxTradeAmount || amount)) {
        throw new Error('Минимальная сумма не может быть больше максимальной');
      }
      
      const totalValue = amount * pricePerToken;
      console.log(`Общая стоимость ордера: ₽${totalValue.toFixed(2)}`);
      
      // 🔧 FIX: Проверяем наличие средств для оплаты 1% комиссии при создании ордера на покупку
      const commissionAmount = amount * this.commissionRate; // 1% комиссия в CES
      const walletInfo = await walletService.getUserWallet(user.chatId);
      const availableBalance = walletInfo.cesBalance;
      
      if (availableBalance < commissionAmount) {
        throw new Error(`Недостаточно CES для оплаты комиссии 1%. Доступно: ${availableBalance.toFixed(4)} CES, требуется: ${commissionAmount.toFixed(4)} CES`);
      }
      
      // Проверяем доступность рублей у мейкера
      const availableRubleBalance = await rubleReserveService.getAvailableBalance(user._id.toString());
      
      if (availableRubleBalance < totalValue) {
        throw new Error(`Недостаточно рублей. Доступно: ₽${availableRubleBalance.toFixed(2)}, требуется: ₽${totalValue.toFixed(2)}`);
      }
      
      // Создаём новый ордер на покупку
      console.log(`Создание нового ордера на покупку`);
      const buyOrder = new P2POrder({
        userId: user._id,
        type: 'buy',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        remainingAmount: amount,
        minTradeAmount: minTradeAmount,
        maxTradeAmount: maxTradeAmount || amount,
        paymentMethods: ['bank_transfer'], // Мейкер всегда использует банковский перевод
        status: 'active'
      });
      
      await buyOrder.save();
      
      // Резервируем рубли у мейкера
      const reserveResult = await rubleReserveService.reserveForOrder(
        user._id.toString(),
        buyOrder._id.toString(),
        totalValue
      );
      
      if (!reserveResult.success) {
        // Если не удалось зарезервировать, удаляем ордер
        await P2POrder.deleteOne({ _id: buyOrder._id });
        throw new Error(`Ошибка резервирования средств: ${reserveResult.message}`);
      }
      
      console.log(`Ордер на покупку создан: ${buyOrder._id}`);
      console.log(`Зарезервировано ₽${totalValue} у мейкера ${user._id}`);
      
      return buyOrder;
      
    } catch (error) {
      console.error('Ошибка создания ордера на покупку:', error);
      throw error;
    }
  }

  // Cancel an order
  async cancelOrder(orderId, userChatId) {
    try {
      console.log(`Отмена ордера: ${orderId} пользователем ${userChatId}`);
      
      const order = await P2POrder.findById(orderId).populate('userId');
      if (!order) {
        throw new Error('Ордер не найден');
      }
      
      // Проверяем права на отмену
      if (order.userId.chatId !== userChatId) {
        throw new Error('Вы можете отменить только свои ордера');
      }
      
      // Проверяем статус ордера
      if (!['active', 'partial'].includes(order.status)) {
        throw new Error('Ордер уже завершен или отменен');
      }
      
      // Освобождаем зарезервированные средства
      const rubleReserveService = require('../../utility/rubleReserveService');
      const releaseResult = await rubleReserveService.releaseForOrder(
        order.userId._id.toString(),
        order._id.toString(),
        order.totalValue
      );
      
      if (!releaseResult.success) {
        console.warn(`Предупреждение: Не удалось полностью освободить средства при отмене ордера ${orderId}: ${releaseResult.message}`);
      }
      
      // Обновляем статус ордера
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      await order.save();
      
      console.log(`Ордер ${orderId} успешно отменен`);
      return { success: true, message: 'Ордер успешно отменен' };
      
    } catch (error) {
      console.error('Ошибка отмены ордера:', error);
      throw error;
    }
  }

  // Get active orders with pagination
  async getActiveOrders(page = 1, limit = 10, filters = {}) {
    try {
      const skip = (page - 1) * limit;
      
      const query = {
        status: 'active',
        ...filters
      };
      
      const orders = await P2POrder.find(query)
        .populate('userId', 'username trustScore p2pProfile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await P2POrder.countDocuments(query);
      
      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('Ошибка получения активных ордеров:', error);
      throw error;
    }
  }
}

module.exports = OrderService;