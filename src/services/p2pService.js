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
const antiFraudService = require('./antiFraudService');
const PrecisionUtil = require('../utils/PrecisionUtil');
const config = require('../config/configuration');

class P2PService {
  constructor() {
    this.commissionRate = 0.01; // 1% commission
    this.defaultTradeTimeout = config.escrow.timeoutMinutes; // Use configurable timeout
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
      const rubleReserveService = require('./rubleReserveService');
      const availableRubleBalance = await rubleReserveService.getAvailableBalance(user._id.toString());
      
      if (availableRubleBalance < totalValue) {
        throw new Error(`Недостаточно рублей. Доступно: ₽${availableRubleBalance.toFixed(2)}, требуется: ₽${totalValue.toFixed(2)}`);
      }
      
      // 🔍 ANTI-FRAUD: Проверка безопасности перед созданием ордера
      console.log(`🔍 [SECURITY] Проверка безопасности buy ордера для ${chatId}`);
      const securityCheck = await antiFraudService.checkOrderSecurity(chatId, {
        type: 'buy',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue
      });
      
      if (!securityCheck.allowed) {
        console.log(`❌ [SECURITY] Ордер заблокирован: ${securityCheck.reason}`);
        throw new Error(`🔒 Ордер заблокирован системой безопасности. ${securityCheck.reason}`);
      }
      
      if (securityCheck.riskLevel === 'MEDIUM') {
        console.log(`⚠️ [SECURITY] Предупреждение: ${securityCheck.reason}`);
      }
      
      // Получаем персональные настройки времени сделки пользователя
      const userTradeTimeLimit = user.p2pProfile?.tradeTimeLimit || this.defaultTradeTimeout;
      console.log(`Время сделки для пользователя ${user.chatId}: ${userTradeTimeLimit} мин.`);
      
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
        tradeTimeLimit: userTradeTimeLimit, // Персональные настройки времени
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
   * Тейкер (покупатель) выбирает ордер мейкера на продажу и создаёт сделку
   * @param {string} takerChatId - Telegram ID тейкера (покупателя CES)
   * @param {string} sellOrderId - ID ордера мейкера (продавца)
   * @param {number} cesAmount - Количество CES для покупки
   * @param {number} pricePerToken - Цена за токен
   * @returns {Promise<{success: boolean, trade?: object, seller?: object, paymentDetails?: object, timeLimit?: number, orderNumber?: string, error?: string}>}
   */
  async createTradeFromSellOrder(takerChatId, sellOrderId, cesAmount, pricePerToken) {
    try {
      console.log(`🔄 Тейкер ${takerChatId} создаёт сделку из sell-ордера ${sellOrderId} на ${cesAmount} CES`);
      
      // 🔍 Получаем sell-ордер мейкера
      const sellOrder = await P2POrder.findById(sellOrderId).populate('userId');
      if (!sellOrder || sellOrder.status !== 'active') {
        return { success: false, error: 'Ордер не найден или неактивен' };
      }
      
      if (!sellOrder.userId) {
        return { success: false, error: 'Данные продавца в ордере не найдены' };
      }
      
      // 👤 Получаем тейкера (покупателя)
      const buyer = await User.findOne({ chatId: takerChatId });
      if (!buyer) {
        return { success: false, error: 'Покупатель не найден' };
      }
      
      // ❌ Проверяем, что это не свой ордер
      if (sellOrder.userId._id.toString() === buyer._id.toString()) {
        return { success: false, error: 'Нельзя торговать со своим ордером' };
      }
      
      // 📊 Проверяем лимиты
      if (cesAmount < sellOrder.minTradeAmount || cesAmount > sellOrder.maxTradeAmount) {
        return { 
          success: false, 
          error: `Количество должно быть от ${sellOrder.minTradeAmount} до ${sellOrder.maxTradeAmount} CES` 
        };
      }
      
      // 💰 Проверяем доступность количества в ордере
      if (cesAmount > sellOrder.remainingAmount) {
        return { 
          success: false, 
          error: `Недостаточно CES в ордере. Доступно: ${sellOrder.remainingAmount} CES` 
        };
      }
      
      // 🛡️ Проверяем профиль покупателя
      if (!buyer.p2pProfile || !buyer.p2pProfile.isProfileComplete) {
        return { success: false, error: 'Заполните профиль P2P для создания сделок' };
      }
      
      // 🔐 RACE CONDITION PROTECTION: Атомарная проверка и блокировка
      const mongoose = require('mongoose');
      const session = await mongoose.startSession();
      
      try {
        let trade;
        await session.withTransaction(async () => {
          // Повторная проверка доступности ордера в транзакции
          const currentSellOrder = await P2POrder.findById(sellOrderId).session(session);
          if (!currentSellOrder || currentSellOrder.status !== 'active' || currentSellOrder.remainingAmount < cesAmount) {
            throw new Error('Ордер больше недоступен или количество CES уменьшилось');
          }
          
          // 💸 Рассчитываем стоимость
          const totalPrice = cesAmount * pricePerToken;
          
          // 📋 Получаем реквизиты продавца для оплаты
          const seller = currentSellOrder.userId;
          if (!seller.p2pProfile || !seller.p2pProfile.paymentMethods || seller.p2pProfile.paymentMethods.length === 0) {
            throw new Error('У продавца не настроены реквизиты для получения оплаты');
          }
          
          const activePaymentMethod = seller.p2pProfile.paymentMethods.find(pm => pm.isActive);
          if (!activePaymentMethod) {
            throw new Error('У продавца нет активных способов оплаты');
          }
          
          // 📦 Блокируем CES продавца в эскроу
          const escrowResult = await escrowService.lockTokensInEscrow(
            seller._id, 
            null, // tradeId будет установлен после создания сделки
            'CES', 
            cesAmount
          );
          
          if (!escrowResult.success) {
            throw new Error(`Ошибка блокировки CES в эскроу: ${escrowResult.error}`);
          }
          
          // 💳 Создаём временный buy-ордер для тейкера
          const tempBuyOrder = new P2POrder({
            userId: buyer._id,
            type: 'buy',
            amount: cesAmount,
            pricePerToken: pricePerToken,
            totalValue: totalPrice,
            status: 'locked',
            filledAmount: cesAmount,
            remainingAmount: 0,
            escrowLocked: false, // Покупатель не блокирует средства в эскроу
            minTradeAmount: cesAmount,
            maxTradeAmount: cesAmount,
            paymentMethods: ['bank_transfer'],
            tradeTimeLimit: currentSellOrder.tradeTimeLimit || 30
          });
          
          await tempBuyOrder.save({ session });
          
          // 🎯 Определяем комиссии: Мейкер (продавец) платит 1%, тейкер (покупатель) не платит
          const sellerCommission = PrecisionUtil.calculateCommission(cesAmount, this.commissionRate, 4);
          const buyerCommission = 0;
          
          // 📝 Создаём сделку
          trade = new P2PTrade({
            buyOrderId: tempBuyOrder._id,
            sellOrderId: currentSellOrder._id,
            buyerId: buyer._id, // Тейкер (покупатель)
            sellerId: seller._id, // Мейкер (продавец)
            amount: cesAmount,
            pricePerToken: pricePerToken,
            totalValue: totalPrice,
            buyerCommission: buyerCommission, // Тейкер не платит комиссию
            sellerCommission: sellerCommission, // Мейкер платит 1%
            commission: sellerCommission,
            status: 'escrow_locked',
            escrowStatus: 'locked',
            paymentMethod: 'bank_transfer',
            paymentDetails: {
              bankName: this.getBankDisplayName(activePaymentMethod.bank),
              cardNumber: activePaymentMethod.cardNumber,
              recipientName: seller.p2pProfile.fullName,
              amount: totalPrice
            },
            timeTracking: {
              createdAt: new Date(),
              escrowLockedAt: new Date(),
              expiresAt: new Date(Date.now() + (currentSellOrder.tradeTimeLimit || 30) * 60 * 1000)
            }
          });
          
          await trade.save({ session });
          
          // 📊 Обновляем количество в sell-ордере
          currentSellOrder.remainingAmount -= cesAmount;
          currentSellOrder.filledAmount = (currentSellOrder.filledAmount || 0) + cesAmount;
          
          if (currentSellOrder.remainingAmount <= 0) {
            currentSellOrder.status = 'filled';
          } else {
            currentSellOrder.status = 'partial';
          }
          
          await currentSellOrder.save({ session });
          
          // 🔗 Обновляем trade ID в эскроу
          await escrowService.updateEscrowTradeId(seller._id, 'CES', cesAmount, trade._id);
        });
        
        await session.endSession();
        
        // 📨 Уведомляем продавца о новой сделке
        const orderNumber = `CES${Date.now().toString().slice(-8)}`;
        const seller = sellOrder.userId;
        
        try {
          const botInstance = require('../bot/telegramBot');
          const bot = botInstance.getInstance();
          
          const sellerMessage = `💰 НОВАЯ СДЕЛКА\n` +
                               `➖➖➖➖➖➖➖➖➖➖➖\n` +
                               `Ордер: ${orderNumber}\n` +
                               `Покупатель: ${buyer.p2pProfile?.fullName || buyer.firstName || 'Пользователь'}\n` +
                               `Количество: ${cesAmount} CES\n` +
                               `Сумма: ${(cesAmount * pricePerToken).toFixed(2)} ₽\n\n` +
                               `🔒 Ваши CES заморожены в эскроу.\n` +
                               `Ожидайте платёж от покупателя.\n\n` +
                               `⏰ Время на оплату: ${sellOrder.tradeTimeLimit || 30} мин.`;
          
          await bot.telegram.sendMessage(seller.chatId, sellerMessage);
          console.log(`✅ Уведомление отправлено продавцу ${seller.chatId}`);
        } catch (notifyError) {
          console.error('⚠️ Ошибка уведомления продавца:', notifyError);
        }
        
        console.log(`✅ Сделка успешно создана: ${trade._id}`);
        return {
          success: true,
          trade: trade,
          seller: seller,
          paymentDetails: trade.paymentDetails,
          timeLimit: sellOrder.tradeTimeLimit || 30,
          orderNumber: orderNumber
        };
        
      } catch (transactionError) {
        await session.endSession();
        console.error('❌ Ошибка транзакции создания сделки:', transactionError);
        return { success: false, error: transactionError.message };
      }
      
    } catch (error) {
      console.error('❌ Ошибка создания сделки из sell-ордера:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 💰 СОЗДАНИЕ СДЕЛКИ ИЗ SELL-ОРДЕРА С ВЫБРАННЫМ БАНКОМ (БЕЗ ПОВТОРНОГО БЛОКИРОВАНИЯ)
   * Тейкер (покупатель) выбирает банк и создаёт сделку из sell-ордера мейкера
   * @param {string} takerChatId - Telegram ID тейкера (покупателя CES)
   * @param {string} sellOrderId - ID ордера мейкера (продавца)
   * @param {number} cesAmount - Количество CES для покупки
   * @param {number} pricePerToken - Цена за токен
   * @param {object} selectedPaymentMethod - Выбранный способ оплаты
   * @returns {Promise<{success: boolean, trade?: object, seller?: object, paymentDetails?: object, timeLimit?: number, orderNumber?: string, error?: string}>}
   */
  async createTradeFromSellOrderWithBank(takerChatId, sellOrderId, cesAmount, pricePerToken, selectedPaymentMethod) {
    try {
      console.log(`🔄 Тейкер ${takerChatId} создаёт сделку из sell-ордера ${sellOrderId} на ${cesAmount} CES с банком ${selectedPaymentMethod.bank}`);
      
      // 🧑‍💼 ПОЛУЧАЕМ ПОЛЬЗОВАТЕЛЕЙ
      const { User } = require('../database/models');
      const buyer = await User.findOne({ chatId: takerChatId });
      if (!buyer) {
        return { success: false, error: 'Покупатель не найден' };
      }
      
      // 📋 ПОЛУЧАЕМ SELL-ОРДЕР И ПРОДАВЦА
      const sellOrder = await P2POrder.findById(sellOrderId).populate('userId');
      if (!sellOrder || sellOrder.type !== 'sell') {
        return { success: false, error: 'Sell-ордер не найден' };
      }
      
      if (sellOrder.remainingAmount < cesAmount) {
        return { 
          success: false, 
          error: `Недостаточно CES в ордере. Доступно: ${sellOrder.remainingAmount} CES` 
        };
      }
      
      // 🛡️ ПРОВЕРЯЕМ ПРОФИЛЬ ПОКУПАТЕЛЯ
      if (!buyer.p2pProfile || !buyer.p2pProfile.isProfileComplete) {
        return { success: false, error: 'Заполните профиль P2P для создания сделок' };
      }
      
      // 🔐 RACE CONDITION PROTECTION: Атомарная проверка БЕЗ блокирования
      const mongoose = require('mongoose');
      const session = await mongoose.startSession();
      
      try {
        let trade;
        await session.withTransaction(async () => {
          // Повторная проверка доступности ордера в транзакции
          const currentSellOrder = await P2POrder.findById(sellOrderId).session(session);
          if (!currentSellOrder || currentSellOrder.status !== 'active' || currentSellOrder.remainingAmount < cesAmount) {
            throw new Error('Ордер больше недоступен или количество CES уменьшилось');
          }
          
          // 💸 Рассчитываем стоимость
          const totalPrice = cesAmount * pricePerToken;
          
          // 📋 Получаем продавца и его реквизиты
          const seller = currentSellOrder.userId;
          if (!seller.p2pProfile || !seller.p2pProfile.paymentMethods || seller.p2pProfile.paymentMethods.length === 0) {
            throw new Error('У продавца не настроены реквизиты для получения оплаты');
          }
          
          // Проверяем, что выбранный способ оплаты доступен
          const activePaymentMethod = seller.p2pProfile.paymentMethods.find(
            pm => pm.bank === selectedPaymentMethod.bank && pm.isActive
          );
          
          if (!activePaymentMethod) {
            throw new Error('Выбранный способ оплаты больше не доступен');
          }
          
          // ⚠️ ВАЖНО: НЕ БЛОКИРУЕМ CES - они уже заблокированы при создании sell-ордера!
          
          // 📝 Создаём временный buy-ордер для тейкера
          const tempBuyOrder = new P2POrder({
            userId: buyer._id,
            type: 'buy',
            amount: cesAmount,
            pricePerToken: pricePerToken,
            totalValue: totalPrice,
            status: 'locked',
            filledAmount: cesAmount,
            remainingAmount: 0,
            escrowLocked: false, // Покупатель не блокирует средства в эскроу
            minTradeAmount: cesAmount,
            maxTradeAmount: cesAmount,
            paymentMethods: ['bank_transfer'],
            tradeTimeLimit: currentSellOrder.tradeTimeLimit || 30
          });
          
          await tempBuyOrder.save({ session });
          
          // 🎯 Определяем комиссии: Мейкер (продавец) платит 1%, тейкер (покупатель) не платит
          const buyerCommission = 0;
          const sellerCommission = cesAmount * 0.01; // 1% комиссия с мейкера
          
          // 📝 Создаём сделку
          trade = new P2PTrade({
            buyOrderId: tempBuyOrder._id,
            sellOrderId: currentSellOrder._id,
            buyerId: buyer._id, // Тейкер (покупатель)
            sellerId: seller._id, // Мейкер (продавец)
            amount: cesAmount,
            pricePerToken: pricePerToken,
            totalValue: totalPrice,
            buyerCommission: buyerCommission, // Тейкер не платит комиссию
            sellerCommission: sellerCommission, // Мейкер платит 1%
            commission: sellerCommission,
            status: 'escrow_locked',
            escrowStatus: 'locked',
            paymentMethod: 'bank_transfer',
            paymentDetails: {
              bankName: this.getBankDisplayName(activePaymentMethod.bank),
              cardNumber: activePaymentMethod.cardNumber,
              recipientName: seller.p2pProfile.fullName,
              amount: totalPrice
            },
            timeTracking: {
              createdAt: new Date(),
              escrowLockedAt: new Date(),
              expiresAt: new Date(Date.now() + (currentSellOrder.tradeTimeLimit || 30) * 60 * 1000)
            }
          });
          
          await trade.save({ session });
          
          // 📊 Обновляем количество в sell-ордере
          currentSellOrder.remainingAmount -= cesAmount;
          currentSellOrder.filledAmount += cesAmount;
          
          if (currentSellOrder.remainingAmount <= 0) {
            currentSellOrder.status = 'filled';
          }
          
          await currentSellOrder.save({ session });
        });
        
        // 🏆 Генерируем номер ордера
        const orderNumber = `CES${Date.now().toString().slice(-8)}`;
        
        return {
          success: true,
          trade: trade,
          seller: sellOrder.userId,
          paymentDetails: {
            bankName: this.getBankDisplayName(selectedPaymentMethod.bank),
            cardNumber: selectedPaymentMethod.cardNumber,
            recipientName: sellOrder.userId.p2pProfile.fullName
          },
          timeLimit: sellOrder.tradeTimeLimit || 30,
          orderNumber: orderNumber
        };
        
      } finally {
        await session.endSession();
      }
      
    } catch (error) {
      console.error('❌ Ошибка создания сделки из sell-ордера с банком:', error);
      return { success: false, error: error.message };
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
      
      // Add null check for buyOrder.userId
      if (!buyOrder.userId) {
        return { success: false, error: 'Данные пользователя в ордере не найдены' };
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
      
      // Проверяем баланс тейкера
      if (taker.balance < buyOrder.pricePerUnit * cesAmount) {
        return { success: false, error: 'Недостаточно средств для совершения сделки' };
      }
      
      if (cesAmount > buyOrder.remainingAmount) {
        return { 
          success: false, 
          error: `Недостаточно CES в ордере. Доступно: ${buyOrder.remainingAmount} CES` 
        };
      }
      
      // Проверяем доступный баланс CES у тейкера (исключая эскроу)
      const walletInfo = await walletService.getUserWallet(taker.chatId);
      
      // Тейкер не платит комиссию, проверяем только наличие суммы для продажи
      if (walletInfo.cesBalance < cesAmount) {
        return { 
          success: false, 
          error: `Недостаточно доступных CES. Доступно: ${walletInfo.cesBalance.toFixed(4)} CES, требуется: ${cesAmount.toFixed(4)} CES` 
        };
      }

      // Проверяем доступный баланс токена у мейкера (исключая эскроу)
      const makerWalletInfo = await walletService.getUserWallet(maker.chatId);
      if (makerWalletInfo[tokenSymbol].balance < tokenAmount) {
        return { 
          success: false, 
          error: `Недостаточно доступного токена ${tokenSymbol}. Достаточно: ${makerWalletInfo[tokenSymbol].balance.toFixed(4)} ${tokenSymbol}` 
        };
      }
      
      // Проверяем, что тейкер не является мейкером
      if (taker.chatId === maker.chatId) {
        return { 
          success: false, 
          error: `Тейкер и мейкер не могут быть одним и тем же пользователем` 
        };
      }
      
      // Проверяем, что токен существует
      const token = await tokenService.getTokenBySymbol(tokenSymbol);
      if (!token) {
        return { 
          success: false, 
          error: `Токен с символом ${tokenSymbol} не существует` 
        };
      }
      
      // Проверяем, что ордер активен
      if (buyOrder.status !== 'active') {
        return { 
          success: false, 
          error: 'Ордер неактивен' 
        };
      }
      
      // Проверяем, что цена ордера соответствует текущей цене
      if (buyOrder.price !== price) {
        return { 
          success: false, 
          error: `Цена ордера (${buyOrder.price}) не соответствует текущей цене (${price})` 
        };
      }
      
      // Выполняем транзакцию
      try {
        await walletService.transferCes(taker.chatId, maker.chatId, cesAmount);
        await walletService.transferToken(maker.chatId, taker.chatId, tokenSymbol, tokenAmount);
        buyOrder.remainingAmount = 0;
        buyOrder.status = 'filled';
        await buyOrder.save();
      } catch (error) {
        return { 
          success: false, 
          error: `Ошибка при выполнении транзакции: ${error.message}` 
        };
      }
      
      // Проверяем профиль тейкера
      if (!taker.p2pProfile || !taker.p2pProfile.isProfileComplete) {
        return { success: false, error: 'Заполните профиль P2P для создания сделок' };
      }
      
      // 🔧 FIX BUG #2: Race condition protection - recheck order availability
      const currentBuyOrder = await P2POrder.findById(buyOrderId);
      if (!currentBuyOrder || currentBuyOrder.status !== 'active' || currentBuyOrder.remainingAmount < cesAmount) {
        // Release already locked escrow
        await escrowService.refundTokensFromEscrow(taker._id, null, 'CES', cesAmount, 'Order no longer available');
        return { 
          success: false, 
          error: 'Ордер больше не доступен или недостаточно количества CES' 
        };
      }
      
      // Now safely lock tokens in escrow after race condition check
      const escrowResult = await escrowService.lockTokensInEscrow(taker._id, null, 'CES', cesAmount);
      if (!escrowResult.success) {
        return { success: false, error: 'Ошибка блокировки CES в эскроу' };
      }
      
      const totalPrice = cesAmount * buyOrder.pricePerToken;
      
      // 🔧 FIX BUG #1 & #7: Standardized commission logic with precision handling
      const buyerCommission = PrecisionUtil.calculateCommission(cesAmount, this.commissionRate, 4); // 1% commission from maker (buyer)
      const sellerCommission = 0; // Taker (seller) pays no commission
      
      console.log(`💰 Commission calculation: Buyer (maker) pays ${buyerCommission.toFixed(4)} CES commission, Seller (taker) pays nothing`);
      
      // Convert commission to ruble equivalent for display
      const buyerCommissionInRubles = PrecisionUtil.cesCommissionToRubles(buyerCommission, buyOrder.pricePerToken, 2);
      
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
      
      // 🔧 FIX BUG #3: Create proper temporary sell order instead of reusing buy order ID
      const tempSellOrder = new P2POrder({
        userId: taker._id,
        type: 'sell',
        amount: cesAmount,
        pricePerToken: buyOrder.pricePerToken,
        totalValue: totalPrice,
        status: 'locked', // Special status for temporary order
        filledAmount: cesAmount,
        remainingAmount: 0,
        escrowLocked: true,
        escrowAmount: cesAmount,
        minTradeAmount: cesAmount,
        maxTradeAmount: cesAmount,
        paymentMethods: taker.p2pProfile.paymentMethods?.map(pm => pm.bank) || ['bank_transfer'],
        tradeTimeLimit: buyOrder.tradeTimeLimit || 30
      });
      
      await tempSellOrder.save();
      
      // Создаём сделку
      const trade = new P2PTrade({
        buyOrderId: buyOrder._id,
        sellOrderId: tempSellOrder._id, // ✅ FIXED: Use actual sell order ID
        buyerId: buyOrder.userId._id, // Мейкер (покупатель)
        sellerId: taker._id, // Тейкер (продавец)
        amount: cesAmount,
        pricePerToken: buyOrder.pricePerToken,
        totalValue: totalPrice,
        buyerCommission: buyerCommission, // Комиссия с мейкера (покупателя)
        sellerCommission: sellerCommission, // Тейкер не платит комиссию
        commission: buyerCommission, // Total commission equals maker commission
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
      
      // 🔧 FIX BUG #4: Add atomic transaction handling for order updates
      const mongoose = require('mongoose');
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Update order amounts atomically
          const orderUpdateResult = await P2POrder.findByIdAndUpdate(
            buyOrder._id,
            {
              $inc: {
                filledAmount: cesAmount,
                remainingAmount: -cesAmount
              },
              $set: {
                status: buyOrder.remainingAmount - cesAmount <= 0 ? 'completed' : 'partial',
                updatedAt: new Date()
              }
            },
            { session, new: true }
          );
          
          if (!orderUpdateResult) {
            throw new Error('Ошибка обновления ордера');
          }
          
          // Save trade within the same transaction
          await trade.save({ session });
          await tempSellOrder.save({ session });
        });
      } catch (transactionError) {
        console.error('❌ Transaction failed:', transactionError);
        // Rollback escrow on transaction failure
        await escrowService.refundTokensFromEscrow(taker._id, null, 'CES', cesAmount, 'Transaction failed');
        await rubleReserveService.releaseTradeReserve(buyOrder.userId._id.toString(), null, totalPrice);
        throw transactionError;
      } finally {
        await session.endSession();
      }
      
      // 🔧 FIX BUG #6: Enhanced escrow linking with better error handling
      try {
        await escrowService.linkEscrowToTrade(taker._id, trade._id, 'CES', cesAmount);
        console.log(`✅ Successfully linked escrow to trade ${trade._id}`);
      } catch (linkError) {
        console.error('⚠️ Failed to link escrow to trade:', linkError);
        // This is not critical - trade can continue but we should monitor orphaned escrows
        // The escrow cleanup service will handle this automatically
      }
      
      // Handle remaining order reserve if order is completed
      if (buyOrder.remainingAmount - cesAmount <= 0) {
        try {
          await rubleReserveService.releaseOrderReserve(
            buyOrder.userId._id.toString(),
            buyOrder._id.toString()
          );
          console.log('✅ Released remaining order reserve');
        } catch (reserveError) {
          console.error('⚠️ Failed to release order reserve:', reserveError);
          // Non-critical error - reserve cleanup service will handle this
        }
      }
      
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
      
      // Accept both escrow_locked and payment_pending statuses
      if (!['escrow_locked', 'payment_pending'].includes(trade.status)) {
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
      
      // Проверяем лимит: только 1 активный ордер на продажу на пользователя
      const existingSellOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'sell',
        status: { $in: ['active', 'partial'] }
      });
      
      if (existingSellOrder) {
        throw new Error('У вас уже есть активный ордер на продажу. Отмените существующий ордер для создания нового.');
      }
      
      // Check available CES balance (excluding escrowed tokens)
      const walletInfo = await walletService.getUserWallet(user.chatId);
      
      // Проверяем, что у пользователя достаточно средств для продажи
      // Комиссия 1% берется с мейкера при исполнении ордера, а не при его создании
      if (walletInfo.cesBalance < amount) {
        console.log(`Insufficient available CES balance: ${walletInfo.cesBalance} < ${amount}`);
        throw new Error(`Недостаточно CES токенов для создания ордера. Доступно: ${walletInfo.cesBalance.toFixed(4)} CES, требуется: ${amount.toFixed(4)} CES`);
      }

      // 🔧 ИСПРАВЛЕНИЕ: Проверяем на существование других активных sell ордеров
      const activeSellOrders = await P2POrder.find({
        userId: user._id,
        type: 'sell',
        status: { $in: ['active', 'partial'] }
      });
      
      let totalEscrowedAmount = 0;
      activeSellOrders.forEach(order => {
        if (order.escrowLocked && order.escrowAmount > 0) {
          totalEscrowedAmount += order.escrowAmount;
        }
      });
      
      // Проверяем, что у пользователя достаточно средств для нового эскроу
      const totalRequired = totalEscrowedAmount + amount;
      
      if (totalRequired > walletInfo.cesBalance + (user.escrowCESBalance || 0)) {
        throw new Error(`Недостаточно CES для создания нового ордера. Общий баланс: ${(walletInfo.cesBalance + (user.escrowCESBalance || 0)).toFixed(4)} CES, требуется: ${totalRequired.toFixed(4)} CES`);
      }
      
      console.log(`✅ Escrow validation passed: Total will be ${totalRequired.toFixed(4)} CES`);
      
      // Calculate total value before using it
      const totalValue = amount * pricePerToken;
      console.log(`Total order value: ₽${totalValue.toFixed(2)}`);
      
      // 🔍 ANTI-FRAUD: Проверка безопасности перед созданием ордера
      console.log(`🔍 [SECURITY] Проверка безопасности sell ордера для ${chatId}`);
      const securityCheck = await antiFraudService.checkOrderSecurity(chatId, {
        type: 'sell',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue
      });
      
      if (!securityCheck.allowed) {
        console.log(`❌ [SECURITY] Ордер заблокирован: ${securityCheck.reason}`);
        throw new Error(`🔒 Ордер заблокирован системой безопасности. ${securityCheck.reason}`);
      }
      
      if (securityCheck.riskLevel === 'MEDIUM') {
        console.log(`⚠️ [SECURITY] Предупреждение: ${securityCheck.reason}`);
      }
      
      // Lock tokens in escrow before creating order
      console.log(`Locking ${amount} CES in escrow`);
      await escrowService.lockTokensInEscrow(user._id, null, 'CES', amount);
      
      // Получаем персональные настройки времени сделки пользователя
      const userTradeTimeLimit = user.p2pProfile?.tradeTimeLimit || this.defaultTradeTimeout;
      console.log(`Время сделки для пользователя ${user.chatId}: ${userTradeTimeLimit} мин.`);
      
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
        tradeTimeLimit: userTradeTimeLimit, // Персональные настройки времени
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
        // Add null check for buyOrder.userId
        if (!buyOrder.userId) {
          console.log('⚠️ Skipping buy order with missing user data');
          continue;
        }
        
        for (const sellOrder of sellOrders) {
          // Add null check for sellOrder.userId
          if (!sellOrder.userId) {
            console.log('⚠️ Skipping sell order with missing user data');
            continue;
          }
          
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
            
            // Define tradePrice before it's used
            const tradePrice = sellOrder.pricePerToken;
            
            // 🔧 FIX BUG #8: Enhanced trading limit validation
            const tradeValue = PrecisionUtil.multiply(tradeAmount, tradePrice, 2);
            
            // Check user trading limits more thoroughly
            const buyerLimitCheck = this.checkEnhancedTradeLimits(buyOrder.userId, tradeAmount, tradeValue, 'buy');
            const sellerLimitCheck = this.checkEnhancedTradeLimits(sellOrder.userId, tradeAmount, tradeValue, 'sell');
            
            if (!buyerLimitCheck.allowed || !sellerLimitCheck.allowed) {
              console.log(`⚠️ Trading limits exceeded: Buyer - ${buyerLimitCheck.reason}, Seller - ${sellerLimitCheck.reason}`);
              continue; // Skip this pair and try next
            }
            
            // 🔧 FIX BUG #10: Enhanced payment method compatibility check
            const paymentMethodCompatible = this.checkPaymentMethodCompatibility(buyOrder, sellOrder);
            if (!paymentMethodCompatible.compatible) {
              console.log(`⚠️ Payment methods incompatible: ${paymentMethodCompatible.reason}`);
              continue; // Skip this pair and try next
            }
            
            // Use seller's price for the trade (already defined above)
            // const tradePrice = sellOrder.pricePerToken;  // REMOVED - already defined above
            const totalValue = tradeAmount * tradePrice;
            
            // 🔧 FIX BUG #1: Standardized commission logic across all trade creation paths
            // Use consistent maker/taker identification based on order creation time
            const buyOrderTime = new Date(buyOrder.createdAt).getTime();
            const sellOrderTime = new Date(sellOrder.createdAt).getTime();
            
            let buyerCommissionInRubles = 0;
            let sellerCommissionInRubles = 0;
            let makerCommissionInCES = 0;
            
            if (buyOrderTime < sellOrderTime) {
              // Buy order was created first → Buyer is MAKER, Seller is TAKER
              makerCommissionInCES = PrecisionUtil.calculateCommission(tradeAmount, this.commissionRate, 4); // 1% from buyer (maker)
              buyerCommissionInRubles = PrecisionUtil.cesCommissionToRubles(makerCommissionInCES, tradePrice, 2);
              sellerCommissionInRubles = 0; // Seller (taker) pays nothing
              console.log(`🔑 Buy order is maker (${new Date(buyOrder.createdAt).toISOString()}) vs sell order taker (${new Date(sellOrder.createdAt).toISOString()})`);
            } else {
              // Sell order was created first → Seller is MAKER, Buyer is TAKER  
              makerCommissionInCES = PrecisionUtil.calculateCommission(tradeAmount, this.commissionRate, 4); // 1% from seller (maker)
              sellerCommissionInRubles = PrecisionUtil.cesCommissionToRubles(makerCommissionInCES, tradePrice, 2);
              buyerCommissionInRubles = 0; // Buyer (taker) pays nothing
              console.log(`🔑 Sell order is maker (${new Date(sellOrder.createdAt).toISOString()}) vs buy order taker (${new Date(buyOrder.createdAt).toISOString()})`);
            }
            
            // 🔧 FIX BUG #2: Race condition protection in order matching
            // Double-check order availability before executing trade
            const currentBuyOrder = await P2POrder.findById(buyOrder._id);
            const currentSellOrder = await P2POrder.findById(sellOrder._id);
            
            if (!currentBuyOrder || !currentSellOrder || 
                currentBuyOrder.status !== 'active' || currentSellOrder.status !== 'active' ||
                currentBuyOrder.remainingAmount < tradeAmount || currentSellOrder.remainingAmount < tradeAmount) {
              console.log('⚠️ Orders no longer available for matching, skipping...');
              continue; // Skip this pair and try next
            }
            
            console.log(`💰 Executing trade: ${tradeAmount} CES at ₽${tradePrice} (maker commission: ${makerCommissionInCES.toFixed(4)} CES = ₽${Math.max(buyerCommissionInRubles, sellerCommissionInRubles).toFixed(2)}, taker commission: ₽0)`);
            
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
            
            // 🔧 FIX BUG #4: Atomic order updates to prevent inconsistent state
            const mongoose = require('mongoose');
            const session = await mongoose.startSession();
            
            try {
              await session.withTransaction(async () => {
                // Update both orders atomically
                await P2POrder.findByIdAndUpdate(
                  buyOrder._id,
                  {
                    $inc: { remainingAmount: -tradeAmount, filledAmount: tradeAmount },
                    $set: { 
                      status: buyOrder.remainingAmount - tradeAmount === 0 ? 'completed' : 'partial',
                      updatedAt: new Date()
                    }
                  },
                  { session }
                );
                
                await P2POrder.findByIdAndUpdate(
                  sellOrder._id,
                  {
                    $inc: { remainingAmount: -tradeAmount, filledAmount: tradeAmount },
                    $set: { 
                      status: sellOrder.remainingAmount - tradeAmount === 0 ? 'completed' : 'partial',
                      updatedAt: new Date()
                    }
                  },
                  { session }
                );
              });
            } catch (updateError) {
              console.error('❌ Failed to update orders atomically:', updateError);
              // The trade execution already happened, but order states may be inconsistent
              // The cleanup service will handle this
            } finally {
              await session.endSession();
            }
            
            // Update local order objects for loop continuation logic
            buyOrder.remainingAmount -= tradeAmount;
            buyOrder.filledAmount += tradeAmount;
            sellOrder.remainingAmount -= tradeAmount;
            sellOrder.filledAmount += tradeAmount;
            
            console.log(`✅ Trade executed successfully between ${buyOrder._id} and ${sellOrder._id}`);
            
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

  // 🔧 FIX BUG #8: Enhanced user trade limits validation
  checkEnhancedTradeLimits(user, cesAmount, rubleValue, orderType) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Check verification level requirements for high-value trades
      if (rubleValue > 50000 && (!user.verificationLevel || user.verificationLevel === 'unverified')) {
        return { allowed: false, reason: 'Требуется верификация для сделок свыше ₽50,000' };
      }
      
      // Check trust score requirements for very large trades
      const trustScore = user.trustScore || 5.0; // Default to good score if not set
      if (rubleValue > 100000 && trustScore < 4.0) {
        return { allowed: false, reason: 'Низкий рейтинг доверия для крупных сделок' };
      }
      
      // Check if user has too many failed trades recently
      const recentFailures = user.tradeAnalytics?.failedTradesLast30Days || 0;
      if (recentFailures > 10) { // Increased threshold to be less restrictive
        return { allowed: false, reason: 'Слишком много неудачных сделок' };
      }
      
      // Check daily limits if configured
      if (user.tradingLimits && user.tradingLimits.dailyLimit && user.tradingLimits.dailyLimit > 0) {
        const dailyLimit = user.tradingLimits.dailyLimit;
        if (rubleValue > dailyLimit) {
          return { allowed: false, reason: 'Превышен дневной лимит' };
        }
      }
      
      // Check single trade limit if configured
      if (user.tradingLimits && user.tradingLimits.maxSingleTrade && user.tradingLimits.maxSingleTrade > 0) {
        if (cesAmount > user.tradingLimits.maxSingleTrade) {
          return { allowed: false, reason: 'Превышен лимит одной сделки' };
        }
      }
      
      // All checks passed
      return { allowed: true };
    } catch (error) {
      console.error('Error checking enhanced trade limits:', error);
      return { allowed: true }; // Allow trade if there's an error to avoid blocking
    }
  }
  
  // 🔧 FIX BUG #10: Enhanced payment method compatibility check
  checkPaymentMethodCompatibility(buyOrder, sellOrder) {
    try {
      // If no payment methods specified, assume compatible
      if (!buyOrder.paymentMethods || !sellOrder.paymentMethods) {
        return { compatible: true };
      }
      
      // Check for exact matches
      const compatibleMethods = buyOrder.paymentMethods.filter(method => 
        sellOrder.paymentMethods.includes(method)
      );
      
      if (compatibleMethods.length === 0) {
        return { 
          compatible: false, 
          reason: 'Несовместимые способы оплаты' 
        };
      }
      
      // Additional business logic checks
      // For example, some payment methods might have additional requirements
      
      return { compatible: true, methods: compatibleMethods };
    } catch (error) {
      console.error('Error checking payment method compatibility:', error);
      return { compatible: true }; // Default to compatible if error
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
          status: { $in: ['active', 'partial'] },
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
          status: { $in: ['active', 'partial'] },
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
          status: { $in: ['active', 'partial'] },
          remainingAmount: { $gt: 0 }
        }),
        P2POrder.countDocuments({ 
          type: 'sell', 
          status: { $in: ['active', 'partial'] },
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
      
      // If it's a sell order with tokens locked in escrow, release them
      if (order.type === 'sell' && order.escrowLocked && order.escrowAmount > 0) {
        console.log(`🔓 Releasing ${order.escrowAmount} CES from escrow for cancelled sell order ${orderId}`);
        
        try {
          await escrowService.refundTokensFromEscrow(
            user._id,
            null, // No trade ID for order cancellation
            'CES',
            order.escrowAmount,
            'Sell order cancelled by maker'
          );
          
          console.log(`✅ Successfully released ${order.escrowAmount} CES from escrow`);
        } catch (escrowError) {
          console.error('Error releasing escrow during order cancellation:', escrowError);
          // Continue with order cancellation even if escrow release fails
          // Log the error for manual intervention
          console.error(`⚠️ MANUAL INTERVENTION REQUIRED: Failed to release ${order.escrowAmount} CES from escrow for order ${orderId}`);
        }
      }
      
      // Release ruble reserves for buy orders
      if (order.type === 'buy') {
        try {
          const rubleReserveService = require('./rubleReserveService');
          await rubleReserveService.releaseOrderReserve(
            user._id.toString(),
            orderId
          );
          console.log(`✅ Released ruble reserves for cancelled buy order ${orderId}`);
        } catch (reserveError) {
          console.error('Error releasing ruble reserves during order cancellation:', reserveError);
        }
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
        // Add null checks for buyerId and sellerId
        if (trade.buyerId && trade.sellerId) {
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
        } else {
          console.log('⚠️ Skipping timeout notifications due to missing buyerId or sellerId');
        }
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
        return { success: false, error: 'Сделка не найдена' };
      }
      
      // Add null checks for buyerId and sellerId
      if (!trade.buyerId || !trade.sellerId) {
        return { success: false, error: 'Данные пользователей в сделке не найдены' };
      }
      
      // Check if user is the seller (who marks payment as completed)
      if (trade.sellerId.chatId !== userChatId) {
        return { success: false, error: 'Только продавец может отметить платеж как выполненный' };
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
      trade.escrowStatus = 'returned';
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
      
      // Check if both users have wallets
      if (!buyer.walletAddress) {
        return { success: false, error: 'У покупателя не создан кошелек. Попросите его создать кошелек сначала.' };
      }
      
      if (!seller.walletAddress) {
        return { success: false, error: 'У продавца не создан кошелек. Необходимо создать кошелек сначала.' };
      }
      
      // Check seller's available CES balance (excluding escrowed tokens)
      const walletInfo = await walletService.getUserWallet(sellerChatId);
      if (walletInfo.cesBalance < cesAmount) {
        return { success: false, error: 'Недостаточно доступных CES для продажи. Некоторые средства могут быть заблокированы в эскроу' };
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
        status: 'escrow_locked', // Исправлено: используем допустимое значение
        escrowStatus: 'locked', // Исправлено: используем допустимое значение
        paymentMethod: mappedPaymentMethod,
        timeTracking: {
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + (tradeTimeLimit || 30) * 60 * 1000)
        }
      });
      
      await trade.save();
      
      // Now lock CES tokens in escrow with the trade ID
      const escrowResult = await escrowService.lockTokensInEscrow(seller._id, trade._id, 'CES', cesAmount);
      if (!escrowResult.success) {
        // Rollback trade creation
        await P2PTrade.findByIdAndDelete(trade._id);
        await P2POrder.findByIdAndDelete(tempSellOrder._id);
        return { success: false, error: 'Ошибка блокировки средств в эскроу' };
      }
      
      // Update escrow locked timestamp after successful escrow
      trade.timeTracking.escrowLockedAt = new Date();
      await trade.save();
      
      console.log(`Trade created with escrow: ${trade._id}`);
      return { success: true, tradeId: trade._id };
      
    } catch (error) {
      console.error('Error creating trade with escrow:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Confirm payment received by seller
  async confirmPaymentReceived(tradeId, sellerChatId) {
    try {
      console.log(`Confirming payment received for trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        return { success: false, error: 'Сделка не найдена' };
      }
      
      // Check if user is the seller
      if (trade.sellerId.chatId !== sellerChatId) {
        return { success: false, error: 'Только продавец может подтвердить получение платежа' };
      }
      
      if (!['escrow_locked', 'payment_pending', 'payment_made'].includes(trade.status)) {
        return { success: false, error: 'Нельзя подтвердить платёж для этой сделки' };
      }
      
      // Release tokens from escrow to buyer
      const escrowService = require('./escrowService');
      await escrowService.releaseTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        trade.amount,
        trade.buyerId._id
      );
      
      // Update trade status to completed
      trade.status = 'completed';
      trade.escrowStatus = 'released';
      trade.timeTracking.paymentConfirmedAt = new Date();
      trade.timeTracking.completedAt = new Date();
      
      await trade.save();
      
      // Notify buyer about completion
      try {
        const botInstance = require('../bot/telegramBot');
        const bot = botInstance.getInstance();
        const buyerMessage = `✅ СДЕЛКА ЗАВЕРШЕНА!

` +
                             `Продавец подтвердил получение платежа.
` +
                             `${trade.amount} CES переданы на ваш кошелёк!

` +
                             `Спасибо за использование P2P биржи !`;
        
        await bot.telegram.sendMessage(trade.buyerId.chatId, buyerMessage);
        console.log(`✅ Completion notification sent to buyer ${trade.buyerId.chatId}`);
      } catch (notifyError) {
        console.error('⚠️ Failed to notify buyer about completion:', notifyError);
      }
      
      console.log(`Payment confirmed for trade ${tradeId}`);
      return { success: true };
      
    } catch (error) {
      console.error('Error confirming payment received:', error);
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
  
  // Cancel trade by user request with enhanced safety
  async cancelTradeByUser(tradeId, userChatId) {
    try {
      console.log(`🛡️ [ENHANCED] Starting safe trade cancellation: ${tradeId}`);
      
      // Use enhanced safety system for trade cancellation
      const escrowSafetySystem = require('./escrowSafetySystem');
      const result = await escrowSafetySystem.safeCancelTrade(
        tradeId, 
        'Отменено пользователем', 
        userChatId
      );
      
      if (result.success) {
        const trade = result.trade;
        
        // Add null check for trade
        if (!trade) {
          console.log('⚠️ Trade data not available in cancellation result');
          return { success: false, error: 'Данные сделки не найдены' };
        }
        
        // Send notifications to both participants
        try {
          const smartNotificationService = require('./smartNotificationService');
          // Add null checks for buyerId and sellerId
          if (trade.buyerId && trade.sellerId) {
            const otherUserId = trade.buyerId.chatId === userChatId ? trade.sellerId._id : trade.buyerId._id;
            
            await smartNotificationService.sendSmartTradeStatusNotification(
              otherUserId,
              trade,
              'cancelled'
            );
          } else {
            console.log('⚠️ Skipping notifications due to missing buyerId or sellerId');
          }
        } catch (notifyError) {
          console.log('Warning: Could not send notification');
        }
        
        // Validate seller balance after cancellation
        try {
          const balanceValidationService = require('./balanceValidationService');
          // Add null check for sellerId
          if (trade.sellerId) {
            await balanceValidationService.validateAfterEscrowOperation(
              trade.sellerId._id,
              'cancel_trade',
              trade.amount,
              'CES'
            );
          } else {
            console.log('⚠️ Skipping balance validation due to missing sellerId');
          }
        } catch (validationError) {
          console.warn('⚠️ Balance validation after trade cancellation failed:', validationError.message);
        }
        
        console.log(`✅ [ENHANCED] Trade ${tradeId} cancelled safely by user`);
        return { success: true };
      } else {
        console.error(`❌ [ENHANCED] Trade cancellation failed: ${result.error}`);
        return result; // Return the error details from safety system
      }
      
    } catch (error) {
      console.error('Error in enhanced trade cancellation:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Cancel trade with timeout (automatic cancellation) with enhanced safety
  async cancelTradeWithTimeout(tradeId) {
    try {
      console.log(`🛡️ [ENHANCED] Cancelling trade ${tradeId} due to timeout with safety checks`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        console.log(`Trade ${tradeId} not found for timeout cancellation`);
        return;
      }
      
      // Add null checks for buyerId and sellerId
      if (!trade.buyerId || !trade.sellerId) {
        console.log(`Trade ${tradeId} missing user data for timeout cancellation`);
        return;
      }
      
      if (!['escrow_locked', 'payment_pending'].includes(trade.status)) {
        console.log(`Trade ${tradeId} cannot be cancelled (status: ${trade.status})`);
        return;
      }
      
      // Use enhanced safety system for timeout cancellation
      try {
        const escrowSafetySystem = require('./escrowSafetySystem');
        const result = await escrowSafetySystem.safeCancelTrade(
          tradeId, 
          'Время оплаты истекло', 
          trade.sellerId.chatId // Use seller as the requesting user for timeout
        );
        
        if (result.success) {
          console.log(`✅ [ENHANCED] Trade ${tradeId} cancelled safely due to timeout`);
        } else {
          console.error(`❌ [ENHANCED] Timeout cancellation failed: ${result.error}`);
          
          // For timeout cancellations, we may need special handling
          if (result.requiresManualIntervention) {
            console.error(`⚠️ MANUAL INTERVENTION REQUIRED: Timeout cancellation failed for trade ${tradeId}`);
            console.error(`Escrow details: ${result.error}`);
            
            // Create a timeout-specific manual intervention record
            const { EscrowTransaction } = require('../database/models');
            // Add null check for sellerId
            if (trade.sellerId) {
              const timeoutIntervention = new EscrowTransaction({
                userId: trade.sellerId._id,
                tradeId: tradeId,
                type: 'timeout_intervention_required',
                tokenType: 'CES',
                amount: trade.amount,
                status: 'pending',
                reason: `Timeout cancellation failed: ${result.error}`,
                createdAt: new Date()
              });
              
              await timeoutIntervention.save();
              console.log(`📝 [ENHANCED] Timeout intervention record created: ${timeoutIntervention._id}`);
            } else {
              console.log('⚠️ Skipping timeout intervention record creation due to missing sellerId');
            }
          }
          
          // Continue with trade status update in database even if escrow refund fails
          // This prevents trades from being stuck in pending status forever
          trade.status = 'cancelled';
          trade.escrowStatus = 'failed_refund';
          trade.disputeReason = `Время оплаты истекло - требуется ручное вмешательство`;
          
          await trade.save();
          console.log(`⚠️ [ENHANCED] Trade ${tradeId} marked as cancelled with failed refund status`);
        }
        
      } catch (safetyError) {
        console.error(`❌ [ENHANCED] Safety system error during timeout cancellation:`, safetyError);
        
        // Fallback: mark trade as cancelled in database to prevent permanent pending status
        trade.status = 'cancelled';
        trade.escrowStatus = 'system_error';
        trade.disputeReason = `Системная ошибка при таймауте: ${safetyError.message}`;
        
        await trade.save();
        console.log(`⚠️ [ENHANCED] Trade ${tradeId} marked as cancelled due to system error`);
      }
      
      // Notify both participants regardless of escrow status
      try {
        const smartNotificationService = require('./smartNotificationService');
        // Add null checks for buyerId and sellerId
        if (trade.buyerId && trade.sellerId) {
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
        } else {
          console.log('⚠️ Skipping timeout notifications due to missing buyerId or sellerId');
        }
      } catch (notifyError) {
        console.log('Warning: Could not send timeout notifications');
      }
      
      console.log(`✅ [ENHANCED] Timeout cancellation process completed for trade ${tradeId}`);
      
    } catch (error) {
      console.error('Error in enhanced timeout cancellation:', error);
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