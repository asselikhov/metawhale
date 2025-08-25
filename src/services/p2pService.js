/**
 * P2P Trading Service with Escrow
 * Handles buying and selling CES tokens for rubles with 1% commission ONLY from makers (order creators)
 * Includes advanced escrow system for maximum security
 */

const { P2POrder, P2PTrade, User } = require('../database/models');
const walletService = require('./walletService');
const priceService = require('./priceService');
const escrowService = require('./escrowService');
const smartNotificationService = require('./smartNotificationService');
const reputationService = require('./reputationService');

class P2PService {
  constructor() {
    this.commissionRate = 0.01; // 1% commission
    this.defaultTradeTimeout = 30; // 30 minutes
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
      
      // Проверяем доступность рублей у мейкера
      const rubleReserveService = require('./rubleReserveService');
      const availableBalance = await rubleReserveService.getAvailableBalance(user._id.toString());
      
      if (availableBalance < totalValue) {
        throw new Error(`Недостаточно рублей. Доступно: ₽${availableBalance.toFixed(2)}, требуется: ₽${totalValue.toFixed(2)}`);
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

  /**
   * Тейкер выбирает ордер мейкера и создаёт сделку
   * @param {string} takerChatId - Telegram ID тейкера (продавца CES)
   * @param {string} buyOrderId - ID ордера мейкера (покупателя)
   * @param {number} cesAmount - Количество CES для продажи
   * @returns {Promise<{success: boolean, tradeId?: string, error?: string}>}
   */
  async createTradeFromOrder(takerChatId, buyOrderId, cesAmount) {
    try {
      console.log(`Тейкер ${takerChatId} создаёт сделку по ордеру ${buyOrderId} на ${cesAmount} CES`);
      
      // Получаем ордер мейкера
      const buyOrder = await P2POrder.findById(buyOrderId).populate('userId');
      if (!buyOrder || buyOrder.status !== 'active') {
        return { success: false, error: 'Ордер не найден или неактивен' };
      }
      
      // Получаем тейкера
      const taker = await User.findOne({ chatId: takerChatId });
      if (!taker) {
        return { success: false, error: 'Тейкер не найден' };
      }
      
      // Проверяем, что это не свой ордер
      if (buyOrder.userId._id.toString() === taker._id.toString()) {
        return { success: false, error: 'Нельзя торговать со своим ордером' };
      }
      
      // Проверяем лимиты
      if (cesAmount < buyOrder.minTradeAmount || cesAmount > buyOrder.maxTradeAmount) {
        return { 
          success: false, 
          error: `Количество должно быть от ${buyOrder.minTradeAmount} до ${buyOrder.maxTradeAmount} CES` 
        };
      }
      
      if (cesAmount > buyOrder.remainingAmount) {
        return { 
          success: false, 
          error: `Недостаточно CES в ордере. Доступно: ${buyOrder.remainingAmount} CES` 
        };
      }
      
      // Проверяем доступный баланс CES у тейкера (исключая эскроу)
      const walletInfo = await walletService.getUserWallet(taker.chatId);
      if (walletInfo.cesBalance < cesAmount) {
        return { 
          success: false, 
          error: `Недостаточно доступных CES. Доступно: ${walletInfo.cesBalance.toFixed(4)} CES` 
        };
      }
      
      // Проверяем профиль тейкера
      if (!taker.p2pProfile || !taker.p2pProfile.isProfileComplete) {
        return { success: false, error: 'Заполните профиль P2P для создания сделок' };
      }
      
      // Замораживаем CES у тейкера
      const escrowResult = await escrowService.lockTokensInEscrow(taker._id, null, 'CES', cesAmount);
      if (!escrowResult.success) {
        return { success: false, error: 'Ошибка блокировки CES в эскроу' };
      }
      
      const totalPrice = cesAmount * buyOrder.pricePerToken;
      const commission = cesAmount * this.commissionRate; // 1% комиссия с мейкера в CES
      
      // Переводим резерв рублей из ордера в сделку
      const rubleReserveService = require('./rubleReserveService');
      const transferResult = await rubleReserveService.transferOrderToTrade(
        buyOrder.userId._id.toString(),
        buyOrderId,
        null, // tradeId будем обновлять после создания
        totalPrice
      );
      
      if (!transferResult.success) {
        // Отменяем эскроу
        await escrowService.refundTokensFromEscrow(taker._id, null, 'CES', cesAmount, 'Ошибка резервирования рублей');
        return { success: false, error: `Ошибка резерва рублей: ${transferResult.message}` };
      }
      
      // Создаём сделку
      const trade = new P2PTrade({
        buyOrderId: buyOrder._id,
        sellOrderId: buyOrder._id, // Пока используем тот же ID
        buyerId: buyOrder.userId._id, // Мейкер (покупатель)
        sellerId: taker._id, // Тейкер (продавец)
        amount: cesAmount,
        pricePerToken: buyOrder.pricePerToken,
        totalValue: totalPrice,
        buyerCommission: commission, // Комиссия с мейкера в CES
        sellerCommission: 0, // Тейкер не платит комиссию
        commission: commission,
        status: 'escrow_locked',
        escrowStatus: 'locked',
        paymentMethod: 'bank_transfer',
        paymentDetails: {
          bankName: this.getBankDisplayName(taker.p2pProfile.paymentMethods[0]?.bank),
          cardNumber: taker.p2pProfile.paymentMethods[0]?.cardNumber,
          recipientName: taker.p2pProfile.fullName,
          amount: totalPrice
        },
        timeTracking: {
          createdAt: new Date(),
          escrowLockedAt: new Date(),
          expiresAt: new Date(Date.now() + (buyOrder.tradeTimeLimit || 30) * 60 * 1000)
        }
      });
      
      await trade.save();
      
      // Обновляем ордер
      buyOrder.filledAmount += cesAmount;
      buyOrder.remainingAmount -= cesAmount;
      
      if (buyOrder.remainingAmount <= 0) {
        buyOrder.status = 'completed';
        // Освобождаем оставшийся резерв (если есть)
        await rubleReserveService.releaseOrderReserve(
          buyOrder.userId._id.toString(),
          buyOrder._id.toString()
        );
      } else {
        buyOrder.status = 'partial';
      }
      
      await buyOrder.save();
      
      console.log(`Сделка создана: ${trade._id}`);
      console.log(`Мейкер: ${buyOrder.userId.chatId}, Тейкер: ${takerChatId}`);
      console.log(`Количество: ${cesAmount} CES, Сумма: ₽${totalPrice}`);
      
      return { success: true, tradeId: trade._id.toString() };
      
    } catch (error) {
      console.error('Ошибка создания сделки:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Получает отображаемое название банка
   */
  getBankDisplayName(bankCode) {
    const bankNames = {
      'sberbank': 'Сбербанк',
      'vtb': 'ВТБ',
      'gazprombank': 'Газпромбанк',
      'alfabank': 'Альфа-Банк',
      'rshb': 'Россельхозбанк',
      'mkb': 'МКБ',
      'sovcombank': 'Совкомбанк',
      'tbank': 'Т-Банк',
      'domrf': 'ДОМ.РФ',
      'otkritie': 'Открытие',
      'raiffeisenbank': 'Райффайзенбанк',
      'rosbank': 'Росбанк'
    };
    return bankNames[bankCode] || bankCode;
  }
  
  /**
   * Мейкер отмечает, что оплата выполнена
   * @param {string} tradeId - ID сделки
   * @param {string} makerChatId - Telegram ID мейкера
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async markPaymentMade(tradeId, makerChatId) {
    try {
      console.log(`Мейкер ${makerChatId} отмечает оплату выполненной для сделки ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        return { success: false, error: 'Сделка не найдена' };
      }
      
      // Проверяем, что это мейкер (покупатель)
      if (trade.buyerId.chatId !== makerChatId) {
        return { success: false, error: 'Только мейкер может отметить оплату' };
      }
      
      if (trade.status !== 'escrow_locked') {
        return { success: false, error: 'Нельзя отметить оплату для этой сделки' };
      }
      
      // Обновляем статус
      trade.status = 'payment_made';
      trade.buyerPaymentMade = true;
      trade.timeTracking.paymentMadeAt = new Date();
      
      await trade.save();
      
      console.log(`Оплата отмечена как выполненная для сделки ${tradeId}`);
      
      // Уведомляем тейкера
      try {
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.sellerId._id,
          trade,
          'payment_made'
        );
      } catch (notifyError) {
        console.log('Предупреждение: Не удалось отправить уведомление');
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('Ошибка отметки оплаты:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Тейкер подтверждает получение оплаты
   * @param {string} tradeId - ID сделки
   * @param {string} takerChatId - Telegram ID тейкера
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async confirmPaymentReceived(tradeId, takerChatId) {
    try {
      console.log(`Тейкер ${takerChatId} подтверждает получение оплаты для сделки ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        return { success: false, error: 'Сделка не найдена' };
      }
      
      // Проверяем, что это тейкер (продавец)
      if (trade.sellerId.chatId !== takerChatId) {
        return { success: false, error: 'Только тейкер может подтвердить получение оплаты' };
      }
      
      if (trade.status !== 'payment_made') {
        return { success: false, error: 'Мейкер ещё не отметил оплату как выполненную' };
      }
      
      // Обновляем статус
      trade.status = 'payment_confirmed';
      trade.sellerPaymentReceived = true;
      trade.timeTracking.paymentConfirmedAt = new Date();
      
      await trade.save();
      
      // Освобождаем CES из эскроу и переводим мейкеру
      const cesAmountToTransfer = trade.amount - trade.buyerCommission; // Вычитаем комиссию
      
      const releaseResult = await escrowService.releaseTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        cesAmountToTransfer,
        trade.buyerId.walletAddress,
        'Перевод CES мейкеру по завершенной сделке'
      );
      
      if (!releaseResult.success) {
        console.error('Ошибка освобождения CES:', releaseResult.error);
        // Не возвращаем ошибку, так как подтверждение уже прошло
      } else {
        // Комиссия остаётся в эскроу как платформенная комиссия
        if (trade.buyerCommission > 0) {
          console.log(`Комиссия ${trade.buyerCommission} CES остаётся в эскроу`);
        }
        
        // Освобождаем резерв рублей у мейкера
        const rubleReserveService = require('./rubleReserveService');
        await rubleReserveService.releaseTradeReserve(
          trade.buyerId._id.toString(),
          tradeId
        );
        
        // Обновляем статус сделки
        trade.status = 'completed';
        trade.escrowStatus = 'released';
        trade.timeTracking.completedAt = new Date();
        trade.timeTracking.escrowReleasedAt = new Date();
        
        await trade.save();
        
        console.log(`Сделка ${tradeId} успешно завершена`);
        console.log(`Мейкер получил ${cesAmountToTransfer} CES`);
        console.log(`Тейкер получил ₽${trade.totalValue}`);
      }
      
      // Уведомляем мейкера
      try {
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.buyerId._id,
          trade,
          'trade_completed'
        );
      } catch (notifyError) {
        console.log('Предупреждение: Не удалось отправить уведомление');
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('Ошибка подтверждения оплаты:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Create a sell order (deprecated - не используется в новом флоу)
  async createSellOrder(chatId, amount, pricePerToken, paymentMethods = ['bank_transfer'], minTradeAmount = 1, maxTradeAmount = null) {
    try {
      console.log(`Creating sell order: ${amount} CES at ₽${pricePerToken} per token (chatId: ${chatId})`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        console.log(`User not found for chatId: ${chatId}`);
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        console.log(`User ${chatId} has no wallet`);
        throw new Error('Сначала создайте кошелек');
      }
      
      // Validate input
      if (amount <= 0 || pricePerToken <= 0) {
        console.log(`Invalid input: amount=${amount}, price=${pricePerToken}`);
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      // Validate min/max trade amounts
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
      
      if (amount < this.minOrderAmount || amount > this.maxOrderAmount) {
        throw new Error(`Количество должно быть от ${this.minOrderAmount} до ${this.maxOrderAmount} CES`);
      }
      
      // Check available CES balance (excluding escrowed tokens)
      const walletInfo = await walletService.getUserWallet(user.chatId);
      if (walletInfo.cesBalance < amount) {
        console.log(`Insufficient available CES balance: ${walletInfo.cesBalance} < ${amount}`);
        throw new Error(`Недостаточно доступных CES токенов. Доступно: ${walletInfo.cesBalance.toFixed(4)} CES`);
      }
      
      const totalValue = amount * pricePerToken;
      console.log(`Total order value: ₽${totalValue.toFixed(2)}`);
      
      // Check for existing active sell orders with same price
      const existingOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'sell',
        pricePerToken: pricePerToken,
        status: 'active'
      });
      
      if (existingOrder) {
        // Update existing order and lock additional tokens in escrow
        console.log(`Updating existing sell order: ${existingOrder._id}`);
        
        // Lock additional tokens in escrow
        await escrowService.lockTokensInEscrow(user._id, null, 'CES', amount);
        
        existingOrder.amount += amount;
        existingOrder.remainingAmount += amount;
        existingOrder.escrowAmount += amount;
        existingOrder.totalValue = existingOrder.amount * pricePerToken;
        existingOrder.updatedAt = new Date();
        existingOrder.escrowLocked = true;
        
        // Update min/max trade amounts if provided
        if (minTradeAmount) {
          existingOrder.minTradeAmount = minTradeAmount;
        }
        if (maxTradeAmount) {
          existingOrder.maxTradeAmount = maxTradeAmount;
        }
        
        await existingOrder.save();
        
        console.log(`Updated existing sell order: ${existingOrder._id}`);
        return existingOrder;
      }
      
      // Lock tokens in escrow before creating order
      console.log(`Locking ${amount} CES in escrow`);
      await escrowService.lockTokensInEscrow(user._id, null, 'CES', amount);
      
      // Create new sell order
      console.log(`Creating new sell order`);
      const sellOrder = new P2POrder({
        userId: user._id,
        type: 'sell',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        remainingAmount: amount,
        escrowLocked: true,
        escrowAmount: amount,
        paymentMethods: paymentMethods,
        tradeTimeLimit: this.defaultTradeTimeout,
        minTradeAmount: minTradeAmount,
        maxTradeAmount: maxTradeAmount || amount
      });
      
      await sellOrder.save();
      
      console.log(`Sell order created: ${sellOrder._id}`);
      
      // Try to match with existing buy orders
      console.log(`Attempting to match orders...`);
      await this.matchOrders();
      
      return sellOrder;
      
    } catch (error) {
      console.error('Error creating sell order:', error);
      throw error;
    }
  }

  // Enhanced order matching with smart algorithms
  async matchOrders() {
    try {
      console.log('Matching orders with enhanced algorithm...');
      
      // Get active buy orders sorted by price (highest first) and trust score
      const buyOrders = await P2POrder.find({
        type: 'buy',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      }).sort({ pricePerToken: -1, createdAt: 1 }).populate('userId');
      
      // Get active sell orders sorted by price (lowest first) and trust score
      const sellOrders = await P2POrder.find({
        type: 'sell',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      }).sort({ pricePerToken: 1, createdAt: 1 }).populate('userId');
      
      // Smart matching algorithm
      for (const buyOrder of buyOrders) {
        for (const sellOrder of sellOrders) {
          // Skip if same user (no self-trading)
          if (buyOrder.userId._id.toString() === sellOrder.userId._id.toString()) {
            continue;
          }
          
          // Check price compatibility (buy price >= sell price)
          if (buyOrder.pricePerToken >= sellOrder.pricePerToken) {
            // Check payment method compatibility
            const compatibleMethods = buyOrder.paymentMethods.filter(method => 
              sellOrder.paymentMethods.includes(method)
            );
            
            if (compatibleMethods.length === 0) {
              // No compatible payment methods, skip this pair
              continue;
            }
            
            // Check user verification compatibility
            const buyUserTrust = buyOrder.userId.trustScore !== undefined ? buyOrder.userId.trustScore : 0;
            const sellUserTrust = sellOrder.userId.trustScore !== undefined ? sellOrder.userId.trustScore : 0;
            
            // Calculate trade amount (minimum of remaining amounts)
            const tradeAmount = Math.min(buyOrder.remainingAmount, sellOrder.remainingAmount);
            
            // Check if trade amount is within user limits
            const buyerLimitCheck = this.checkUserTradeLimits(buyOrder.userId, tradeAmount, 'buy');
            const sellerLimitCheck = this.checkUserTradeLimits(sellOrder.userId, tradeAmount, 'sell');
            
            if (!buyerLimitCheck.allowed || !sellerLimitCheck.allowed) {
              // User limits exceeded, skip this pair
              continue;
            }
            
            // Use seller's price for the trade
            const tradePrice = sellOrder.pricePerToken;
            const totalValue = tradeAmount * tradePrice;
            
            // CORRECT MAKER/TAKER LOGIC: Maker = order created first, Taker = order created later
            const buyOrderTime = new Date(buyOrder.createdAt).getTime();
            const sellOrderTime = new Date(sellOrder.createdAt).getTime();
            
            let makerCommissionInCES = 0;
            let takerCommissionInCES = 0;
            let buyerCommissionInRubles = 0;
            let sellerCommissionInRubles = 0;
            
            if (buyOrderTime < sellOrderTime) {
              // Buy order was created first → Buyer is MAKER, Seller is TAKER
              makerCommissionInCES = tradeAmount * this.commissionRate; // 1% from buyer (maker)
              buyerCommissionInRubles = makerCommissionInCES * tradePrice;
              sellerCommissionInRubles = 0; // Seller (taker) pays nothing
              console.log(`Buy order is maker (${new Date(buyOrder.createdAt).toISOString()}) vs sell order taker (${new Date(sellOrder.createdAt).toISOString()})`);
            } else {
              // Sell order was created first → Seller is MAKER, Buyer is TAKER  
              makerCommissionInCES = tradeAmount * this.commissionRate; // 1% from seller (maker)
              sellerCommissionInRubles = makerCommissionInCES * tradePrice;
              buyerCommissionInRubles = 0; // Buyer (taker) pays nothing
              console.log(`Sell order is maker (${new Date(sellOrder.createdAt).toISOString()}) vs buy order taker (${new Date(buyOrder.createdAt).toISOString()})`);
            }
            
            console.log(`Executing trade: ${tradeAmount} CES at ₽${tradePrice} (maker commission: ${makerCommissionInCES.toFixed(4)} CES = ₽${Math.max(buyerCommissionInRubles, sellerCommissionInRubles).toFixed(2)}, taker commission: ₽0)`);
            
            // Send smart notifications to both users
            await smartNotificationService.sendSmartOrderMatchNotification(
              buyOrder.userId._id, 
              sellOrder, 
              buyOrder
            );
            
            await smartNotificationService.sendSmartOrderMatchNotification(
              sellOrder.userId._id, 
              buyOrder, 
              sellOrder
            );
            
            // Execute the trade with correct maker commission
            await this.executeTrade(buyOrder, sellOrder, tradeAmount, tradePrice, totalValue, buyerCommissionInRubles, sellerCommissionInRubles);
            
            // Update order statuses
            buyOrder.remainingAmount -= tradeAmount;
            buyOrder.filledAmount += tradeAmount;
            sellOrder.remainingAmount -= tradeAmount;
            sellOrder.filledAmount += tradeAmount;
            
            if (buyOrder.remainingAmount === 0) {
              buyOrder.status = 'completed';
            } else if (buyOrder.filledAmount > 0) {
              buyOrder.status = 'partial';
            }
            
            if (sellOrder.remainingAmount === 0) {
              sellOrder.status = 'completed';
            } else if (sellOrder.filledAmount > 0) {
              sellOrder.status = 'partial';
            }
            
            await buyOrder.save();
            await sellOrder.save();
            
            console.log(`Trade executed successfully`);
            
            // If buy order is completed, break inner loop
            if (buyOrder.remainingAmount === 0) {
              break;
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error matching orders:', error);
      throw error;
    }
  }

  // Check user trade limits
  checkUserTradeLimits(user, amount, orderType) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Check daily limit
      if (user.tradingLimits && user.tradingLimits.dailyLimit) {
        const dailyLimit = user.tradingLimits.dailyLimit;
        // In a real implementation, you would check actual daily volume
        // For now, we'll just check against the limit
        if (amount * user.tradingLimits.maxSingleTrade > dailyLimit) {
          return { allowed: false, reason: 'Превышен дневной лимит' };
        }
      }
      
      // Check single trade limit
      if (user.tradingLimits && user.tradingLimits.maxSingleTrade) {
        if (amount > user.tradingLimits.maxSingleTrade) {
          return { allowed: false, reason: 'Превышен лимит одной сделки' };
        }
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Error checking user trade limits:', error);
      return { allowed: true }; // Allow trade if there's an error
    }
  }

  // Execute a trade between two orders with escrow
  async executeTrade(buyOrder, sellOrder, amount, pricePerToken, totalValue, buyerCommission, sellerCommission) {
    try {
      console.log(`Executing escrow trade: ${amount} CES at ₽${pricePerToken} (buyer commission: ₽${buyerCommission.toFixed(2)}, seller commission: ₽${sellerCommission.toFixed(2)})`);
      
      // Commission logic is now correctly handled by caller:
      // - If buyer created order first → buyerCommission > 0, sellerCommission = 0
      // - If seller created order first → sellerCommission > 0, buyerCommission = 0
      
      const totalCommission = buyerCommission + sellerCommission;
      
      // Create trade record with escrow status
      const trade = new P2PTrade({
        buyOrderId: buyOrder._id,
        sellOrderId: sellOrder._id,
        buyerId: buyOrder.userId._id,
        sellerId: sellOrder.userId._id,
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        buyerCommission: buyerCommission, // Only > 0 if buyer is maker
        sellerCommission: sellerCommission, // Only > 0 if seller is maker  
        commission: totalCommission, // Total commission (should be just maker commission)
        status: 'escrow_locked',
        escrowStatus: 'locked',
        paymentMethod: buyOrder.paymentMethods ? buyOrder.paymentMethods[0] : 'bank_transfer',
        timeTracking: {
          createdAt: new Date(),
          escrowLockedAt: new Date(),
          expiresAt: new Date(Date.now() + this.defaultTradeTimeout * 60 * 1000)
        }
      });
      
      await trade.save();
      console.log(`Trade record created: ${trade._id}`);
      
      // Link escrow to trade (update existing escrow transaction)
      try {
        await escrowService.linkEscrowToTrade(sellOrder.userId._id, trade._id, 'CES', amount);
      } catch (escrowError) {
        console.log('Warning: Could not link escrow to trade, but trade continues');
      }
      
      // Set trade status to pending payment
      trade.status = 'payment_pending';
      await trade.save();
      
      console.log(`Escrow trade created successfully: ${trade._id}`);
      
      // Schedule automatic timeout handling
      setTimeout(() => {
        this.handleTradeTimeout(trade._id);
      }, this.defaultTradeTimeout * 60 * 1000);
      
      return trade;
      
    } catch (error) {
      console.error('Error executing escrow trade:', error);
      throw error;
    }
  }

  // Get market orders for display with pagination
  async getMarketOrders(limit = 20, offset = 0) {
    try {
      // Get active buy and sell orders with populated user data
      // Limit the fields we retrieve for better performance
      const [buyOrders, sellOrders] = await Promise.all([
        P2POrder.find({ 
          type: 'buy', 
          status: 'active',
          remainingAmount: { $gt: 0 }
        })
        .sort({ pricePerToken: -1, createdAt: 1 }) // Sort by price (highest first), then by time
        .skip(offset)
        .limit(limit)
        .populate({
          path: 'userId',
          select: 'username firstName trustScore verificationLevel'
        }),
        
        P2POrder.find({ 
          type: 'sell', 
          status: 'active',
          remainingAmount: { $gt: 0 }
        })
        .sort({ pricePerToken: 1, createdAt: 1 }) // Sort by price (lowest first), then by time
        .skip(offset)
        .limit(limit)
        .populate({
          path: 'userId',
          select: 'username firstName trustScore verificationLevel'
        })
      ]);
      
      // Get total count for pagination
      const [buyOrdersCount, sellOrdersCount] = await Promise.all([
        P2POrder.countDocuments({ 
          type: 'buy', 
          status: 'active',
          remainingAmount: { $gt: 0 }
        }),
        P2POrder.countDocuments({ 
          type: 'sell', 
          status: 'active',
          remainingAmount: { $gt: 0 }
        })
      ]);
      
      return {
        buyOrders,
        sellOrders,
        buyOrdersCount,
        sellOrdersCount
      };
    } catch (error) {
      console.error('Error getting market orders:', error);
      return {
        buyOrders: [],
        sellOrders: [],
        buyOrdersCount: 0,
        sellOrdersCount: 0
      };
    }
  }

  // Get user's P2P orders with pagination
  async getUserOrders(chatId, limit = 10, offset = 0) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const [orders, totalCount] = await Promise.all([
        P2POrder.find({ userId: user._id })
          .sort({ createdAt: -1 }) // Most recent first
          .skip(offset)
          .limit(limit),
        
        P2POrder.countDocuments({ userId: user._id })
      ]);
      
      return {
        orders,
        totalCount
      };
      
    } catch (error) {
      console.error('Error getting user orders:', error);
      throw error;
    }
  }

  // Get user's P2P orders by user ID and type
  async getUserOrdersByUserId(userId, type, limit = 1) {
    try {
      const orders = await P2POrder.find({ 
        userId: userId,
        type: type,
        status: 'active'
      })
      .sort({ createdAt: -1 })
      .limit(limit);
      
      return orders;
      
    } catch (error) {
      console.error('Error getting user orders by user ID:', error);
      return [];
    }
  }

  // Get user's P2P trade history
  async getUserTrades(chatId, limit = 10) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const trades = await P2PTrade.find({
        $or: [
          { buyerId: user._id },
          { sellerId: user._id }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('buyerId', 'username firstName trustScore')
      .populate('sellerId', 'username firstName trustScore');
      
      return trades;
      
    } catch (error) {
      console.error('Error getting user trades:', error);
      throw error;
    }
  }

  // Cancel an order
  async cancelOrder(chatId, orderId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const order = await P2POrder.findOne({
        _id: orderId,
        userId: user._id,
        status: { $in: ['active', 'partial'] }
      });
      
      if (!order) {
        throw new Error('Ордер не найден или уже завершен');
      }
      
      order.status = 'cancelled';
      await order.save();
      
      console.log(`Order cancelled: ${orderId}`);
      return order;
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // Get market price suggestion for P2P trading
  async getMarketPriceSuggestion() {
    try {
      // Get current CES price from price service (cached for performance)
      const cesPriceData = await priceService.getCESPrice();
      const currentPrice = cesPriceData.priceRub;
      
      // For better performance, use a simpler calculation for suggested price
      // Add a small premium for sellers, subtract a small discount for buyers
      const suggestedPrice = currentPrice;
      
      return {
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        suggestedPrice: parseFloat(suggestedPrice.toFixed(2)),
        priceRange: {
          min: parseFloat((currentPrice * 0.95).toFixed(2)), // 5% below market
          max: parseFloat((currentPrice * 1.05).toFixed(2))  // 5% above market
        }
      };
    } catch (error) {
      console.error('Error getting market price suggestion:', error);
      // Return default values to prevent app crashes
      return {
        currentPrice: 0,
        suggestedPrice: 0,
        priceRange: { min: 0, max: 0 }
      };
    }
  }

  // Handle trade timeout
  async handleTradeTimeout(tradeId) {
    try {
      console.log(`Handling trade timeout for ${tradeId}`);
      
      // Get trade details before handling timeout
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      // Handle escrow timeout
      await escrowService.handleEscrowTimeout(tradeId);
      
      // Send smart notification about timeout
      if (trade) {
        const smartNotificationService = require('./smartNotificationService');
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.buyerId._id, 
          trade, 
          'timeout'
        );
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.sellerId._id, 
          trade, 
          'timeout'
        );
      }
    } catch (error) {
      console.error('Error handling trade timeout:', error);
    }
  }

  // Confirm payment for a trade
  async confirmPayment(tradeId, buyerChatId, paymentProof = '') {
    try {
      console.log(`Confirming payment for trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        throw new Error('Сделка не найдена');
      }
      
      if (trade.buyerId.chatId !== buyerChatId) {
        throw new Error('Вы не являетесь покупателем в этой сделке');
      }
      
      if (trade.status !== 'payment_pending') {
        throw new Error('Нельзя подтвердить оплату для этой сделки');
      }
      
      // Update trade with payment confirmation
      trade.status = 'payment_confirmed';
      trade.paymentDetails.buyerProof = paymentProof;
      trade.timeTracking.paymentMadeAt = new Date();
      trade.timeTracking.paymentConfirmedAt = new Date();
      
      await trade.save();
      
      // Release tokens from escrow to buyer
      const releaseResult = await escrowService.releaseTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        trade.amount,
        trade.buyerId._id
      );
      
      // Complete the trade
      trade.status = 'completed';
      trade.escrowStatus = 'released';
      trade.cesTransferTxHash = releaseResult.txHash;
      trade.timeTracking.completedAt = new Date();
      
      await trade.save();
      
      // Transfer commission to admin wallet (ONLY from maker)
      try {
        // Determine who is the maker based on which commission is non-zero
        // In our new system: only one user should have commission > 0 (the maker)
        let makerChatId = null;
        let makerCommissionInCES = 0;
        
        if (trade.sellerCommission > 0) {
          // Seller is the maker
          makerChatId = trade.sellerId.chatId;
          makerCommissionInCES = trade.sellerCommission / trade.pricePerToken;
          console.log(`Seller is maker - transferring commission: ${makerCommissionInCES.toFixed(4)} CES to admin wallet`);
        } else if (trade.buyerCommission > 0) {
          // Buyer is the maker (this case happens when buyer's order was created first)
          makerChatId = trade.buyerId.chatId;
          makerCommissionInCES = trade.buyerCommission / trade.pricePerToken;
          console.log(`Buyer is maker - transferring commission: ${makerCommissionInCES.toFixed(4)} CES to admin wallet`);
        }
        
        if (makerChatId && makerCommissionInCES > 0) {
          await walletService.sendCESTokens(
            makerChatId, // Maker pays commission
            '0xC2D5FABd53F537A1225460AE30097198aB14FF32', // Admin wallet address
            makerCommissionInCES
          );
          console.log(`Maker commission transfer completed successfully: ${makerCommissionInCES.toFixed(4)} CES`);
        } else {
          console.log('No commission to transfer (both users are takers)');
        }
      } catch (commissionError) {
        console.error('Error transferring commission:', commissionError);
        // Don't fail the trade if commission transfer fails
      }
      
      // Update user statistics
      await this.updateUserStats(trade.buyerId._id, trade.sellerId._id, trade.totalValue, 'completed');
      
      // Send smart notifications
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.buyerId._id, 
        trade, 
        'completed'
      );
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.sellerId._id, 
        trade, 
        'completed'
      );
      
      return trade;
      
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  // Cancel a trade
  async cancelTrade(tradeId, userChatId, reason = 'Cancelled by user') {
    try {
      console.log(`Cancelling trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        throw new Error('Сделка не найдена');
      }
      
      // Check if user is participant
      const isParticipant = trade.buyerId.chatId === userChatId || trade.sellerId.chatId === userChatId;
      if (!isParticipant) {
        throw new Error('Вы не являетесь участником этой сделки');
      }
      
      if (!['escrow_locked', 'payment_pending'].includes(trade.status)) {
        throw new Error('Нельзя отменить эту сделку');
      }
      
      // Refund tokens from escrow to seller
      await escrowService.refundTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        trade.amount,
        reason
      );
      
      // Update trade status
      trade.status = 'cancelled';
      trade.escrowStatus = 'refunded';
      trade.disputeReason = reason;
      
      await trade.save();
      
      // Update user statistics
      await this.updateUserStats(trade.buyerId._id, trade.sellerId._id, trade.totalValue, 'cancelled');
      
      // Send smart notifications
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.buyerId._id, 
        trade, 
        'cancelled'
      );
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.sellerId._id, 
        trade, 
        'cancelled'
      );
      
      console.log(`Trade ${tradeId} cancelled and refunded`);
      return trade;
      
    } catch (error) {
      console.error('Error cancelling trade:', error);
      throw error;
    }
  }

  // Create a trade with escrow for the selling flow
  async createTradeWithEscrow(tradeData) {
    try {
      const { buyerChatId, sellerChatId, cesAmount, pricePerToken, totalPrice, paymentMethod, tradeTimeLimit, orderNumber, buyOrderId } = tradeData;
      
      console.log(`Creating trade with escrow: ${cesAmount} CES for ₽${totalPrice}`);
      
      // Get buyer and seller
      const buyer = await User.findOne({ chatId: buyerChatId });
      const seller = await User.findOne({ chatId: sellerChatId });
      
      if (!buyer || !seller) {
        return { success: false, error: 'Пользователи не найдены' };
      }
      
      // Check seller's available CES balance (excluding escrowed tokens)
      const walletInfo = await walletService.getUserWallet(sellerChatId);
      if (walletInfo.cesBalance < cesAmount) {
        return { success: false, error: 'Недостаточно доступных CES для продажи. Некоторые средства могут быть заблокированы в эскроу' };
      }
      
      // Lock CES tokens in escrow
      const escrowResult = await escrowService.lockTokensInEscrow(seller._id, null, 'CES', cesAmount);
      if (!escrowResult.success) {
        return { success: false, error: 'Ошибка блокировки средств в эскроу' };
      }
      
      // Map bank codes to payment method enum values
      const paymentMethodMapping = {
        'sberbank': 'bank_transfer',
        'vtb': 'bank_transfer',
        'gazprombank': 'bank_transfer',
        'alfabank': 'bank_transfer',
        'rshb': 'bank_transfer',
        'mkb': 'bank_transfer',
        'sovcombank': 'bank_transfer',
        'tbank': 'bank_transfer',
        'domrf': 'bank_transfer',
        'otkritie': 'bank_transfer',
        'raiffeisenbank': 'bank_transfer',
        'rosbank': 'bank_transfer'
      };
      
      // Get the mapped payment method from the paymentMethod object
      let mappedPaymentMethod = 'bank_transfer'; // Default fallback
      if (paymentMethod && paymentMethod.bank) {
        mappedPaymentMethod = paymentMethodMapping[paymentMethod.bank] || 'bank_transfer';
      }
      
      // Create a temporary sell order for this trade
      const tempSellOrder = new P2POrder({
        userId: seller._id,
        type: 'sell',
        amount: cesAmount,
        pricePerToken: pricePerToken,
        totalValue: totalPrice,
        status: 'locked',
        filledAmount: cesAmount,
        remainingAmount: 0,
        escrowLocked: true,
        escrowAmount: cesAmount,
        minTradeAmount: cesAmount,
        maxTradeAmount: cesAmount,
        paymentMethods: ['bank_transfer'],
        tradeTimeLimit: tradeTimeLimit || 30
      });
      
      await tempSellOrder.save();
      const sellOrderId = tempSellOrder._id;
      
      // Use the provided buyOrderId or the temporary sell order ID as fallback
      const finalBuyOrderId = buyOrderId || sellOrderId;
      
      // Create trade record
      const trade = new P2PTrade({
        buyOrderId: finalBuyOrderId,
        sellOrderId: sellOrderId,
        buyerId: buyer._id,
        sellerId: seller._id,
        amount: cesAmount,
        pricePerToken: pricePerToken,
        totalValue: totalPrice,
        buyerCommission: 0, // Seller is maker, so buyer pays no commission
        sellerCommission: 0, // Commission is handled separately
        commission: 0, // Will be calculated later if needed
        status: 'escrow_locked',
        escrowStatus: 'locked',
        paymentMethod: mappedPaymentMethod,
        timeTracking: {
          createdAt: new Date(),
          escrowLockedAt: new Date(),
          expiresAt: new Date(Date.now() + (tradeTimeLimit || 30) * 60 * 1000)
        }
      });
      
      await trade.save();
      
      console.log(`Trade created with escrow: ${trade._id}`);
      return { success: true, tradeId: trade._id };
      
    } catch (error) {
      console.error('Error creating trade with escrow:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Mark payment as completed
  async markPaymentCompleted(tradeId, userChatId) {
    try {
      console.log(`Marking payment as completed for trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        return { success: false, error: 'Сделка не найдена' };
      }
      
      // Check if user is the seller (who marks payment as completed)
      if (trade.sellerId.chatId !== userChatId) {
        return { success: false, error: 'Только продавец может отметить платеж как выполненный' };
      }
      
      if (trade.status !== 'escrow_locked') {
        return { success: false, error: 'Нельзя отметить платеж для этой сделки' };
      }
      
      // Update trade status to payment pending confirmation
      trade.status = 'payment_pending';
      trade.timeTracking.paymentMadeAt = new Date();
      
      await trade.save();
      
      // Notify buyer about payment completion
      try {
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.buyerId._id,
          trade,
          'payment_completed'
        );
      } catch (notifyError) {
        console.log('Warning: Could not send notification');
      }
      
      console.log(`Payment marked as completed for trade ${tradeId}`);
      return { success: true };
      
    } catch (error) {
      console.error('Error marking payment as completed:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Cancel trade by user request
  async cancelTradeByUser(tradeId, userChatId) {
    try {
      console.log(`Cancelling trade ${tradeId} by user request`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        return { success: false, error: 'Сделка не найдена' };
      }
      
      // Check if user is participant
      const isParticipant = trade.buyerId.chatId === userChatId || trade.sellerId.chatId === userChatId;
      if (!isParticipant) {
        return { success: false, error: 'Вы не являетесь участником этой сделки' };
      }
      
      if (!['escrow_locked', 'payment_pending'].includes(trade.status)) {
        return { success: false, error: 'Нельзя отменить эту сделку' };
      }
      
      // Refund tokens from escrow to seller
      await escrowService.refundTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        trade.amount,
        'Отменено пользователем'
      );
      
      // Update trade status
      trade.status = 'cancelled';
      trade.escrowStatus = 'refunded';
      trade.disputeReason = 'Отменено пользователем';
      
      await trade.save();
      
      // Notify other participant
      try {
        const otherUserId = trade.buyerId.chatId === userChatId ? trade.sellerId._id : trade.buyerId._id;
        await smartNotificationService.sendSmartTradeStatusNotification(
          otherUserId,
          trade,
          'cancelled'
        );
      } catch (notifyError) {
        console.log('Warning: Could not send notification');
      }
      
      console.log(`Trade ${tradeId} cancelled by user`);
      return { success: true };
      
    } catch (error) {
      console.error('Error cancelling trade by user:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Cancel trade with timeout (automatic cancellation)
  async cancelTradeWithTimeout(tradeId) {
    try {
      console.log(`Cancelling trade ${tradeId} due to timeout`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        console.log(`Trade ${tradeId} not found for timeout cancellation`);
        return;
      }
      
      if (!['escrow_locked', 'payment_pending'].includes(trade.status)) {
        console.log(`Trade ${tradeId} cannot be cancelled (status: ${trade.status})`);
        return;
      }
      
      // Refund tokens from escrow to seller
      await escrowService.refundTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        trade.amount,
        'Время оплаты истекло'
      );
      
      // Update trade status
      trade.status = 'cancelled';
      trade.escrowStatus = 'refunded';
      trade.disputeReason = 'Время оплаты истекло';
      
      await trade.save();
      
      // Notify both participants
      try {
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.buyerId._id,
          trade,
          'timeout'
        );
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.sellerId._id,
          trade,
          'timeout'
        );
      } catch (notifyError) {
        console.log('Warning: Could not send notifications');
      }
      
      console.log(`Trade ${tradeId} cancelled due to timeout`);
      
    } catch (error) {
      console.error('Error cancelling trade with timeout:', error);
    }
  }

  // Update user trading statistics
  async updateUserStats(buyerId, sellerId, tradeValue, tradeStatus) {
    try {
      const updates = {
        $inc: {
          'tradeAnalytics.totalTrades': 1,
          'tradeAnalytics.successfulTrades': tradeStatus === 'completed' ? 1 : 0,
          'tradingVolumeLast30Days': tradeValue
        }
      };
      
      await Promise.all([
        User.findByIdAndUpdate(buyerId, updates),
        User.findByIdAndUpdate(sellerId, updates)
      ]);
      
      // Update trust scores
      await reputationService.updateRatingAfterTrade(buyerId, tradeStatus);
      await reputationService.updateRatingAfterTrade(sellerId, tradeStatus);
      
      console.log(`Updated trading stats and trust scores for users`);
      
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }
}

module.exports = new P2PService();