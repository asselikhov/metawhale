/**
 * P2P Handler
 * Handles all P2P trading operations including orders, market display, and user interactions
 */

const { Markup } = require('telegraf');
const p2pService = require('../services/p2pService');
const walletService = require('../services/walletService');
const { User, P2PTrade } = require('../database/models');
const sessionManager = require('./SessionManager');

class P2PHandler {
  // Handle P2P menu
  async handleP2PMenu(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`🔄 Handling P2P menu callback for user ${chatId}`);
      
      // Clear any existing session when entering P2P menu
      sessionManager.clearUserSession(chatId);
      
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        const message = '⚠️ У вас нет кошелька.\n\n' +
                       '💡 Создайте кошелек в Личном кабинете для использования P2P функций.';
        
        // Remove the "Создать кошелек" button as it should only be in the personal cabinet
        const keyboard = Markup.inlineKeyboard([]);
        
        console.log(`📤 Sending wallet creation message to user ${chatId} (callback version)`);
        return await ctx.reply(message, keyboard);
      }
      
      // Get user reputation data
      const reputationService = require('../services/reputationService');
      const { User } = require('../database/models');
      const user = await User.findOne({ chatId });
      
      // Get standardized user statistics
      const stats = await reputationService.getStandardizedUserStats(user._id);
      
      // Get user's full name from P2P profile or fallback to Telegram name
      let userName = 'Пользователь';
      if (user && user.p2pProfile && user.p2pProfile.fullName) {
        userName = user.p2pProfile.fullName;
      } else if (user && user.firstName) {
        userName = user.firstName;
        if (user.lastName) {
          userName += ` ${user.lastName}`;
        }
      }
      
      // Prepare message text in the new format with user name
      const message = `🔄 P2P БИРЖА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `${userName}\n` +
                     `Исполненные ордера за 30 дней: ${stats.ordersLast30Days} шт.\n` +
                     `Процент исполнения за 30 дней: ${stats.completionRateLast30Days}%\n` +
                     `Среднее время перевода: ${stats.avgTransferTime} мин.\n` +
                     `Среднее время оплаты: ${stats.avgPaymentTime} мин.\n` +
                     `Рейтинг: ${stats.rating}`;
      
      // Keyboard with buttons
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Купить CES', 'p2p_buy_ces'), Markup.button.callback('📉 Продать CES', 'p2p_sell_ces')],
        [Markup.button.callback('📊 Рынок', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('🏆 Топ трейдеров', 'p2p_top_traders'), Markup.button.callback('🧮 Аналитика', 'p2p_analytics')],
        [Markup.button.callback('📑 Мои данные', 'p2p_my_data')]
      ]);
      
      console.log(`📤 Sending P2P menu text with buttons to user ${chatId}`);
      console.log(`📝 Message: ${message}`);
      console.log(`⌨ Keyboard: ${JSON.stringify(keyboard)}`);
      
      // Send text with buttons in one message
      await ctx.reply(message, keyboard);
      console.log(`✅ Text with buttons sent successfully to user ${chatId}`);
      
    } catch (error) {
      console.error('P2P menu error:', error);
      await ctx.reply('❌ Ошибка загрузки P2P меню. Попробуйте позже.');
    }
  }

  // Handle P2P Buy CES
  async handleP2PBuyCES(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Validate user profile completion before allowing order creation
      const P2PDataHandler = require('./P2PDataHandler');
      const dataHandler = new P2PDataHandler();
      const validation = await dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_menu')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `📈 ПОКУПКА CES ТОКЕНОВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество, цену, мин. и макс. сумму:\n` +
                     `➤ Формат: кол-во цена_за_токен мин_сумма макс_сумма\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)} 1 5\n\n` +
                     `Информация:\n` +
                     `➤ Минимальная сумма: 1 CES\n` +
                     `➤ Комиссия платформы: 1%`;
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P buy order session for ${chatId}`);
      sessionManager.setP2POrderState(chatId, 'buy');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P Buy CES error:', error);
      await ctx.reply('❌ Ошибка загрузки данных для покупки.');
    }
  }

  // Handle P2P Sell CES
  async handleP2PSellCES(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Validate user profile completion before allowing order creation
      const P2PDataHandler = require('./P2PDataHandler');
      const dataHandler = new P2PDataHandler();
      const validation = await dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_menu')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (walletInfo.cesBalance < 1) {
        const message = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `⚠️ Недостаточно CES для продажи\n` +
                       `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                       `Информация:\n` +
                       `➤ Минимальная сумма: 1 CES\n` +
                       `➤ Комиссия платформы: 1%\n\n` +
                       `💡 Пополните баланс CES`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество, цену, мин. и макс. сумму:\n` +
                     `➤ Формат: кол-во цена_за_токен мин_сумма макс_сумма\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)} 1 5\n\n` +
                     `Информация:\n` +
                     `➤ Минимальная сумма: 1 CES\n` +
                     `➤ Комиссия платформы: 1%`;
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P sell order session for ${chatId}`);
      sessionManager.setP2POrderState(chatId, 'sell');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P Sell CES error:', error);
      await ctx.reply('❌ Ошибка загрузки данных для продажи.');
    }
  }

  // Handle market orders display
  async handleP2PMarketOrders(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Clear any existing order session data when entering market orders
      sessionManager.clearUserSession(chatId);
      
      // Show selection menu for buy/sell orders
      const message = `📊 РЫНОК\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Выберите тип ордеров для просмотра:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Купить', 'p2p_buy_orders')],
        [Markup.button.callback('📉 Продать', 'p2p_sell_orders')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);

      await ctx.reply(message, keyboard);

    } catch (error) {
      console.error('Market orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров.');
    }
  }

  // Get user level display for market orders
  getUserLevelDisplay(trustScore) {
    if (trustScore >= 900) return { emoji: '🏆', level: 5 };
    if (trustScore >= 750) return { emoji: '⭐', level: 4 };
    if (trustScore >= 600) return { emoji: '💎', level: 3 };
    if (trustScore >= 400) return { emoji: '🌱', level: 2 };
    return { emoji: '🆕', level: 1 };
  }

  // Handle top traders display
  async handleP2PTopTraders(ctx) {
    try {
      const reputationService = require('../services/reputationService');
      const topTraders = await reputationService.getTopRatedUsers(10);
      
      let message = `🏆 ТОП ТРЕЙДЕРОВ\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n`;
      
      if (topTraders.length === 0) {
        message += `⚠️ Пока нет трейдеров с высоким рейтингом\n\n` +
                  `💡 Активно торгуйте, чтобы попасть в топ !`;
      } else {
        topTraders.forEach((trader, index) => {
          const ratingEmoji = reputationService.getRatingEmoji(trader.smartRating);
          const username = trader.username || 'Пользователь';
          
          message += `${index + 1}. @${username} ${ratingEmoji}\n` +
                    `📊 Рейтинг: ${trader.smartRating}%\n` +
                    `✅ Завершено: ${trader.completionRate || 100}%\n\n`;
        });
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Top traders error:', error);
      await ctx.reply('❌ Ошибка загрузки топ трейдеров.');
    }
  }

  // Process P2P order from user message
  async processP2POrder(ctx, orderData, orderType) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Skip processing if this is a callback query or button text
      if (ctx.callbackQuery) {
        console.log('📝 P2PHandler: Skipping P2P order processing - this is a callback query');
        return;
      }
      
      // Check if orderData looks like button text (contains emojis or common button phrases)
      const buttonPatterns = [
        /🔙/, // Back arrow emoji
        /☝/, // Cancel/Stop emoji
        /✅/, // Check mark emoji
        /❌/, // X emoji
        /💰/, // Money bag emoji
        /📈/, // Chart emoji
        /📉/, // Chart emoji
        /Назад/, // "Назад" word
        /Отмена/, // "Отмена" word
        /Подтверд/ // "Подтверд" word
      ];
      
      const isButtonText = buttonPatterns.some(pattern => pattern.test(orderData));
      if (isButtonText) {
        console.log(`📝 Detected button text in P2P order: "${orderData}", ignoring`);
        return;
      }
      
      // Parse order data (amount pricePerToken minAmount maxAmount)
      const parts = orderData.trim().split(/\s+/);
      
      if (parts.length < 2 || parts.length > 4) {
        return await ctx.reply(`⚠️ Неверный формат. \n💡 Используйте: количество цена_за_токен [мин_сумма макс_сумма]\n\nПример: 10 250.50 или 10 250.50 1 5`);
      }
      
      const [amountStr, priceStr, minAmountStr, maxAmountStr] = parts;
      
      // Normalize decimal separators
      const amount = parseFloat(amountStr.replace(',', '.'));
      const pricePerToken = parseFloat(priceStr.replace(',', '.'));
      const minAmount = minAmountStr ? parseFloat(minAmountStr.replace(',', '.')) : 1;
      const maxAmount = maxAmountStr ? parseFloat(maxAmountStr.replace(',', '.')) : amount;
      
      if (isNaN(amount) || amount <= 0 || isNaN(pricePerToken) || pricePerToken <= 0) {
        return await ctx.reply('❌ Неверные значения. Укажите положительные числа.');
      }
      
      if (amount < 1) {
        return await ctx.reply('❌ Минимальное количество: 1 CES');
      }
      
      const totalValue = amount * pricePerToken;
      const commission = totalValue * 0.01;
      
      // Show confirmation
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'покупку' : 'продажу';
      
      const message = `${typeEmoji} Подтверждение ордера на ${typeText}\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Количество: ${amount} CES\n` +
                     `Цена за токен: ₽${pricePerToken.toFixed(2)}\n` +
                     `Общая сумма: ₽${totalValue.toFixed(2)}\n` +
                     `Мин. сумма: ${minAmount} CES\n` +
                     `Макс. сумма: ${maxAmount} CES\n` +
                     `Комиссия: ₽${commission.toFixed(2)} (1%)\n\n` +
                     `🛡️ Безопасность:\n` +
                     `Все сделки защищены эскроу-системой\n\n` +
                     `⚠️ Подтвердить создание ордера?`;
      
      // Store order data in session
      sessionManager.setPendingP2POrder(chatId, {
        orderType,
        amount,
        pricePerToken,
        minAmount,
        maxAmount,
        timestamp: Date.now()
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', 'confirm_p2p_order')],
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P order processing error:', error);
      await ctx.reply('❌ Ошибка обработки ордера.');
    }
  }

  // Process user message
  async processUserMessage(ctx, text) {
    try {
      await ctx.reply('✉️ Сообщение получено!\n\n🚧 Функция обмена личными сообщениями в разработке.');
    } catch (error) {
      console.error('User message processing error:', error);
      await ctx.reply('❌ Ошибка обработки сообщения.');
    }
  }

  // Handle P2P My Data
  async handleP2PMyData(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const { User } = require('../database/models');
      
      const user = await User.findOne({ chatId });
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }

      const profile = user.p2pProfile || {};
      
      if (!profile.isProfileComplete) {
        // Profile not set up
        const message = '📑 МОИ ДАННЫЕ\n' +
                       '➖➖➖➖➖➖➖➖➖➖➖\n' +
                       '⚠️ Профиль не заполнен\n\n' +
                       '💡 Для безопасной торговли необходимо заполнить данные:';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Заполнить данные', 'p2p_edit_data')],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }

      // Show complete profile
      let message = '📑 МОИ ДАННЫЕ\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n\n';
      
      // Add profile data in new format
      if (profile.fullName) {
        message += `ФИО: ${profile.fullName}\n`;
      }
      
      if (profile.paymentMethods && profile.paymentMethods.length > 0) {
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
        
        const activeMethods = profile.paymentMethods.filter(pm => pm.isActive);
        
        if (activeMethods.length > 0) {
          message += 'Способы оплаты: \n';
          const methodNames = activeMethods.map(pm => bankNames[pm.bank]).join(', ');
          message += `${methodNames}\n`;
          
          message += 'Реквизиты:\n';
          activeMethods.forEach(pm => {
            const bankName = bankNames[pm.bank];
            // Improved card masking: show asterisks with last 4 digits
            let maskedCard = pm.cardNumber || '';
            if (maskedCard.length > 4) {
              maskedCard = '*'.repeat(maskedCard.length - 4) + maskedCard.slice(-4);
            } else if (maskedCard) {
              maskedCard = '*'.repeat(maskedCard.length);
            }
            message += `${bankName}: ${maskedCard || 'Не указано'}\n`;
          });
        }
      }
      
      if (profile.contactInfo) {
        message += `Контакт: ${profile.contactInfo}\n`;
      }
      
      // Add empty line before conditions if it exists
      if (profile.makerConditions) {
        message += `\nУсловия: ${profile.makerConditions}`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Изменить', 'p2p_edit_data')],
        [Markup.button.callback(profile.useInOrders ? '✅ Используется в ордерах' : '✅ Использовать в ордерах', 'p2p_toggle_use_in_orders')],
        [Markup.button.callback('👀 Как видят покупатели', 'p2p_buyer_view')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P My Data error:', error);
      await ctx.reply('❌ Ошибка загрузки данных.');
    }
  }
}

module.exports = P2PHandler;