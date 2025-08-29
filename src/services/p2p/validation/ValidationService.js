/**
 * P2P Validation Service
 * Handles validation of orders, trades, and user data
 */

const { P2POrder, P2PTrade, User } = require('../../../database/models');
const walletService = require('../../wallet/walletService');
const rubleReserveService = require('../../rubleReserveService');

class ValidationService {
  // Validate user rights for P2P operations
  async validateUserForP2POperations(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        return {
          valid: false,
          message: 'Пользователь не найден',
          keyboard: null
        };
      }
      
      // Check if user has a wallet
      if (!user.walletAddress) {
        return {
          valid: false,
          message: '⚠️ У вас нет кошелька.\n\n💡 Создайте кошелек в Личном кабинете для использования P2P функций.',
          keyboard: [[{ text: '👤 Личный кабинет', callback_data: 'personal_cabinet' }]]
        };
      }
      
      // Check if user has completed P2P profile
      if (!user.p2pProfile || !user.p2pProfile.isProfileComplete) {
        return {
          valid: false,
          message: '⚠️ Заполните профиль P2P для использования функций обмена.\n\n💡 Перейдите в настройки P2P профиля.',
          keyboard: [[{ text: '⚙️ Настройки P2P', callback_data: 'p2p_profile_settings' }]]
        };
      }
      
      return {
        valid: true,
        user
      };
      
    } catch (error) {
      console.error('Ошибка валидации пользователя для P2P операций:', error);
      return {
        valid: false,
        message: '❌ Ошибка проверки данных пользователя. Попробуйте позже.',
        keyboard: [[{ text: '🔙 Назад', callback_data: 'p2p_menu' }]]
      };
    }
  }

  // Validate order creation parameters
  validateOrderParameters(amount, pricePerToken, minTradeAmount, maxTradeAmount) {
    const errors = [];
    
    // Validate amount and price
    if (amount <= 0) {
      errors.push('Количество должно быть больше 0');
    }
    
    if (pricePerToken <= 0) {
      errors.push('Цена за токен должна быть больше 0');
    }
    
    // Validate min/max trade amounts
    if (minTradeAmount <= 0) {
      errors.push('Минимальная сумма должна быть больше 0');
    }
    
    if (maxTradeAmount && maxTradeAmount <= 0) {
      errors.push('Максимальная сумма должна быть больше 0');
    }
    
    if (minTradeAmount > amount) {
      errors.push('Минимальная сумма не может быть больше общего количества');
    }
    
    if (maxTradeAmount && maxTradeAmount > amount) {
      errors.push('Максимальная сумма не может быть больше общего количества');
    }
    
    if (minTradeAmount > (maxTradeAmount || amount)) {
      errors.push('Минимальная сумма не может быть больше максимальной');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Validate user balance for order creation
  async validateUserBalanceForOrder(user, amount, pricePerToken) {
    try {
      const totalValue = amount * pricePerToken;
      const commissionRate = 0.01; // 1% commission
      const commissionAmount = amount * commissionRate;
      
      // Check CES balance for commission
      const walletInfo = await walletService.getUserWallet(user.chatId);
      const availableBalance = walletInfo.cesBalance;
      
      if (availableBalance < commissionAmount) {
        return {
          valid: false,
          message: `Недостаточно CES для оплаты комиссии 1%. Доступно: ${availableBalance.toFixed(4)} CES, требуется: ${commissionAmount.toFixed(4)} CES`
        };
      }
      
      // Check ruble balance
      const availableRubleBalance = await rubleReserveService.getAvailableBalance(user._id.toString());
      
      if (availableRubleBalance < totalValue) {
        return {
          valid: false,
          message: `Недостаточно рублей. Доступно: ₽${availableRubleBalance.toFixed(2)}, требуется: ₽${totalValue.toFixed(2)}`
        };
      }
      
      return {
        valid: true
      };
      
    } catch (error) {
      console.error('Ошибка проверки баланса пользователя:', error);
      return {
        valid: false,
        message: 'Ошибка проверки баланса. Попробуйте позже.'
      };
    }
  }

  // Validate trade creation
  async validateTradeCreation(takerChatId, buyOrderId, cesAmount) {
    try {
      // Get the buy order
      const buyOrder = await P2POrder.findById(buyOrderId).populate('userId');
      if (!buyOrder || buyOrder.status !== 'active') {
        return {
          valid: false,
          error: 'Ордер не найден или неактивен'
        };
      }
      
      // Get the taker
      const taker = await User.findOne({ chatId: takerChatId });
      if (!taker) {
        return {
          valid: false,
          error: 'Тейкер не найден'
        };
      }
      
      // Check if it's the same user
      if (buyOrder.userId._id.toString() === taker._id.toString()) {
        return {
          valid: false,
          error: 'Нельзя торговать со своим ордером'
        };
      }
      
      // Check limits
      if (cesAmount < buyOrder.minTradeAmount || cesAmount > buyOrder.maxTradeAmount) {
        return {
          valid: false,
          error: `Количество должно быть от ${buyOrder.minTradeAmount} до ${buyOrder.maxTradeAmount} CES`
        };
      }
      
      // Check taker balance
      if (taker.balance < buyOrder.pricePerUnit * cesAmount) {
        return {
          valid: false,
          error: 'Недостаточно средств для совершения сделки'
        };
      }
      
      if (cesAmount > buyOrder.remainingAmount) {
        return {
          valid: false,
          error: `Недостаточно CES в ордере. Доступно: ${buyOrder.remainingAmount} CES`
        };
      }
      
      // Check available CES balance for taker (including potential commission)
      const walletInfo = await walletService.getUserWallet(taker.chatId);
      const commissionRate = 0.01;
      const amountWithCommission = cesAmount * (1 + commissionRate);
      
      if (walletInfo.cesBalance < amountWithCommission) {
        return {
          valid: false,
          error: `Недостаточно доступных CES с учетом возможной комиссии 1%. Доступно: ${walletInfo.cesBalance.toFixed(4)} CES, требуется: ${amountWithCommission.toFixed(4)} CES (включая возможную комиссию ${commissionRate * 100}%)`
        };
      }
      
      return {
        valid: true,
        buyOrder,
        taker
      };
      
    } catch (error) {
      console.error('Ошибка валидации создания сделки:', error);
      return {
        valid: false,
        error: 'Ошибка проверки данных. Попробуйте позже.'
      };
    }
  }
}

module.exports = ValidationService;