/**
 * P2P Trade Management Service
 * Handles creation, execution, and lifecycle of P2P trades
 */

const { P2PTrade, P2POrder, User } = require('../../../database/models');
const walletService = require('../../wallet/walletService');
const escrowService = require('../../escrow/escrowServiceInstance');
const smartNotificationService = require('../../notification/smartNotificationService');
const reputationService = require('../../reputationService');
const PrecisionUtil = require('../../../utils/PrecisionUtil');
const config = require('../../../config/configuration');

class TradeService {
  constructor() {
    this.commissionRate = 0.01; // 1% commission
    this.defaultTradeTimeout = config.escrow.timeoutMinutes;
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
      
      // 🔧 FIX BUG: Reserve funds for 1% commission when takers sell their coins
      // Takers need to have enough funds to cover both the sale amount and potential commission
      // The commission will be determined later based on order creation times, but we need to 
      // ensure they have funds in case they become the maker
      const amountWithCommission = cesAmount * (1 + this.commissionRate);
      
      if (walletInfo.cesBalance < amountWithCommission) {
        return { 
          success: false, 
          error: `Недостаточно доступных CES с учетом возможной комиссии 1%. Доступно: ${walletInfo.cesBalance.toFixed(4)} CES, требуется: ${amountWithCommission.toFixed(4)} CES (включая возможную комиссию ${this.commissionRate * 100}%)` 
        };
      }

      // Проверяем доступный баланс токена у мейкера (исключая эскроу)
      const makerWalletInfo = await walletService.getUserWallet(buyOrder.userId.chatId);
      if (makerWalletInfo[tokenSymbol].balance < tokenAmount) {
        return { 
          success: false, 
          error: `Недостаточно доступного токена ${tokenSymbol}. Доступно: ${makerWalletInfo[tokenSymbol].balance.toFixed(4)} ${tokenSymbol}` 
        };
      }
      
      // Проверяем, что тейкер не является мейкером
      if (taker.chatId === buyOrder.userId.chatId) {
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
        await walletService.transferCes(taker.chatId, buyOrder.userId.chatId, cesAmount);
        await walletService.transferToken(buyOrder.userId.chatId, taker.chatId, tokenSymbol, tokenAmount);
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
      const escrowResult = await escrowService.lockTokensInEscrow(
        taker._id,
        buyOrder.userId._id,
        'CES',
        cesAmount,
        this.defaultTradeTimeout
      );
      
      if (!escrowResult.success) {
        return { 
          success: false, 
          error: `Ошибка блокировки токенов в эскроу: ${escrowResult.error}` 
        };
      }
      
      // Create the trade record
      const trade = new P2PTrade({
        buyerId: buyOrder.userId._id,
        sellerId: taker._id,
        orderId: buyOrder._id,
        amount: cesAmount,
        pricePerToken: buyOrder.pricePerToken,
        totalValue: cesAmount * buyOrder.pricePerToken,
        status: 'escrow_locked',
        escrowId: escrowResult.escrowId,
        paymentMethods: buyOrder.paymentMethods,
        timeoutAt: new Date(Date.now() + this.defaultTradeTimeout * 60 * 1000)
      });
      
      await trade.save();
      
      // Update order remaining amount
      currentBuyOrder.remainingAmount -= cesAmount;
      if (currentBuyOrder.remainingAmount <= 0) {
        currentBuyOrder.status = 'filled';
      } else {
        currentBuyOrder.status = 'partial';
      }
      await currentBuyOrder.save();
      
      // Notify both parties
      await this.notifyTradeParticipants(trade);
      
      console.log(`Сделка создана: ${trade._id}`);
      return { success: true, tradeId: trade._id };
      
    } catch (error) {
      console.error('Ошибка создания сделки:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify trade participants
  async notifyTradeParticipants(trade) {
    try {
      const buyer = await User.findById(trade.buyerId);
      const seller = await User.findById(trade.sellerId);
      
      if (buyer && seller) {
        // Notify buyer
        await smartNotificationService.sendSmartTradeStatusNotification(
          buyer._id,
          trade,
          'escrow_locked'
        );
        
        // Notify seller
        await smartNotificationService.sendSmartTradeStatusNotification(
          seller._id,
          trade,
          'escrow_locked'
        );
      }
    } catch (error) {
      console.error('Ошибка уведомления участников сделки:', error);
    }
  }

  // Get user trades
  async getUserTrades(chatId, page = 1, limit = 10, status = null) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const skip = (page - 1) * limit;
      
      const query = {
        $or: [
          { buyerId: user._id },
          { sellerId: user._id }
        ]
      };
      
      if (status) {
        query.status = status;
      }
      
      const trades = await P2PTrade.find(query)
        .populate('buyerId', 'username trustScore')
        .populate('sellerId', 'username trustScore')
        .populate('orderId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await P2PTrade.countDocuments(query);
      
      return {
        trades,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('Ошибка получения сделок пользователя:', error);
      throw error;
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

module.exports = TradeService;