/**
 * P2P Handlers Index
 * Export P2P-related handlers
 */

const P2PTradeHandler = require('./P2PHandler');

module.exports = P2PTradeHandler;

/**
 * P2P Handler
 * Handles all P2P trading operations including orders, market display, and user interactions
 */

const { Markup } = require('telegraf');
const p2pService = require('../services/p2pService');
const walletService = require('../services/walletService');
const { User, P2PTrade } = require('../database/models');
const sessionManager = require('./SessionManager');
const fiatCurrencyService = require('../services/fiatCurrencyService');
const LocalizationHelper = require('../utils/localizationHelper');

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
      
      // Get user's current network and available tokens
      const userNetworkService = require('../services/userNetworkService');
      const multiChainService = require('../services/multiChainService');
      
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkTokens = multiChainService.getNetworkTokens(currentNetwork);
      const networkInfo = await userNetworkService.getNetworkInfo(chatId);
      
      // Prepare message text with token selection prompt
      const message = `💰 Какую монету вы хотите торговать?`;
      
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
      
      // Combine token buttons
      const keyboard = Markup.inlineKeyboard([...tokenButtons]);
      
      console.log(`📤 Sending P2P token selection menu with ${tokenButtons.length} tokens for ${currentNetwork} network to user ${chatId}`);
      
      // Send text with buttons in one message
      await ctx.reply(message, keyboard);
      console.log(`✅ P2P token selection menu sent successfully to user ${chatId}`);
      
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
      
      // Get user's selected token from session
      const selectedToken = sessionManager.getSessionData(chatId, 'selectedToken') || 'CES';
      
      // Show selection menu for buy/sell orders with token context
      const message = `📊 РЫНОК ${selectedToken}\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Выберите тип ордеров для просмотра:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`📈 Купить ${selectedToken}`, `p2p_buy_orders`)],
        [Markup.button.callback(`📉 Продать ${selectedToken}`, `p2p_sell_orders`)],
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
      
      // Get selected token, network, and currency from session
      const sessionManager = require('./SessionManager');
      const userNetworkService = require('../services/userNetworkService');
      const fiatCurrencyService = require('../services/fiatCurrencyService');
      
      const selectedToken = sessionManager.getSessionData(chatId, 'selectedToken') || 'CES';
      const selectedNetwork = await userNetworkService.getUserNetwork(chatId);
      const selectedCurrency = sessionManager.getSessionData(chatId, 'selectedCurrency') || 'RUB';
      const currency = fiatCurrencyService.getCurrencyMetadata(selectedCurrency);
      
      console.log(`💱 Processing P2P order for user ${chatId} with token ${selectedToken}, network ${selectedNetwork}, currency ${selectedCurrency}`);
      
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
        return await ctx.reply(`⚠️ Неверный формат. \n💡 Используйте: количество цена_за_токен [мин_сумма_${currency.symbol} макс_сумма_${currency.symbol}]\n\nПример: 10 250.50 или 10 250.50 1000 2500`);
      }
      
      const [amountStr, priceStr, minCurrencyStr, maxCurrencyStr] = parts;
      
      // Normalize decimal separators
      const amount = parseFloat(amountStr.replace(',', '.'));
      const pricePerToken = parseFloat(priceStr.replace(',', '.'));
      const minCurrency = minCurrencyStr ? parseFloat(minCurrencyStr.replace(',', '.')) : pricePerToken; // Default to price of 1 token
      const maxCurrency = maxCurrencyStr ? parseFloat(maxCurrencyStr.replace(',', '.')) : amount * pricePerToken; // Default to total order value
      
      // Convert currency amounts to token amounts
      const minAmount = minCurrency / pricePerToken;
      const maxAmount = maxCurrency / pricePerToken;
      
      if (isNaN(amount) || amount <= 0 || isNaN(pricePerToken) || pricePerToken <= 0) {
        return await ctx.reply('❌ Неверные значения. Укажите положительные числа.');
      }
      
      if (amount < 0.1) {
        return await ctx.reply(`❌ Минимальное количество: 0.1 ${selectedToken}`);
      }
      
      if (minCurrency < 10) {
        return await ctx.reply(`❌ Минимальная сумма: 10 ${currency.symbol}`);
      }
      
      if (maxCurrency < minCurrency) {
        return await ctx.reply('❌ Максимальная сумма не может быть меньше минимальной');
      }
      
      const totalValue = amount * pricePerToken;
      const commissionTokens = amount * 0.01; // 1% commission in tokens
      
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
      
      const message = `${typeEmoji} Подтверждение ордера на ${typeText} ${selectedToken}\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Сеть: ${selectedNetwork}\n` +
                     `Валюта: ${currency.nameRu} (${currency.code})\n` +
                     `Количество: ${amount} ${selectedToken}\n` +
                     `Цена за токен: ${pricePerToken.toFixed(2)} ${currency.symbol}\n` +
                     `Общая сумма: ${totalValue.toFixed(2)} ${currency.symbol}\n` +
                     `Мин. сумма: ${minCurrency.toFixed(0)} ${currency.symbol}\n` +
                     `Макс. сумма: ${maxCurrency.toFixed(0)} ${currency.symbol}\n` +
                     `Комиссия: ${commissionTokens.toFixed(2)} ${selectedToken} (1%)\n\n` +
                     `⚠️ Подтвердить создание ордера?`;
      
      // Store order data in session
      sessionManager.setPendingP2POrder(chatId, {
        orderType,
        amount,
        pricePerToken,
        minAmount,
        maxAmount,
        tokenType: selectedToken,
        network: selectedNetwork,
        currency: selectedCurrency,
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
  async startRealTimePriceUpdates(ctx, sentMessage, orderType, walletInfo = null, tokenSymbol = 'CES', currencyCode = 'RUB') {
    const chatId = ctx.chat.id.toString();
    
    // Get initial price data for display
    try {
      // Get currency metadata
      const currency = fiatCurrencyService.getCurrencyMetadata(currencyCode);
      
      // Get real market price
      const p2pService = require('../services/p2pService');
      const marketPriceData = await p2pService.getMarketPriceSuggestion();
      
      // Convert market price to selected currency using pre-calculated prices when available
      let convertedPrice = marketPriceData.currentPrice; // Default to RUB
      if (currencyCode !== 'RUB') {
        // Use pre-calculated currency prices when available
        if (marketPriceData.currencyPrices && marketPriceData.currencyPrices[currencyCode]) {
          convertedPrice = marketPriceData.currencyPrices[currencyCode];
        } else {
          // Fallback to conversion
          try {
            convertedPrice = await fiatCurrencyService.convertAmount(
              marketPriceData.currentPrice, 
              'RUB', 
              currencyCode
            );
          } catch (convertError) {
            console.error('Error converting price:', convertError);
            // Fallback to placeholder price if conversion fails
            convertedPrice = currencyCode === 'RUB' ? 250.0 : 
                            currencyCode === 'USD' ? 2.5 :
                            currencyCode === 'EUR' ? 2.3 : 250.0;
          }
        }
      } else {
        // For RUB, use the specific RUB price
        convertedPrice = marketPriceData.currentPriceRub || marketPriceData.currentPrice;
      }
      
      let message;
      if (orderType === 'buy') {
        message = `📈 ПОКУПКА ${tokenSymbol} ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `${currency.flag} Валюта: ${currency.nameRu} (${currency.code})\n` +
                 `Текущая рыночная цена: ${fiatCurrencyService.formatAmount(convertedPrice, currencyCode)} / ${tokenSymbol} 🟢\n\n` +
                 `⚠️ Введите [кол-во, ${tokenSymbol}] [цена_за_токен, ${currency.symbol}] [мин_сумма, ${currency.symbol}] [макс_сумма, ${currency.symbol}]\n` +
                 `💡 Пример: 10 245 1000 2450\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма в ${currency.code}: эквивалент 10 ${currency.symbol}\n` +
                 `• Комиссия платформы: 1% (только с мейкеров)`;
      } else {
        let balanceText = '';
        if (tokenSymbol === 'CES' && walletInfo) {
          balanceText = `Баланс: ${walletInfo.cesBalance.toFixed(4)} ${tokenSymbol}\n`;
        } else if (walletInfo && walletInfo.balance !== undefined) {
          balanceText = `Баланс: ${walletInfo.balance.toFixed(6)} ${tokenSymbol}\n`;
        }
        
        message = `📉 ПРОДАЖА ${tokenSymbol} ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `${currency.flag} Валюта: ${currency.nameRu} (${currency.code})\n` +
                 `Текущая рыночная цена: ${fiatCurrencyService.formatAmount(convertedPrice, currencyCode)} / ${tokenSymbol} 🟢\n` +
                 balanceText + '\n' +
                 `⚠️ Введите [кол-во, ${tokenSymbol}] [цена_за_токен, ${currency.symbol}] [мин_сумма, ${currency.symbol}] [макс_сумма, ${currency.symbol}]\n` +
                 `💡 Пример: 50 253.5 1000 12675\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма в ${currency.code}: эквивалент 10 ${currency.symbol}\n` +
                 `• Комиссия платформы: 1%`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', `refresh_price_${orderType}_${tokenSymbol.toLowerCase()}_${currencyCode}`)],
        [Markup.button.callback('💱 Сменить валюту', `p2p_currency_selection_${orderType}_${tokenSymbol.toLowerCase()}`)],
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
      
      console.log(`🟢 Initial price loaded for ${orderType} ${tokenSymbol} in ${currencyCode}: ${fiatCurrencyService.formatAmount(convertedPrice, currencyCode)}/${tokenSymbol} (manual refresh only)`);
      
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
  
  // Handle manual price refresh with multi-currency support
  async handlePriceRefresh(ctx, orderType, tokenSymbol = 'CES', currencyCode = 'RUB') {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Show loading message temporarily
      await ctx.answerCbQuery('🔄 Обновляем цену...');
      
      // Get currency metadata
      const currency = fiatCurrencyService.getCurrencyMetadata(currencyCode);
      
      // Get real market price
      const p2pService = require('../services/p2pService');
      const marketPriceData = await p2pService.getMarketPriceSuggestion();
      
      // Convert market price to selected currency using pre-calculated prices when available
      let convertedPrice = marketPriceData.currentPrice; // Default to RUB
      if (currencyCode !== 'RUB') {
        // Use pre-calculated currency prices when available
        if (marketPriceData.currencyPrices && marketPriceData.currencyPrices[currencyCode]) {
          convertedPrice = marketPriceData.currencyPrices[currencyCode];
        } else {
          // Fallback to conversion
          try {
            convertedPrice = await fiatCurrencyService.convertAmount(
              marketPriceData.currentPrice, 
              'RUB', 
              currencyCode
            );
          } catch (convertError) {
            console.error('Error converting price:', convertError);
            // Fallback to placeholder price if conversion fails
            convertedPrice = currencyCode === 'RUB' ? 250.0 : 
                            currencyCode === 'USD' ? 2.5 :
                            currencyCode === 'EUR' ? 2.3 : 250.0;
          }
        }
      } else {
        // For RUB, use the specific RUB price
        convertedPrice = marketPriceData.currentPriceRub || marketPriceData.currentPrice;
      }
      
      let message;
      if (orderType === 'buy') {
        message = `📈 ПОКУПКА ${tokenSymbol} ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `${currency.flag} Валюта: ${currency.nameRu} (${currency.code})\n` +
                 `Текущая рыночная цена: ${fiatCurrencyService.formatAmount(convertedPrice, currencyCode)} / ${tokenSymbol} 🟢\n\n` +
                 `⚠️ Введите [кол-во, ${tokenSymbol}] [цена_за_токен, ${currency.symbol}] [мин_сумма, ${currency.symbol}] [макс_сумма, ${currency.symbol}]\n` +
                 `💡 Пример: 10 245 1000 2450\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма в ${currency.code}: эквивалент 10 ${currency.symbol}\n` +
                 `• Комиссия платформы: 1% (только с мейкеров)`;
      } else {
        // Get updated wallet info for sell orders
        let balanceText = '';
        if (tokenSymbol === 'CES') {
          const walletInfo = await walletService.getUserWallet(chatId);
          balanceText = `Баланс: ${walletInfo.cesBalance.toFixed(4)} ${tokenSymbol}\n`;
        }
        
        message = `.DataGridViewColumn ПРОДАЖА ${tokenSymbol} ТОКЕНОВ\n` +
                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                 `${currency.flag} Валюта: ${currency.nameRu} (${currency.code})\n` +
                 `Текущая рыночная цена: ${fiatCurrencyService.formatAmount(convertedPrice, currencyCode)} / ${tokenSymbol} 🟢\n` +
                 balanceText + '\n' +
                 `⚠️ Введите [кол-во, ${tokenSymbol}] [цена_за_токен, ${currency.symbol}] [мин_сумма, ${currency.symbol}] [макс_сумма, ${currency.symbol}]\n` +
                 `💡 Пример: 50 253.5 1000 12675\n\n` +
                 `Информация:\n` +
                 `• Минимальная сумма в ${currency.code}: эквивалент 10 ${currency.symbol}\n` +
                 `• Комиссия платформы: 1%`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', `refresh_price_${orderType}_${tokenSymbol.toLowerCase()}_${currencyCode}`)],
        [Markup.button.callback('💱 Сменить валюту', `p2p_currency_selection_${orderType}_${tokenSymbol.toLowerCase()}`)],
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
      avalanche: ['USDT', 'USDC'], // Stable coins - AVAX too expensive
      ton: ['USDT', 'NOT'] // USDT stable, NOT native token - TON too expensive for small trades
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
      const fiatCurrencyService = require('../services/fiatCurrencyService');
      
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkEmoji = multiChainService.getNetworkEmoji(currentNetwork);
      const tokenConfig = multiChainService.getTokenConfig(currentNetwork, tokenSymbol);
      const networkInfo = await userNetworkService.getNetworkInfo(chatId);
      
      // Get user's selected currency
      const userCurrencyCode = await fiatCurrencyService.getUserCurrency(chatId);
      const userCurrency = fiatCurrencyService.getCurrencyMetadata(userCurrencyCode);
      
      if (!tokenConfig) {
        return await ctx.reply('❌ Выбранный токен недоступен в текущей сети.');
      }
      
      // Store selected token in session
      const sessionManager = require('./SessionManager');
      sessionManager.setSessionData(chatId, 'selectedToken', tokenSymbol);
      
      // Log session data for debugging
      console.log(`💾 Session data for user ${chatId}:`, {
        selectedToken: sessionManager.getSessionData(chatId, 'selectedToken'),
        selectedNetwork: currentNetwork,
        selectedCurrency: userCurrencyCode
      });
      
      // Show P2P exchange interface with the specific format
      const message = `🔄 P2P БИРЖА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `🌐 Текущая сеть: ${networkInfo}\n` +
                     `⚪ Монета для торговли: ${tokenSymbol}\n` +
                     `💳 Валюта для торговли: ${userCurrency.flag} ${userCurrencyCode}\n\n` +
                     `Комиссия мейкера 1 %, тейкера 0 %`;
      
      // Get full token name for button labels
      const tokenName = tokenConfig.name || tokenSymbol;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`📈 Купить ${tokenName}`, `p2p_buy_${tokenSymbol.toLowerCase()}`), 
         Markup.button.callback(`📉 Продать ${tokenName}`, `p2p_sell_${tokenSymbol.toLowerCase()}`)],
        [Markup.button.callback('📊 Рынок', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('🏆 Топ', 'p2p_top_traders'), Markup.button.callback('📊 Аналитика', 'p2p_analytics')],
        [Markup.button.callback('📑 Мои данные', 'p2p_my_data')]
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
      
      // Store selected token in session for market orders
      const sessionManager = require('./SessionManager');
      sessionManager.setSessionData(chatId, 'selectedToken', tokenSymbol);
      
      // Log session data for debugging
      console.log(`💾 Updated session data for user ${chatId}:`, {
        selectedToken: sessionManager.getSessionData(chatId, 'selectedToken')
      });
      
      // Redirect to currency selection for multi-currency support
      return await this.handleP2PCurrencySelection(ctx, 'buy', tokenSymbol);
      
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
      
      // Store selected token in session for market orders
      const sessionManager = require('./SessionManager');
      sessionManager.setSessionData(chatId, 'selectedToken', tokenSymbol);
      
      // Log session data for debugging
      console.log(`💾 Updated session data for user ${chatId}:`, {
        selectedToken: sessionManager.getSessionData(chatId, 'selectedToken')
      });
      
      // Redirect to currency selection for multi-currency support
      return await this.handleP2PCurrencySelection(ctx, 'sell', tokenSymbol);
      
    } catch (error) {
      console.error(`P2P Sell ${tokenSymbol} error:`, error);
      await ctx.reply('❌ Ошибка загрузки данных для продажи.');
    }
  }

  // Handle currency selection for P2P trading
  async handleP2PCurrencySelection(ctx, orderType, tokenSymbol = 'CES') {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`💱 User ${chatId} selecting currency for ${orderType} ${tokenSymbol} order`);
      
      // Validate user profile completion before allowing order creation
      const P2PDataHandler = require('./P2PDataHandler');
      const dataHandler = new P2PDataHandler();
      const validation = await dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_menu')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // Get supported currencies
      const currencies = fiatCurrencyService.getSupportedCurrencies();
      
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'ПОКУПКИ' : 'ПРОДАЖИ';
      
      const message = `${typeEmoji} ${typeText} ${tokenSymbol} ТОКЕНОВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `💱 Выберите валюту для торговли:\n\n` +
                     `Доступные фиатные валюты:`;
      
      // Create currency selection buttons (2 per row)
      const currencyButtons = [];
      for (let i = 0; i < currencies.length; i += 2) {
        const row = [];
        
        // First currency in row
        const currency1 = currencies[i];
        row.push(Markup.button.callback(
          `${currency1.flag} ${currency1.code} ${currency1.symbol}`,
          `p2p_currency_selected_${orderType}_${tokenSymbol.toLowerCase()}_${currency1.code}`
        ));
        
        // Second currency in row (if exists)
        if (i + 1 < currencies.length) {
          const currency2 = currencies[i + 1];
          row.push(Markup.button.callback(
            `${currency2.flag} ${currency2.code} ${currency2.symbol}`,
            `p2p_currency_selected_${orderType}_${tokenSymbol.toLowerCase()}_${currency2.code}`
          ));
        }
        
        currencyButtons.push(row);
      }
      
      // Add back button
      currencyButtons.push([Markup.button.callback('🔙 Назад', 'p2p_menu')]);
      
      const keyboard = Markup.inlineKeyboard(currencyButtons);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P currency selection error:', error);
      await ctx.reply('❌ Ошибка выбора валюты. Попробуйте позже.');
    }
  }

  // Handle currency selection confirmation
  async handleP2PCurrencySelected(ctx, orderType, tokenSymbol, currencyCode) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`💱 User ${chatId} selected ${currencyCode} for ${orderType} ${tokenSymbol} order`);
      
      // Validate currency support
      if (!fiatCurrencyService.isCurrencySupported(currencyCode)) {
        return await ctx.reply('❌ Выбранная валюта не поддерживается.');
      }
      
      const currency = fiatCurrencyService.getCurrencyMetadata(currencyCode);
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'ПОКУПКА' : 'ПРОДАЖА';
      
      // Special handling for sell orders - check token balance
      if (orderType === 'sell') {
        let hasBalance = false;
        let tokenBalance = 0;
        
        if (tokenSymbol === 'CES') {
          const walletInfo = await walletService.getUserWallet(chatId);
          tokenBalance = walletInfo.cesBalance;
          hasBalance = tokenBalance >= 0.1;
        } else {
          // For other tokens, check multi-chain wallet
          try {
            const multiChainWalletService = require('../services/multiChainWalletService');
            const userNetworkService = require('../services/userNetworkService');
            const currentNetwork = await userNetworkService.getUserNetwork(chatId);
            const walletInfo = await multiChainWalletService.getMultiChainWalletInfo(chatId);
            const networkBalances = walletInfo.networks[currentNetwork];
            if (networkBalances && networkBalances.tokens && networkBalances.tokens[tokenSymbol]) {
              tokenBalance = networkBalances.tokens[tokenSymbol].balance || 0;
            }
            hasBalance = tokenBalance >= 0.001;
          } catch (balanceError) {
            console.error(`Error getting ${tokenSymbol} balance:`, balanceError);
            hasBalance = false;
          }
        }
        
        if (!hasBalance) {
          const message = `.DataGridViewColumn ПРОДАЖА ${tokenSymbol} ТОКЕНОВ\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖\n` +
                         `${currency.flag} Валюта: ${currency.nameRu}\n` +
                         `⚠️ Недостаточно ${tokenSymbol} для продажи\n` +
                         `Баланс: ${tokenBalance.toFixed(6)} ${tokenSymbol}\n\n` +
                         `Информация:\n` +
                         `• Минимальная сумма: ${tokenSymbol === 'CES' ? '0.1' : '0.001'} ${tokenSymbol}\n` +
                         `• Комиссия платформы: 1%\n\n` +
                         `💡 Пополните баланс ${tokenSymbol}`;
          
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Выбрать другую валюту', `p2p_currency_selection_${orderType}_${tokenSymbol.toLowerCase()}`)],
            [Markup.button.callback('🔙 Назад', 'p2p_menu')]
          ]);
          
          return await ctx.reply(message, keyboard);
        }
      }
      
      // Store currency selection in session
      sessionManager.setSessionData(chatId, 'selectedCurrency', currencyCode);
      
      // Get current market price for display
      let priceText = '';
      try {
        // For now, show that price is loading - will be updated by startRealTimePriceUpdates
        priceText = `⏳ Загружаем актуальную цену...\n`;
      } catch (error) {
        priceText = `⚠️ Ошибка загрузки цены\n`;
      }
      
      // Send order creation interface with currency context
      const initialMessage = `${typeEmoji} ${typeText} ${tokenSymbol} ТОКЕНОВ\n` +
                            `➖➖➖➖➖➖➖➖➖➖➖\n` +
                            `${currency.flag} Валюта: ${currency.nameRu} (${currency.code})\n` +
                            priceText + '\n' +
                            `⚠️ Введите [кол-во, ${tokenSymbol}] [цена_за_токен, ${currency.symbol}] [мин_сумма, ${currency.symbol}] [макс_сумма, ${currency.symbol}]\n` +
                            `💡 Пример: 10 245 1000 2450\n\n` +
                            `Информация:\n` +
                            `• Минимальная сумма в ${currency.code}: эквивалент 10 ${currency.symbol}\n` +
                            `• Комиссия платформы: 1% (только с мейкеров)`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить цену', `refresh_price_${orderType}_${tokenSymbol.toLowerCase()}_${currencyCode}`)],
        [Markup.button.callback('💱 Сменить валюту', `p2p_currency_selection_${orderType}_${tokenSymbol.toLowerCase()}`)],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      const sentMessage = await ctx.reply(initialMessage, keyboard);
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P ${orderType} order session for ${chatId} with token ${tokenSymbol} and currency ${currencyCode}`);
      sessionManager.setP2POrderState(chatId, orderType, tokenSymbol);
      
      // Start real-time price updates with currency context
      this.startRealTimePriceUpdates(ctx, sentMessage, orderType, null, tokenSymbol, currencyCode);
      
    } catch (error) {
      console.error('P2P currency selected error:', error);
      await ctx.reply('❌ Ошибка обработки выбранной валюты.');
    }
  }
}

module.exports = P2PHandler;