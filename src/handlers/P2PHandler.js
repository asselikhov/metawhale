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
      
      // Get user's current network and available tokens
      const userNetworkService = require('../services/userNetworkService');
      const multiChainService = require('../services/multiChainService');
      
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkTokens = multiChainService.getNetworkTokens(currentNetwork);
      const networkInfo = await userNetworkService.getNetworkInfo(chatId);
      
      // Prepare message text with network info
      const message = `🔄 P2P БИРЖА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `${userName}\n` +
                     `🌐 Текущая сеть: ${networkInfo}\n\n` +
                     `Исполненные ордера за 30 дней: ${stats.ordersLast30Days} шт.\n` +
                     `Процент исполнения за 30 дней: ${stats.completionRateLast30Days}%\n` +
                     `Среднее время перевода: ${stats.avgTransferTime} мин.\n` +
                     `Среднее время оплаты: ${stats.avgPaymentTime} мин.\n` +
                     `Рейтинг: ${stats.rating}\n\n` +
                     `💰 Выберите токен для торговли:`;
      
      // Generate buttons for available tokens in current network
      const tokenButtons = [];
      const networkEmoji = multiChainService.getNetworkEmoji(currentNetwork);
      
      // Create buttons for each available token
      for (const [tokenSymbol, tokenInfo] of Object.entries(networkTokens)) {
        // Skip certain tokens that shouldn't be traded (like native tokens that are too expensive)
        if (this.shouldShowTokenForTrading(currentNetwork, tokenSymbol)) {
          tokenButtons.push([
            Markup.button.callback(
              `${networkEmoji} ${tokenSymbol} - ${tokenInfo.name}`, 
              `p2p_select_token_${tokenSymbol.toLowerCase()}`
            )
          ]);
        }
      }
      
      // Add management buttons
      const managementButtons = [
        [Markup.button.callback('📊 Рынок', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('🏆 Топ', 'p2p_top_traders'), Markup.button.callback('🧮 Аналитика', 'p2p_analytics')],
        [Markup.button.callback('📑 Мои данные', 'p2p_my_data')]
      ];
      
      // Combine token buttons with management buttons
      const keyboard = Markup.inlineKeyboard([...tokenButtons, ...managementButtons]);
      
      console.log(`📤 Sending P2P menu with ${tokenButtons.length} tokens for ${currentNetwork} network to user ${chatId}`);
      
      // Send text with buttons in one message
      await ctx.reply(message, keyboard);
      console.log(`✅ P2P menu with token selection sent successfully to user ${chatId}`);
      
    } catch (error) {
      console.error('P2P menu error:', error);
      await ctx.reply('❌ Ошибка загрузки P2P меню. Попробуйте позже.');
    }
  }

  // Handle P2P Buy CES with real-time price updates
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
      
      // Send initial message with loading price
      const initialMessage = `📈 ПОКУПКА CES ТОКЕНОВ\n` +
                            `➖➖➖➖➖➖➖➖➖➖➖\n` +
                            `⏳ Загружаем актуальную цену...\n\n` +
                            `⚠️ Введите [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                            `💡 Пример: 10 245 1000 2450\n\n` +
                            `Информация:\n` +
                            `• Минимальная сумма: 10 ₽\n` +
                            `• Комиссия платформы: 1% (только с мейкеров)`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', 'refresh_price_buy')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      const sentMessage = await ctx.reply(initialMessage, keyboard);
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P buy order session for ${chatId}`);
      sessionManager.setP2POrderState(chatId, 'buy');
      
      // Start real-time price updates
      this.startRealTimePriceUpdates(ctx, sentMessage, 'buy');
      
    } catch (error) {
      console.error('P2P Buy CES error:', error);
      await ctx.reply('❌ Ошибка загрузки данных для покупки.');
    }
  }

  // Handle P2P Sell CES with real-time price updates
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
                       `Баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                       `Информация:\n` +
                       `• Минимальная сумма: 0.1 CES\n` +
                       `• Комиссия платформы: 1%\n\n` +
                       `💡 Пополните баланс CES`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // Send initial message with loading price
      const initialMessage = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                            `➖➖➖➖➖➖➖➖➖➖➖\n` +
                            `⏳ Загружаем актуальную цену...\n` +
                            `Баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                            `⚠️ Введите  [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                            `💡 Пример: 50 253.5 1000 12675\n\n` +
                            `Информация:\n` +
                            `• Минимальная сумма: 10 ₽\n` +
                            `• Комиссия платформы: 1%`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', 'refresh_price_sell')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      const sentMessage = await ctx.reply(initialMessage, keyboard);
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P sell order session for ${chatId}`);
      sessionManager.setP2POrderState(chatId, 'sell');
      
      // Start real-time price updates
      this.startRealTimePriceUpdates(ctx, sentMessage, 'sell', walletInfo);
      
    } catch (error) {
      console.error('P2P Sell CES error:', error);
      await ctx.reply('❌ Ошибка загрузки данных для продажи.');
    }
  }

  // Handle market orders display
  async handleP2PMarketOrders(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Stop any real-time price updates when user leaves P2P interfaces
      this.stopRealTimePriceUpdates(chatId);
      
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
      
      // ONLY handle main menu buttons if we're actually in an order processing session
      const userState = sessionManager.getUserState(chatId);
      
      if (userState === 'p2p_order') {
        // Check for main menu buttons - handle them instead of treating as order data
        if (orderData.includes('Личный кабинет') || orderData.includes('👤')) {
          console.log('📝 P2PHandler: Detected main menu button - Personal Cabinet');
          sessionManager.clearUserSession(chatId);
          const WalletHandler = require('./WalletHandler');
          const handler = new WalletHandler();
          return await handler.handlePersonalCabinetText(ctx);
        }
        
        if (orderData.includes('P2P Биржа') || orderData.includes('🔄 P2P')) {
          console.log('📝 P2PHandler: Detected main menu button - P2P Exchange');
          sessionManager.clearUserSession(chatId);
          return await this.handleP2PMenu(ctx);
        }
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
        return await ctx.reply(`⚠️ Неверный формат. \n💡 Используйте: количество цена_за_токен [мин_сумма_₽ макс_сумма_₽]\n\nПример: 10 250.50 или 10 250.50 1000 2500`);
      }
      
      const [amountStr, priceStr, minRublesStr, maxRublesStr] = parts;
      
      // Normalize decimal separators
      const amount = parseFloat(amountStr.replace(',', '.'));
      const pricePerToken = parseFloat(priceStr.replace(',', '.'));
      const minRubles = minRublesStr ? parseFloat(minRublesStr.replace(',', '.')) : pricePerToken; // Default to price of 1 CES
      const maxRubles = maxRublesStr ? parseFloat(maxRublesStr.replace(',', '.')) : amount * pricePerToken; // Default to total order value
      
      // Convert ruble amounts to CES amounts
      const minAmount = minRubles / pricePerToken;
      const maxAmount = maxRubles / pricePerToken;
      
      if (isNaN(amount) || amount <= 0 || isNaN(pricePerToken) || pricePerToken <= 0) {
        return await ctx.reply('❌ Неверные значения. Укажите положительные числа.');
      }
      
      if (amount < 0.1) {
        return await ctx.reply('❌ Минимальное количество: 0.1 CES');
      }
      
      if (minRubles < 10) {
        return await ctx.reply('❌ Минимальная сумма: 10 ₽');
      }
      
      if (maxRubles < minRubles) {
        return await ctx.reply('❌ Максимальная сумма не может быть меньше минимальной');
      }
      
      const totalValue = amount * pricePerToken;
      const commissionCES = amount * 0.01; // 1% commission in CES
      
      // Show confirmation
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'покупку' : 'продажу';
      
      // Check if smart contract escrow is enabled for sell orders
      const useSmartContract = process.env.USE_SMART_CONTRACT_ESCROW === 'true';
      const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
      const isSecureEscrow = orderType === 'sell' && useSmartContract && escrowContractAddress;
      
      // Security status message
      let securityMessage = '🛡️ Безопасность:';
      if (isSecureEscrow) {
        securityMessage += '\n✅ МАКСИМАЛЬНАЯ - смарт-контракт эскроу\n' +
                           '🔒 Токены будут реально заблокированы\n' +
                           '❌ Никто не сможет их потратить';
      } else if (orderType === 'sell') {
        securityMessage += '\n⚠️ БАЗОВАЯ - база данных эскроу\n' +
                           '🔓 Токены могут быть потрачены через MetaMask';
      } else {
        securityMessage += '\n✅ Все сделки защищены эскроу-системой';
      }
      
      const message = `${typeEmoji} Подтверждение ордера на ${typeText}\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Количество: ${amount} CES\n` +
                     `Цена за токен: ${pricePerToken.toFixed(2)} ₽\n` +
                     `Общая сумма: ${totalValue.toFixed(2)} ₽\n` +
                     `Мин. сумма: ${minRubles.toFixed(0)} ₽\n` +
                     `Макс. сумма: ${maxRubles.toFixed(0)} ₽\n` +
                     `Комиссия: ${commissionCES.toFixed(2)} CES (1%)\n\n` +
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
      
      // Clear the P2P order state since we're moving to confirmation state
      sessionManager.setSessionData(chatId, 'awaitingP2POrder', false);
      
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
                   '➖➖➖➖➖➖➖➖➖➖➖\n';
      
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
          const methodNames = activeMethods.map(pm => bankNames[pm.bank]).join(', ');
          message += `Способы оплаты: ${methodNames} \n`;
          
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
      
      // Add conditions without empty line before if it exists
      if (profile.makerConditions) {
        message += `\nУсловия: \n${profile.makerConditions}`;
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
  
  // Start real-time price updates for P2P interfaces (manual only)
  async startRealTimePriceUpdates(ctx, sentMessage, orderType, walletInfo = null) {
    const chatId = ctx.chat.id.toString();
    
    // Get initial price data for display
    try {
      const p2pService = require('../services/p2pService');
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      let message;
      if (orderType === 'buy') {
        message = `📈 ПОКУПКА CES ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `Текущая рыночная цена: ₽ ${priceData.currentPrice.toFixed(2)} / CES \ud83d\udfe2\n\n` +
                 `⚠️ Введите [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                 `💡 Пример: 10 245 1000 2450\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма: 10 ₽\n` +
                 `• Комиссия платформы: 1% (только с мейкеров)`;
      } else {
        message = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `Текущая рыночная цена: ${priceData.currentPrice.toFixed(2)} ₽ / CES \ud83d\udfe2\n` +
                 `Баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                 `⚠️ Введите  [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                 `💡 Пример: 50 253.5 1000 12675\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма: 10 ₽\n` +
                 `• Комиссия платформы: 1%`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', `refresh_price_${orderType}`)],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      // Update the initial message with current price
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        message,
        { reply_markup: keyboard.reply_markup }
      );
      
      console.log(`🟢 Initial price loaded for ${orderType}: ₽${priceData.currentPrice.toFixed(2)}/CES (manual refresh only)`);
      
    } catch (error) {
      console.error('Error loading initial price:', error);
    }
  }
  
  // Stop real-time price updates for a user (legacy function - no longer needed)
  stopRealTimePriceUpdates(chatId) {
    // This function is kept for compatibility but no longer needed
    // since we removed automatic price updates
    console.log(`🟢 No active price intervals to stop for user ${chatId} (manual refresh only)`);
  }
  
  // Handle manual price refresh
  async handlePriceRefresh(ctx, orderType) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Show loading message temporarily
      await ctx.answerCbQuery('🔄 Обновляем цену...');
      
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      let message;
      if (orderType === 'buy') {
        message = `📈 ПОКУПКА CES ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `Текущая рыночная цена: ₽ ${priceData.currentPrice.toFixed(2)} / CES 🟢\n\n` +
                 `⚠️ Введите [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                 `💡 Пример: 10 245 1000 2450\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма: 10 ₽\n` +
                 `• Комиссия платформы: 1% (только с мейкеров)`;
      } else {
        // Get updated wallet info for sell orders
        const walletInfo = await walletService.getUserWallet(chatId);
        message = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `Текущая рыночная цена: ${priceData.currentPrice.toFixed(2)} ₽ / CES 🟢\n` +
                 `Баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                 `⚠️ Введите  [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                 `💡 Пример: 50 253.5 1000 12675\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма: 10 ₽\n` +
                 `• Комиссия платформы: 1%`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', `refresh_price_${orderType}`)],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      try {
        await ctx.editMessageText(message, keyboard);
      } catch (editError) {
        // Handle case where message content is the same
        if (editError.response && editError.response.error_code === 400 && 
            editError.response.description.includes('message is not modified')) {
          await ctx.answerCbQuery('✅ Цена уже актуальна!');
          return;
        }
        throw editError;
      }
      
    } catch (error) {
      console.error('Error refreshing price:', error);
      await ctx.answerCbQuery('❌ Ошибка обновления цены');
    }
  }

  // Helper method to determine if a token should be shown for P2P trading
  shouldShowTokenForTrading(networkId, tokenSymbol) {
    // Define which tokens are suitable for P2P trading per network
    const tradableTokens = {
      polygon: ['CES', 'USDT'], // CES is main token, USDT is stable
      tron: ['TRX', 'USDT'], // TRX is native, USDT is stable
      bsc: ['USDT', 'BUSD', 'USDC'], // Stable coins - BNB too expensive for small trades
      solana: ['USDT', 'USDC'], // Stable coins - SOL too expensive 
      arbitrum: ['USDT', 'USDC'], // Stable coins - ETH too expensive
      avalanche: ['USDT', 'USDC'] // Stable coins - AVAX too expensive
    };
    
    return tradableTokens[networkId]?.includes(tokenSymbol) || false;
  }

  // Handle token selection for P2P trading
  async handleP2PTokenSelect(ctx, tokenSymbol) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`💰 User ${chatId} selected token ${tokenSymbol} for P2P trading`);
      
      // Get user's current network for context
      const userNetworkService = require('../services/userNetworkService');
      const multiChainService = require('../services/multiChainService');
      
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkEmoji = multiChainService.getNetworkEmoji(currentNetwork);
      const tokenConfig = multiChainService.getTokenConfig(currentNetwork, tokenSymbol);
      
      if (!tokenConfig) {
        return await ctx.reply('❌ Выбранный токен недоступен в текущей сети.');
      }
      
      // Show buy/sell options for selected token
      const message = `💰 ТОРГОВЛЯ ${tokenSymbol}\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `${networkEmoji} Сеть: ${multiChainService.getNetworkDisplayName(currentNetwork)}\n` +
                     `🪙 Токен: ${tokenConfig.name} (${tokenSymbol})\n\n` +
                     `Выберите действие:`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`📈 Купить ${tokenSymbol}`, `p2p_buy_${tokenSymbol.toLowerCase()}`)],
        [Markup.button.callback(`📉 Продать ${tokenSymbol}`, `p2p_sell_${tokenSymbol.toLowerCase()}`)],
        [Markup.button.callback('🔙 Назад к выбору токенов', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P token selection error:', error);
      await ctx.reply('❌ Ошибка выбора токена. Попробуйте позже.');
    }
  }

  // Handle P2P Buy Token (generic for any token)
  async handleP2PBuyToken(ctx, tokenSymbol) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`📈 User ${chatId} wants to buy ${tokenSymbol}`);
      
      // Validate user profile completion before allowing order creation
      const P2PDataHandler = require('./P2PDataHandler');
      const dataHandler = new P2PDataHandler();
      const validation = await dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_menu')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // Get user's current network and token info
      const userNetworkService = require('../services/userNetworkService');
      const multiChainService = require('../services/multiChainService');
      
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkEmoji = multiChainService.getNetworkEmoji(currentNetwork);
      const tokenConfig = multiChainService.getTokenConfig(currentNetwork, tokenSymbol);
      
      if (!tokenConfig) {
        return await ctx.reply('❌ Выбранный токен недоступен в текущей сети.');
      }
      
      // Send initial message with loading price
      const initialMessage = `📈 ПОКУПКА ${tokenSymbol} ТОКЕНОВ\n` +
                            `➖➖➖➖➖➖➖➖➖➖➖\n` +
                            `${networkEmoji} Сеть: ${multiChainService.getNetworkDisplayName(currentNetwork)}\n` +
                            `🪙 Токен: ${tokenConfig.name} (${tokenSymbol})\n` +
                            `⏳ Загружаем актуальную цену...\n\n` +
                            `⚠️ Введите [кол-во, ${tokenSymbol}] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                            `💡 Пример: 10 245 1000 2450\n\n` +
                            `Информация:\n` +
                            `• Минимальная сумма: 10 ₽\n` +
                            `• Комиссия платформы: 1% (только с мейкеров)`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', `refresh_price_buy_${tokenSymbol.toLowerCase()}`)],
        [Markup.button.callback('🔙 Назад к выбору токенов', 'p2p_menu')]
      ]);
      
      const sentMessage = await ctx.reply(initialMessage, keyboard);
      
      // Store state to handle next user message with token context
      console.log(`🔄 Setting P2P buy order session for ${chatId} with token ${tokenSymbol}`);
      sessionManager.setP2POrderState(chatId, 'buy', tokenSymbol);
      
      // Start real-time price updates for the specific token
      this.startRealTimePriceUpdates(ctx, sentMessage, 'buy', null, tokenSymbol);
      
    } catch (error) {
      console.error(`P2P Buy ${tokenSymbol} error:`, error);
      await ctx.reply('❌ Ошибка загрузки данных для покупки.');
    }
  }

  // Handle P2P Sell Token (generic for any token)
  async handleP2PSellToken(ctx, tokenSymbol) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`📉 User ${chatId} wants to sell ${tokenSymbol}`);
      
      // Validate user profile completion before allowing order creation
      const P2PDataHandler = require('./P2PDataHandler');
      const dataHandler = new P2PDataHandler();
      const validation = await dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_menu')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // Get user's current network and token info
      const userNetworkService = require('../services/userNetworkService');
      const multiChainService = require('../services/multiChainService');
      const multiChainWalletService = require('../services/multiChainWalletService');
      
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkEmoji = multiChainService.getNetworkEmoji(currentNetwork);
      const tokenConfig = multiChainService.getTokenConfig(currentNetwork, tokenSymbol);
      
      if (!tokenConfig) {
        return await ctx.reply('❌ Выбранный токен недоступен в текущей сети.');
      }
      
      // Get user's token balance
      let tokenBalance = 0;
      try {
        const walletInfo = await multiChainWalletService.getMultiChainWalletInfo(chatId);
        const networkBalances = walletInfo.networks[currentNetwork];
        if (networkBalances && networkBalances.tokens && networkBalances.tokens[tokenSymbol]) {
          tokenBalance = networkBalances.tokens[tokenSymbol].balance || 0;
        }
      } catch (balanceError) {
        console.error(`Error getting ${tokenSymbol} balance:`, balanceError);
      }
      
      if (tokenBalance < 0.001) {
        const message = `📉 ПРОДАЖА ${tokenSymbol} ТОКЕНОВ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `${networkEmoji} Сеть: ${multiChainService.getNetworkDisplayName(currentNetwork)}\n` +
                       `🪙 Токен: ${tokenConfig.name} (${tokenSymbol})\n` +
                       `⚠️ Недостаточно ${tokenSymbol} для продажи\n` +
                       `Баланс: ${tokenBalance.toFixed(6)} ${tokenSymbol}\n\n` +
                       `Информация:\n` +
                       `• Минимальная сумма: 0.001 ${tokenSymbol}\n` +
                       `• Комиссия платформы: 1%\n\n` +
                       `💡 Пополните баланс ${tokenSymbol}`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад к выбору токенов', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // Send initial message with loading price
      const initialMessage = `📉 ПРОДАЖА ${tokenSymbol} ТОКЕНОВ\n` +
                            `➖➖➖➖➖➖➖➖➖➖➖\n` +
                            `${networkEmoji} Сеть: ${multiChainService.getNetworkDisplayName(currentNetwork)}\n` +
                            `🪙 Токен: ${tokenConfig.name} (${tokenSymbol})\n` +
                            `⏳ Загружаем актуальную цену...\n` +
                            `Баланс: ${tokenBalance.toFixed(6)} ${tokenSymbol}\n\n` +
                            `⚠️ Введите [кол-во, ${tokenSymbol}] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                            `💡 Пример: 50 253.5 1000 12675\n\n` +
                            `Информация:\n` +
                            `• Минимальная сумма: 10 ₽\n` +
                            `• Комиссия платформы: 1%`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', `refresh_price_sell_${tokenSymbol.toLowerCase()}`)],
        [Markup.button.callback('🔙 Назад к выбору токенов', 'p2p_menu')]
      ]);
      
      const sentMessage = await ctx.reply(initialMessage, keyboard);
      
      // Store state to handle next user message with token context
      console.log(`🔄 Setting P2P sell order session for ${chatId} with token ${tokenSymbol}`);
      sessionManager.setP2POrderState(chatId, 'sell', tokenSymbol);
      
      // Start real-time price updates for the specific token
      this.startRealTimePriceUpdates(ctx, sentMessage, 'sell', { tokenSymbol, balance: tokenBalance }, tokenSymbol);
      
    } catch (error) {
      console.error(`P2P Sell ${tokenSymbol} error:`, error);
      await ctx.reply('❌ Ошибка загрузки данных для продажи.');
    }
  }
}

module.exports = P2PHandler;