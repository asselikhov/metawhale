/**
 * Main Message Handler (Refactored)
 * Delegates to specialized handlers for different functionality areas
 */

const { Markup } = require('telegraf');
const BaseCommandHandler = require('./BaseCommandHandler');
const WalletHandler = require('./WalletHandler');
const TransferHandler = require('./TransferHandler');
const P2PHandler = require('./P2PHandler');
const P2POrdersHandler = require('./P2POrdersHandler');
const P2PDataHandler = require('./P2PDataHandler');
const sessionManager = require('./SessionManager');
const config = require('../config/configuration');

class MessageHandler {
  constructor() {
    this.baseHandler = new BaseCommandHandler();
    this.walletHandler = new WalletHandler();
    this.transferHandler = new TransferHandler();
    this.p2pHandler = new P2PHandler();
    this.ordersHandler = new P2POrdersHandler();
    this.dataHandler = new P2PDataHandler();
    
    // Inject handlers into baseHandler to avoid circular imports
    this.baseHandler.setHandlers(this.walletHandler, this.p2pHandler, this.transferHandler, this.dataHandler);
  }

  // Session management methods (backward compatibility)
  getUserSession(chatId) {
    return sessionManager.getUserSession(chatId);
  }

  clearUserSession(chatId) {
    return sessionManager.clearUserSession(chatId);
  }

  setSessionData(chatId, key, value) {
    return sessionManager.setSessionData(chatId, key, value);
  }

  getSessionData(chatId, key) {
    return sessionManager.getSessionData(chatId, key);
  }

  // Delegate basic commands
  async handleStart(ctx) {
    return this.baseHandler.handleStart(ctx);
  }

  async handlePrice(ctx, tokenSymbol = 'CES') {
    return this.baseHandler.handlePrice(ctx, tokenSymbol);
  }

  async handleFees(ctx) {
    return this.baseHandler.handleFees(ctx);
  }

  async handleStat(ctx) {
    return this.baseHandler.handleStat(ctx);
  }

  async handleTextMessage(ctx) {
    const chatId = ctx.chat.id.toString();
    const sessionData = sessionManager.getUserSession(chatId);
    
    // Handle CES amount input in selling flow
    if (sessionData && sessionData.waitingForAmount) {
      return this.handleCESAmountInput(ctx, ctx.message.text);
    }
    
    // Handle CES amount input in buying flow
    if (sessionData && sessionData.waitingForBuyAmount) {
      return this.handleBuyAmountInput(ctx, ctx.message.text);
    }
    
    return this.baseHandler.handleTextMessage(ctx);
  }

  async handleBackToMenu(ctx) {
    return this.baseHandler.handleBackToMenu(ctx);
  }

  // Settings operations
  async handleSettingsMenu(ctx) {
    return this.baseHandler.handleSettingsMenu(ctx);
  }

  async handleLanguageSelection(ctx) {
    return this.baseHandler.handleLanguageSelection(ctx);
  }

  async handleLanguageSelected(ctx, languageCode) {
    return await this.baseHandler.handleLanguageSelected(ctx, languageCode);
  }

  // Network selection operations
  async handleNetworkSelection(ctx) {
    return this.baseHandler.handleNetworkSelection(ctx);
  }

  async handleNetworkSelected(ctx, networkId) {
    return this.baseHandler.handleNetworkSelected(ctx, networkId);
  }

  // Currency selection operations
  async handleCurrencySelection(ctx) {
    return this.baseHandler.handleCurrencySelection(ctx);
  }

  async handleCurrencySelected(ctx, currencyCode) {
    return this.baseHandler.handleCurrencySelected(ctx, currencyCode);
  }

  // Delegate wallet operations
  async handlePersonalCabinetText(ctx) {
    return this.walletHandler.handlePersonalCabinetText(ctx);
  }

  async handleUserProfile(ctx) {
    return this.walletHandler.handleUserProfile(ctx);
  }

  async handleCreateWallet(ctx) {
    return this.walletHandler.handleCreateWallet(ctx);
  }

  async handleWalletDetails(ctx) {
    return this.walletHandler.handleWalletDetails(ctx);
  }

  async handleWalletEdit(ctx) {
    return this.walletHandler.handleWalletEdit(ctx);
  }

  async handleShowPrivateKey(ctx) {
    return this.walletHandler.handleShowPrivateKey(ctx);
  }

  async handleExportWallet(ctx) {
    return this.walletHandler.handleExportWallet(ctx);
  }

  async handleDeleteWallet(ctx) {
    return this.walletHandler.handleDeleteWallet(ctx);
  }

  async handleConfirmDeleteWallet(ctx) {
    return this.walletHandler.handleConfirmDeleteWallet(ctx);
  }

  async handleRefreshBalance(ctx) {
    return this.walletHandler.handleRefreshBalance(ctx);
  }

  // Network switching operations
  async handleSwitchNetwork(ctx) {
    return this.walletHandler.handleSwitchNetwork(ctx);
  }

  async handleNetworkSwitch(ctx, networkId) {
    return this.walletHandler.handleNetworkSwitch(ctx, networkId);
  }

  // Delegate transfer operations
  async handleTransferMenu(ctx) {
    return this.transferHandler.handleTransferMenu(ctx);
  }

  async handleSendCESTokens(ctx) {
    return this.transferHandler.handleSendCESTokens(ctx);
  }

  async handleSendPOLTokens(ctx) {
    return this.transferHandler.handleSendPOLTokens(ctx);
  }

  async handleTransactionHistory(ctx) {
    return this.transferHandler.handleTransactionHistory(ctx);
  }

  async handleTransferConfirmation(ctx) {
    return this.transferHandler.handleTransferConfirmation(ctx);
  }

  async handleTransactionStatusCheck(ctx, txHashPart) {
    return this.transferHandler.handleTransactionStatusCheck(ctx, txHashPart);
  }

  async processTransferCommand(ctx, transferData, tokenType) {
    return this.transferHandler.processTransferCommand(ctx, transferData, tokenType);
  }

  // Delegate P2P operations
  async handleP2PMenu(ctx) {
    return this.p2pHandler.handleP2PMenu(ctx);
  }

  async handleP2PBuyCES(ctx) {
    return this.p2pHandler.handleP2PBuyCES(ctx);
  }

  async handleP2PSellCES(ctx) {
    return this.p2pHandler.handleP2PSellCES(ctx);
  }

  async handleP2PMarketOrders(ctx) {
    return this.p2pHandler.handleP2PMarketOrders(ctx);
  }

  async handleP2PTopTraders(ctx) {
    return this.p2pHandler.handleP2PTopTraders(ctx);
  }

  async handleP2PMyData(ctx) {
    return this.p2pHandler.handleP2PMyData(ctx);
  }
  
  // Handle real-time price refresh
  async handlePriceRefresh(ctx, orderType) {
    return this.p2pHandler.handlePriceRefresh(ctx, orderType);
  }

  // Handle P2P token selection and multi-token trading
  async handleP2PTokenSelect(ctx, tokenSymbol) {
    return this.p2pHandler.handleP2PTokenSelect(ctx, tokenSymbol);
  }

  async handleP2PBuyToken(ctx, tokenSymbol) {
    return this.p2pHandler.handleP2PBuyToken(ctx, tokenSymbol);
  }

  async handleP2PSellToken(ctx, tokenSymbol) {
    return this.p2pHandler.handleP2PSellToken(ctx, tokenSymbol);
  }

  // Handle P2P currency selection for multi-currency support
  async handleP2PCurrencySelection(ctx, orderType, tokenSymbol) {
    return this.p2pHandler.handleP2PCurrencySelection(ctx, orderType, tokenSymbol);
  }

  async handleP2PCurrencySelected(ctx, orderType, tokenSymbol, currencyCode) {
    return this.p2pHandler.handleP2PCurrencySelected(ctx, orderType, tokenSymbol, currencyCode);
  }

  // Updated price refresh handler with currency support
  async handlePriceRefresh(ctx, orderType, tokenSymbol = null, currencyCode = null) {
    return this.p2pHandler.handlePriceRefresh(ctx, orderType, tokenSymbol, currencyCode);
  }

  // Delegate P2P data operations
  async handleP2PEditData(ctx) {
    return this.dataHandler.handleP2PEditData(ctx);
  }

  async handleP2PEditFullName(ctx) {
    return this.dataHandler.handleP2PEditFullName(ctx);
  }

  async handleP2PEditPaymentMethods(ctx) {
    return this.dataHandler.handleP2PEditPaymentMethods(ctx);
  }

  async handleP2PToggleBank(ctx, bankCode) {
    return this.dataHandler.handleP2PToggleBank(ctx, bankCode);
  }

  async handleP2PSavePaymentMethods(ctx) {
    return this.dataHandler.handleP2PSavePaymentMethods(ctx);
  }

  async handleP2PEditContact(ctx) {
    return this.dataHandler.handleP2PEditContact(ctx);
  }

  async handleP2PEditConditions(ctx) {
    return this.dataHandler.handleP2PEditConditions(ctx);
  }

  async handleP2PEditTradeTime(ctx) {
    return this.dataHandler.handleP2PEditTradeTime(ctx);
  }

  async handleP2PSetTradeTime(ctx, timeMinutes) {
    return this.dataHandler.handleP2PSetTradeTime(ctx, timeMinutes);
  }

  async handleP2PToggleUseInOrders(ctx) {
    return this.dataHandler.handleP2PToggleUseInOrders(ctx);
  }

  async handleP2PBuyerView(ctx) {
    return this.dataHandler.handleP2PBuyerView(ctx);
  }

  async processP2POrder(ctx, orderData, orderType) {
    return this.p2pHandler.processP2POrder(ctx, orderData, orderType);
  }

  async processUserMessage(ctx, text) {
    return this.p2pHandler.processUserMessage(ctx, text);
  }

  // Delegate P2P orders operations
  async handleP2PBuyOrders(ctx, page) {
    // Get selected token from session
    const chatId = ctx.chat.id.toString();
    const sessionManager = require('./SessionManager');
    const selectedToken = sessionManager.getSessionData(chatId, 'selectedToken') || 'CES';
    
    // Pass token to orders handler
    return this.ordersHandler.handleP2PBuyOrders(ctx, page, selectedToken);
  }

  async handleP2PSellOrders(ctx, page) {
    // Get selected token from session
    const chatId = ctx.chat.id.toString();
    const sessionManager = require('./SessionManager');
    const selectedToken = sessionManager.getSessionData(chatId, 'selectedToken') || 'CES';
    
    // Pass token to orders handler
    return this.ordersHandler.handleP2PSellOrders(ctx, page, selectedToken);
  }

  async handleP2PMyOrders(ctx, page) {
    return this.ordersHandler.handleP2PMyOrders(ctx, page);
  }

  // P2P Analytics implementation
  async handleP2PAnalytics(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const { User } = require('../database/models');
      const analyticsService = require('../services/analyticsService');
      const reputationService = require('../services/reputationService');
      
      // Get user
      const user = await User.findOne({ chatId });
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }

      // Get comprehensive user analytics
      const [userStats, userAnalytics, marketStats] = await Promise.all([
        reputationService.getStandardizedUserStats(user._id),
        analyticsService.getUserPerformanceAnalytics(user._id, '30d'),
        analyticsService.getTradingStatistics('30d')
      ]);

      // Format user statistics message
      const message = `📊 МОЯ АНАЛИТИКА (за 30 дней)\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `🎆 Мой рейтинг: ${userStats.rating}\n` +
                     `📝 Создано ордеров: ${userStats.ordersLast30Days} шт.\n` +
                     `✅ Процент исполнения: ${userStats.completionRateLast30Days}%\n` +
                     `⏱️ Среднее время перевода: ${userStats.avgTransferTime} мин.\n` +
                     `💳 Среднее время оплаты: ${userStats.avgPaymentTime} мин.\n\n` +
                     `💹 МОИ СДЕЛКИ:\n` +
                     `• Всего: ${userAnalytics.activity.totalTrades}\n` +
                     `• Покупки: ${userAnalytics.activity.buyTrades}\n` +
                     `• Продажи: ${userAnalytics.activity.sellTrades}\n` +
                     `• Завершено: ${userAnalytics.activity.completedTrades}\n` +
                     `• Споров: ${userAnalytics.activity.disputedTrades}\n\n` +
                     `📈 ОБЪЕМ ТОРГОВ:\n` +
                     `• Общий объем: ₽ ${(userAnalytics.performance.totalVolume || 0).toFixed(2)}\n` +
                     `• Средняя сделка: ₽ ${(userAnalytics.performance.avgTradeSize || 0).toFixed(2)}\n` +
                     `• Успешность: ${userAnalytics.performance.successRate || 0}%\n\n` +
                     `🏆 МЕСТО НА РЫНКЕ:\n` +
                     `• Общий объем рынка: ₽ ${(marketStats.volume.totalRubles || 0).toFixed(2)}\n` +
                     `• Всего сделок: ${marketStats.trades.total || 0}\n` +
                     `• Активных трейдеров: ${marketStats.users.uniqueTraders || 0}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_analytics')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);

      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P Analytics error:', error);
      await ctx.reply('❌ Ошибка загрузки аналитики. Попробуйте позже.');
    }
  }

  async handleUserMessaging(ctx, targetUserId) {
    await ctx.reply('🚧 Функция личных сообщений в разработке');
  }

  async handleCancelOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Cancel the order using P2P service
      const p2pService = require('../services/p2pService');
      const cancelledOrder = await p2pService.cancelOrder(chatId, orderId);
      
      // Send simple success message
      await ctx.reply('✅ Ордер успешно отменен!');
      
      // Automatically return to P2P exchange page
      const P2PHandler = require('./P2PHandler');
      const p2pHandler = new P2PHandler();
      await p2pHandler.handleP2PMenu(ctx);
      
    } catch (error) {
      console.error('Cancel order error:', error);
      
      // Handle specific error cases
      if (error.message === 'Пользователь не найден') {
        await ctx.reply('❌ Пользователь не найден.');
      } else if (error.message === 'Ордер не найден или уже завершен') {
        await ctx.reply('❌ Ордер не найден или уже завершен.');
      } else {
        await ctx.reply('❌ Ошибка отмены ордера.');
      }
    }
  }

  async handleP2POrderConfirmation(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Защита от повторных вызовов callback
      const processingKey = `processing_order_${chatId}`;
      if (sessionManager.getSessionData(chatId, processingKey)) {
        console.log(`🚫 Order confirmation already in progress for user ${chatId}`);
        return; // Просто игнорируем повторные вызовы
      }
      
      // Маркируем как обрабатываемые
      sessionManager.setSessionData(chatId, processingKey, true);
      
      // Double-click protection: Get pending data but don't clear until process completes
      const pendingOrder = sessionManager.getPendingP2POrder(chatId);
      
      if (!pendingOrder) {
        sessionManager.setSessionData(chatId, processingKey, false);
        return await ctx.reply('❌ Ордер не найден. Попробуйте создать ордер заново.');
      }
      
      // Don't clear session here - it's needed for smart contract approval flow
      
      const { orderType, amount, pricePerToken, minAmount, maxAmount } = pendingOrder;
      
      // Validate user profile completion before order creation
      const validation = await this.dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_menu')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // Get user
      const { User } = require('../database/models');
      const user = await User.findOne({ chatId });
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Check wallet
      const walletService = require('../services/walletService');
      const walletInfo = await walletService.getUserWallet(chatId);
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.reply('❌ Сначала создайте кошелек.');
      }
      
      // Check if this is a sell order and smart contract escrow is enabled
      const useSmartContract = process.env.USE_SMART_CONTRACT_ESCROW === 'true';
      const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
      
      if (orderType === 'sell' && useSmartContract && escrowContractAddress) {
        // Show smart contract approval flow for sell orders
        return await this.handleSmartContractApprovalFlow(ctx, pendingOrder, user);
      }
      
      // For buy orders, check CES balance
      if (orderType === 'sell') {
        if (walletInfo.cesBalance < amount) {
          return await ctx.reply(`❌ Недостаточно CES токенов. Доступно: ${walletInfo.cesBalance.toFixed(4)} CES`);
        }
      }
      
      // Create order (legacy database-only escrow)
      const p2pService = require('../services/p2pService');
      
      // Get selected currency from pending order or session
      const selectedCurrency = pendingOrder.currency || sessionManager.getSessionData(chatId, 'selectedCurrency') || 'RUB';
      
      let order;
      
      try {
        if (orderType === 'buy') {
          order = await p2pService.createBuyOrder(chatId, amount, pricePerToken, selectedCurrency, minAmount, maxAmount);
        } else {
          // Get payment methods for sell order and convert to enum values
          const userPaymentMethods = user.p2pProfile?.paymentMethods?.filter(pm => pm.isActive) || [];
          
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
          
          // Convert user payment methods to enum values
          const paymentMethods = userPaymentMethods.map(pm => 
            paymentMethodMapping[pm.bank] || 'bank_transfer'
          );
          
          // Ensure at least one payment method
          if (paymentMethods.length === 0) {
            paymentMethods.push('bank_transfer');
          }
          
          order = await p2pService.createSellOrder(chatId, amount, pricePerToken, paymentMethods, minAmount, maxAmount);
        }
        
        sessionManager.clearUserSession(chatId);
        sessionManager.setSessionData(chatId, processingKey, false);
        
      } catch (error) {
        console.error('Order creation error:', error);
        // Clear session on error as well
        sessionManager.clearUserSession(chatId);
        sessionManager.setSessionData(chatId, processingKey, false);
        return await ctx.reply(`❌ Ошибка создания ордера: ${error.message}`);
      }
      
      // Send simple success message
      await ctx.reply('✅ ОРДЕР УСПЕШНО СОЗДАН !');
      
      // Automatically return to P2P exchange page
      const P2PHandler = require('./P2PHandler');
      const p2pHandler = new P2PHandler();
      await p2pHandler.handleP2PMenu(ctx);
      
    } catch (error) {
      console.error('P2P order confirmation error:', error);
      // Clear session on error to prevent stuck states
      const chatId = ctx.chat.id.toString();
      const processingKey = `processing_order_${chatId}`;
      sessionManager.clearUserSession(chatId);
      sessionManager.setSessionData(chatId, processingKey, false);
      await ctx.reply('❌ Ошибка подтверждения ордера.');
    }
  }

  // Handle P2P order confirmation
  async handleP2POrderConfirmation(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const pendingOrder = sessionManager.getPendingP2POrder(chatId);
      
      if (!pendingOrder) {
        return await ctx.reply('❌ Ордер не найден. Создайте новый ордер.');
      }
      
      const { 
        orderType, 
        amount, 
        pricePerToken, 
        minAmount, 
        maxAmount,
        tokenType = 'CES',
        network = 'polygon',
        currency = 'RUB'
      } = pendingOrder;
      
      // Clear pending order from session
      sessionManager.setSessionData(chatId, 'pendingP2POrder', null);
      
      const p2pService = require('../services/p2pService');
      
      try {
        let result;
        if (orderType === 'buy') {
          result = await p2pService.createBuyOrder(
            chatId, 
            amount, 
            pricePerToken, 
            minAmount, 
            maxAmount,
            tokenType,
            network,
            currency
          );
        } else {
          // For sell orders, get payment methods from user profile
          const { User } = require('../database/models');
          const user = await User.findOne({ chatId });
          if (!user || !user.p2pProfile || !user.p2pProfile.paymentMethods) {
            throw new Error('Профиль пользователя не найден');
          }
          
          // Filter only active payment methods
          const activePaymentMethods = user.p2pProfile.paymentMethods
            .filter(pm => pm.isActive)
            .map(pm => 'bank_transfer'); // Map to standard payment method
          
          if (activePaymentMethods.length === 0) {
            throw new Error('Активные способы оплаты не найдены');
          }
          
          result = await p2pService.createSellOrder(
            chatId, 
            amount, 
            pricePerToken, 
            activePaymentMethods,
            minAmount, 
            maxAmount,
            tokenType,
            network,
            currency
          );
        }
        
        const typeText = orderType === 'buy' ? 'покупки' : 'продажи';
        const tokenText = tokenType || 'CES';
        const networkText = network || 'polygon';
        const currencyText = currency || 'RUB';
        
        await ctx.reply(`✅ Ордер на ${typeText} ${tokenText} в сети ${networkText} успешно создан!\n\n` +
                       `💱 Валюта: ${currencyText}\n` +
                       `💰 Количество: ${amount} ${tokenText}\n` +
                       `💵 Цена: ${pricePerToken} ${currencyText}/${tokenText}\n\n` +
                       `📊 Ордер будет автоматически сопоставлен с подходящими предложениями.`);
        
      } catch (error) {
        console.error('Order creation error:', error);
        let errorMessage = '❌ Ошибка создания ордера';
        
        if (error.message.includes('Пользователь не найден')) {
          errorMessage = '❌ Пользователь не найден';
        } else if (error.message.includes('Заполните профиль P2P')) {
          errorMessage = '❌ Заполните профиль P2P для создания ордеров';
        } else if (error.message.includes('лимит')) {
          errorMessage = `❌ ${error.message}`;
        } else if (error.message.includes('средств')) {
          errorMessage = `❌ ${error.message}`;
        }
        
        await ctx.reply(`${errorMessage}\n\nПодробности: ${error.message}`);
      }
      
    } catch (error) {
      console.error('P2P order confirmation error:', error);
      await ctx.reply('❌ Ошибка подтверждения ордера.');
    }
  }

  // Handle smart contract approval flow for secure escrow
  async handleSmartContractApprovalFlow(ctx, pendingOrder, user) {
    try {
      const { amount } = pendingOrder;
      const chatId = ctx.chat.id.toString();
      const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
      
      // Check current allowance for the escrow contract
      const { ethers } = require('ethers');
      const config = require('../config/configuration');
      
      // Ensure ethers providers are available
      const providers = ethers.providers || ethers;
      const utils = ethers.utils || ethers;
      
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      
      const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
      const erc20Abi = [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)"
      ];
      
      const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);
      const currentAllowance = await cesContract.allowance(user.walletAddress, escrowContractAddress);
      const requiredAmount = utils.parseEther(amount.toString());
      
      console.log(`🔍 Smart contract approval check:`);
      console.log(`Required: ${utils.formatEther(requiredAmount)} CES`);
      console.log(`Current allowance: ${utils.formatEther(currentAllowance)} CES`);
      
      if (currentAllowance >= requiredAmount) {
        // Sufficient allowance, proceed with order creation
        return await this.proceedWithSecureOrderCreation(ctx, pendingOrder, user);
      }
      
      // Need approval, show approval UI
      const message = `🔐 БЕЗОПАСНЫЙ ЭСКРОУ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `🛡️ Ваши CES токены будут заблокированы \nв смарт-контракте !\n\n` +
                     `📋 К одобрению: ${amount} CES\n` +
                     `📍 Контракт: ${escrowContractAddress.slice(0,6)}...${escrowContractAddress.slice(-4)}\n\n` +
                     `⚠️ Продолжить?`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Одобрить и создать', 'approve_and_create_order')],
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Smart contract approval flow error:', error);
      await ctx.reply('❌ Ошибка проверки одобрения токенов.');
    }
  }

  // Proceed with creating order using secure smart contract escrow
  async proceedWithSecureOrderCreation(ctx, pendingOrder, user) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Защита от повторных вызовов
      const secureProcessingKey = `secure_processing_${chatId}`;
      if (sessionManager.getSessionData(chatId, secureProcessingKey)) {
        console.log(`🚫 Secure order creation already in progress for user ${chatId}`);
        return; // Просто игнорируем повторные вызовы
      }
      
      // Маркируем как обрабатываемые
      sessionManager.setSessionData(chatId, secureProcessingKey, true);
      
      const { orderType, amount, pricePerToken, minAmount, maxAmount } = pendingOrder;
      
      const message = `🛡️ СОЗДАНИЕ БЕЗОПАСНОГО ОРДЕРА !\n` +
                     `⏳ Ожидайте, обрабатываем запрос...`;
      
      await ctx.reply(message);
      
      // Create order with smart contract escrow
      const p2pService = require('../services/p2pService');
      
      // Get selected currency from pending order or session
      const selectedCurrency = pendingOrder.currency || sessionManager.getSessionData(chatId, 'selectedCurrency') || 'RUB';
      
      let order;
      
      try {
        if (orderType === 'buy') {
          order = await p2pService.createBuyOrder(chatId, amount, pricePerToken, selectedCurrency, minAmount, maxAmount);
        } else {
          // Get payment methods for sell order and convert to enum values
          const userPaymentMethods = user.p2pProfile?.paymentMethods?.filter(pm => pm.isActive) || [];
          
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
          
          // Convert user payment methods to enum values
          const paymentMethods = userPaymentMethods.map(pm => 
            paymentMethodMapping[pm.bank] || 'bank_transfer'
          );
          
          // Ensure at least one payment method
          if (paymentMethods.length === 0) {
            paymentMethods.push('bank_transfer');
          }
          
          order = await p2pService.createSellOrder(chatId, amount, pricePerToken, paymentMethods, minAmount, maxAmount);
        }
        
        // Clear pending order from session
        sessionManager.clearUserSession(chatId);
        
        // Send success message
        const successMessage = `✅ ОРДЕР УСПЕШНО СОЗДАН !`;
        
        await ctx.reply(successMessage);
        
        // Automatically return to P2P exchange page
        const P2PHandler = require('./P2PHandler');
        const p2pHandler = new P2PHandler();
        await p2pHandler.handleP2PMenu(ctx);
        
        // Очищаем флаг обработки после успешного создания ордера
        const secureProcessingKey = `secure_processing_${chatId}`;
        sessionManager.setSessionData(chatId, secureProcessingKey, false);
        
      } catch (error) {
        console.error('Secure order creation error:', error);
        // Clear session on error
        const secureProcessingKey = `secure_processing_${chatId}`;
        sessionManager.clearUserSession(chatId);
        sessionManager.setSessionData(chatId, secureProcessingKey, false);
        await ctx.reply(`❌ Ошибка создания безопасного ордера: ${error.message}`);
      }
      
    } catch (error) {
      console.error('Proceed with secure order creation error:', error);
      // Clear session on error
      const chatId = ctx.chat.id.toString();
      const secureProcessingKey = `secure_processing_${chatId}`;
      sessionManager.clearUserSession(chatId);
      sessionManager.setSessionData(chatId, secureProcessingKey, false);
      await ctx.reply('❌ Ошибка создания ордера.');
    }
  }

  // Handle approve and create order for smart contract escrow
  async handleApproveAndCreateOrder(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const pendingOrder = sessionManager.getPendingP2POrder(chatId);
      
      if (!pendingOrder) {
        return await ctx.reply('❌ Ордер не найден. Попробуйте создать ордер заново.');
      }
      
      const { amount } = pendingOrder;
      
      // Get user
      const { User } = require('../database/models');
      const user = await User.findOne({ chatId });
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Get user's private key
      const walletService = require('../services/walletService');
      const privateKey = await walletService.getUserPrivateKey(chatId);
      
      if (!privateKey) {
        return await ctx.reply('❌ Не удалось получить ключ кошелька.');
      }
      
      // Show approval transaction UI
      const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
      const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
      
      const message = `⏳ Ожидайте выполнения транзакции...`;
      
      await ctx.reply(message);
      
      try {
        // Execute the approval transaction
        const { ethers } = require('ethers');
        const config = require('../config/configuration');
        
        // Ensure ethers providers are available
        const providers = ethers.providers || ethers;
        const utils = ethers.utils || ethers;
        
        const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        const erc20Abi = [
          "function approve(address spender, uint256 amount) returns (bool)"
        ];
        
        const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, wallet);
        const approvalAmount = utils.parseEther(amount.toString());
        
        console.log(`🔐 Executing approval transaction:`);
        console.log(`Amount: ${amount} CES`);
        console.log(`Spender: ${escrowContractAddress}`);
        
        const tx = await cesContract.approve(escrowContractAddress, approvalAmount, {
          gasLimit: 100000,
          gasPrice: utils.parseUnits('30', 'gwei')
        });
        
        console.log(`⏳ Approval transaction sent: ${tx.hash}`);
        
        const progressMessage = `✅ ТРАНЗАКЦИЯ ОТПРАВЛЕНА !\n` +
                               `⏳ Ожидаем подтверждение...`;
        
        await ctx.reply(progressMessage);
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        console.log(`✅ Approval transaction confirmed: ${receipt.transactionHash}`);
        
        // Now proceed with order creation
        await this.proceedWithSecureOrderCreation(ctx, pendingOrder, user);
        
      } catch (error) {
        console.error('Token approval error:', error);
        
        let errorMessage = '❌ Ошибка одобрения токенов';
        
        if (error.code === 'INSUFFICIENT_FUNDS') {
          errorMessage = '❌ Недостаточно MATIC для оплаты газа';
        } else if (error.code === 'CALL_EXCEPTION') {
          errorMessage = '❌ Ошибка вызова смарт-контракта';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = '❌ Недостаточно средств на балансе';
        }
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Повторить', 'approve_and_create_order')],
          [Markup.button.callback('❌ Отмена', 'p2p_menu')]
        ]);
        
        // Clear session on approval error
        sessionManager.clearUserSession(chatId);
        
        await ctx.reply(`${errorMessage}\n\nПодробности: ${error.message}`, keyboard);
      }
      
    } catch (error) {
      console.error('Approve and create order error:', error);
      // Clear session on error to prevent stuck states
      sessionManager.clearUserSession(ctx.chat.id.toString());
      await ctx.reply('❌ Ошибка обработки запроса.');
    }
  }

  async handleCreateOrderWithUser(ctx, userId) {
    await ctx.reply('🚧 Функция создания ордера с пользователем в разработке');
  }

  async handleCreateBuyOrderWithUser(ctx, userId) {
    await ctx.reply('🚧 Функция создания ордера на покупку в разработке');
  }

  async handleCreateSellOrderWithUser(ctx, userId) {
    await ctx.reply('🚧 Функция создания ордера на продажу в разработке');
  }

  async handleConfirmCancelOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Cancel the order using P2P service
      const p2pService = require('../services/p2pService');
      const cancelledOrder = await p2pService.cancelOrder(chatId, orderId);
      
      // Send simple success message
      await ctx.reply('✅ Ордер успешно отменен!');
      
      // Automatically return to P2P exchange page
      const P2PHandler = require('./P2PHandler');
      const p2pHandler = new P2PHandler();
      await p2pHandler.handleP2PMenu(ctx);
      
    } catch (error) {
      console.error('Confirm cancel order error:', error);
      
      // Handle specific error cases
      if (error.message === 'Пользователь не найден') {
        await ctx.reply('❌ Пользователь не найден.');
      } else if (error.message === 'Ордер не найден или уже завершен') {
        await ctx.reply('❌ Ордер не найден или уже завершен.');
      } else {
        await ctx.reply('❌ Ошибка отмены ордера.');
      }
    }
  }

  async handleP2PUserProfile(ctx, userId) {
    await ctx.reply('🚧 Функция просмотра профиля пользователя в разработке');
  }

  async handleEnterAmount(ctx, userId) {
    await ctx.reply('🚧 Функция ввода суммы в разработке');
  }

  async handleContinueSellOrder(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const buyOrderData = sessionManager.getSessionData(chatId, 'currentBuyOrder');
      
      if (!buyOrderData) {
        return await ctx.reply('❌ Данные ордера не найдены.');
      }
      
      const message = `💰 ВВОД КОЛИЧЕСТВА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Цена: ${buyOrderData.pricePerToken.toFixed(2)} ₽ за CES\n` +
                     `Доступно: ${buyOrderData.availableAmount.toFixed(2)} CES\n` +
                     `Лимиты: ${buyOrderData.minAmount}-${buyOrderData.maxAmount} CES\n\n` +
                     `Введите количество CES:`;
      
      sessionManager.setSessionData(chatId, 'waitingForCESAmount', true);
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_sell_orders')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Ошибка продолжения продажи:', error);
      await ctx.reply('❌ Ошибка обработки запроса.');
    }
  }

  async handleBuyOrderDetails(ctx, userId, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Проверяем завершённость профиля перед взаимодействием с мейкерами
      const validation = await this.dataHandler.validateUserForP2POperations(chatId);
      
      if (!validation.valid) {
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_buy_orders')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // Получаем ордер мейкера (ордер на продажу CES)
      const { P2POrder, User } = require('../database/models');
      const reputationService = require('../services/reputationService');
      
      const sellOrder = await P2POrder.findById(orderId).populate('userId');
      if (!sellOrder || sellOrder.type !== 'sell' || sellOrder.status !== 'active') {
        return await ctx.reply('❌ Ордер не найден или неактивен.');
      }
      
      const maker = sellOrder.userId; // Мейкер (продавец CES)
      
      // Проверяем, что пользователь не пытается торговать со своим ордером
      const currentUser = await User.findOne({ chatId });
      if (!currentUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      if (maker._id.toString() === currentUser._id.toString()) {
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_buy_orders')]
        ]);
        return await ctx.reply('⚠️ Вы не можете исполнить свой собственный ордер', keyboard);
      }
      
      const stats = await reputationService.getStandardizedUserStats(maker._id);
      
      // Получаем имя мейкера
      let makerName = 'Пользователь';
      if (maker.p2pProfile && maker.p2pProfile.fullName) {
        makerName = maker.p2pProfile.fullName;
      } else if (maker.firstName) {
        makerName = maker.firstName;
        if (maker.lastName) {
          makerName += ` ${maker.lastName}`;
        }
      }
      
      // Рассчитываем лимиты
      const minAmount = sellOrder.minTradeAmount || 0.01;
      const maxAmount = Math.min(sellOrder.maxTradeAmount || sellOrder.remainingAmount, sellOrder.remainingAmount);
      const minRubles = (minAmount * sellOrder.pricePerToken).toFixed(2);
      const maxRubles = (maxAmount * sellOrder.pricePerToken).toFixed(2);
      
      // Получаем условия мейкера
      const makerConditions = (maker.p2pProfile && maker.p2pProfile.makerConditions) ? 
                              maker.p2pProfile.makerConditions : 'Не указано';
      
      // Получаем способы оплаты мейкера
      let paymentMethods = [];
      if (maker.p2pProfile && maker.p2pProfile.paymentMethods) {
        paymentMethods = maker.p2pProfile.paymentMethods.filter(pm => pm.isActive && pm.cardNumber);
      }

      // Формируем строку способов оплаты
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
      
      let paymentMethodsText = 'Банковский перевод';
      if (paymentMethods.length > 0) {
        const bankNamesList = paymentMethods.map(pm => bankNames[pm.bank] || pm.bank).join(', ');
        paymentMethodsText = bankNamesList;
      }

      const message = `Цена: ${sellOrder.pricePerToken.toFixed(2)} ₽ за CES\n` +
                     `Количество: ${sellOrder.remainingAmount.toFixed(2)} CES\n` +
                     `Лимиты: ${minRubles}-${maxRubles} ₽\n` +
                     `Способ оплаты: ${paymentMethodsText}\n` +
                     `Длительность оплаты: ${config.escrow.displayFormat.minutes(sellOrder.tradeTimeLimit || config.escrow.timeoutMinutes)}\n\n` +
                     `Условия мейкера:\n` +
                     `${makerConditions}\n\n` +
                     `Сведения о мейкере:\n` +
                     `${makerName}\n` +
                     `Исполненные ордера за 30 дней: ${stats.ordersLast30Days} шт.\n` +
                     `Процент исполнения за 30 дней: ${stats.completionRateLast30Days}%\n` +
                     `Среднее время перевода: ${stats.avgTransferTime} мин.\n` +
                     `Среднее время оплаты: ${stats.avgPaymentTime} мин.\n` +
                     `Рейтинг: ${stats.rating}`;
      
      // Сохраняем информацию о ордере на продажу в сессии
      const sessionManager = require('./SessionManager');
      sessionManager.setSessionData(chatId, 'currentSellOrder', {
        sellOrderId: sellOrder._id,
        makerId: maker._id,
        makerChatId: maker.chatId,
        pricePerToken: sellOrder.pricePerToken,
        availableAmount: sellOrder.remainingAmount,
        minAmount: minAmount,
        maxAmount: maxAmount,
        minRubles: parseFloat(minRubles),
        maxRubles: parseFloat(maxRubles),
        paymentMethods: paymentMethods,
        tradeTimeLimit: sellOrder.tradeTimeLimit || 30
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Продолжить', 'continue_buy_order')],
        [Markup.button.callback('🔙 Назад', 'p2p_buy_orders')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Ошибка отображения деталей ордера:', error);
      await ctx.reply('❌ Ошибка отображения деталей ордера.');
    }
  }

  async handleSellOrderDetails(ctx, userId, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Проверяем завершённость профиля перед взаимодействием с мейкерами
      if (this.dataHandler) {
        const validation = await this.dataHandler.validateUserForP2POperations(chatId);
        
        if (!validation.valid) {
          const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_sell_orders')]]);
          return await ctx.reply(validation.message, keyboard);
        }
      }
      
      // Получаем ордер мейкера (ордер на покупку CES - мейкер хочет купить)
      const { P2POrder, User } = require('../database/models');
      const reputationService = require('../services/reputationService');
      
      const buyOrder = await P2POrder.findById(orderId).populate('userId');
      if (!buyOrder || buyOrder.type !== 'buy' || buyOrder.status !== 'active') {
        return await ctx.reply('❌ Ордер не найден или неактивен.');
      }
      
      const maker = buyOrder.userId; // Мейкер (покупатель CES)
      
      // Проверяем, что пользователь не пытается торговать со своим ордером
      const currentUser = await User.findOne({ chatId });
      if (!currentUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      if (maker._id.toString() === currentUser._id.toString()) {
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_sell_orders')]
        ]);
        return await ctx.reply('⚠️ Вы не можете исполнить свой собственный ордер', keyboard);
      }
      
      const stats = await reputationService.getStandardizedUserStats(maker._id);
      
      // Получаем имя мейкера
      let makerName = 'Пользователь';
      if (maker.p2pProfile && maker.p2pProfile.fullName) {
        makerName = maker.p2pProfile.fullName;
      } else if (maker.firstName) {
        makerName = maker.firstName;
        if (maker.lastName) {
          makerName += ` ${maker.lastName}`;
        }
      }
      
      // Рассчитываем лимиты
      const minAmount = buyOrder.minTradeAmount || 1;
      const maxAmount = Math.min(buyOrder.maxTradeAmount || buyOrder.remainingAmount, buyOrder.remainingAmount);
      const minRubles = (minAmount * buyOrder.pricePerToken).toFixed(2);
      const maxRubles = (maxAmount * buyOrder.pricePerToken).toFixed(2);
      
      // Получаем условия мейкера
      const makerConditions = (maker.p2pProfile && maker.p2pProfile.makerConditions) ? 
                              maker.p2pProfile.makerConditions : 'Не указано';
      
      // Получаем способы оплаты мейкера
      let paymentMethods = [];
      if (maker.p2pProfile && maker.p2pProfile.paymentMethods) {
        paymentMethods = maker.p2pProfile.paymentMethods.filter(pm => pm.isActive && pm.cardNumber);
      }
      
      // Формируем строку способов оплаты
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
      
      let paymentMethodsText = 'Банковский перевод';
      if (paymentMethods.length > 0) {
        const bankNamesList = paymentMethods.map(pm => bankNames[pm.bank] || pm.bank).join(', ');
        paymentMethodsText = bankNamesList;
      }
      
      const message = `Цена: ${buyOrder.pricePerToken.toFixed(2)} ₽ за CES\n` +
                     `Количество: ${buyOrder.remainingAmount.toFixed(2)} CES\n` +
                     `Лимиты: ${minRubles}-${maxRubles} ₽\n` +
                     `Способ оплаты: ${paymentMethodsText}\n` +
                     `Длительность оплаты: ${config.escrow.displayFormat.minutes(buyOrder.tradeTimeLimit || config.escrow.timeoutMinutes)}\n\n` +
                     `Условия мейкера:\n` +
                     `${makerConditions}\n\n` +
                     `Сведения о мейкере:\n` +
                     `${makerName}\n` +
                     `Исполненные ордера за 30 дней: ${stats.ordersLast30Days} шт.\n` +
                     `Процент исполнения за 30 дней: ${stats.completionRateLast30Days}%\n` +
                     `Среднее время перевода: ${stats.avgTransferTime} мин.\n` +
                     `Среднее время оплаты: ${stats.avgPaymentTime} мин.\n` +
                     `Рейтинг: ${stats.rating}`;
      
      // Сохраняем информацию о заказе в сессии
      const sessionManager = require('./SessionManager');
      sessionManager.setSessionData(chatId, 'currentBuyOrder', {
        buyOrderId: buyOrder._id,
        makerId: maker._id,
        makerChatId: maker.chatId,
        pricePerToken: buyOrder.pricePerToken,
        availableAmount: buyOrder.remainingAmount,
        minAmount: minAmount,
        maxAmount: maxAmount,
        minRubles: parseFloat(minRubles),
        maxRubles: parseFloat(maxRubles),
        paymentMethods: paymentMethods,
        tradeTimeLimit: buyOrder.tradeTimeLimit || 30
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Продолжить', 'continue_sell_order')],
        [Markup.button.callback('🔙 Назад', 'p2p_sell_orders')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Ошибка отображения деталей ордера на продажу:', error);
      await ctx.reply('❌ Ошибка отображения деталей ордера.');
    }
  }
  
  // New handlers for sell CES flow
  async handleContinueSellOrder(ctx) {
    const chatId = ctx.chat.id.toString();
    const sessionManager = require('./SessionManager');
    const orderData = sessionManager.getSessionData(chatId, 'currentBuyOrder');
    
    if (!orderData) {
      return await ctx.reply('❌ Данные ордера не найдены.');
    }
    
    const message = `Введите количество CES которое вы хотите продать:\n\n` +
                   `Минимум: ${orderData.minAmount} CES (${orderData.minRubles} ₽)\n` +
                   `Максимум: ${orderData.maxAmount} CES (${orderData.maxRubles} ₽)`;
    
    sessionManager.setSessionData(chatId, 'waitingForAmount', true);
    
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'p2p_sell_orders')]]);
    await ctx.reply(message, keyboard);
  }

  async handleContinueBuyOrder(ctx) {
    const chatId = ctx.chat.id.toString();
    const sessionManager = require('./SessionManager');
    const orderData = sessionManager.getSessionData(chatId, 'currentSellOrder');
    
    if (!orderData) {
      return await ctx.reply('❌ Данные ордера не найдены.');
    }
    
    const message = `Введите количество CES которое вы хотите купить:\n\n` +
                   `Минимум: ${orderData.minAmount} CES\n` +
                   `Максимум: ${orderData.maxAmount} CES`;
    
    sessionManager.setSessionData(chatId, 'waitingForBuyAmount', true);
    
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'p2p_buy_orders')]]);
    await ctx.reply(message, keyboard);
  }
  
  async handleBuyAmountInput(ctx, amountText) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const orderData = sessionManager.getSessionData(chatId, 'currentSellOrder');
      
      if (!orderData) {
        return await ctx.reply('❌ Данные ордера не найдены.');
      }
      
      // Parse and validate amount
      const amount = parseFloat(amountText.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        return await ctx.reply('❌ Неверный формат. Введите число больше 0.');
      }
      
      // Check against order limits
      if (amount < orderData.minAmount) {
        return await ctx.reply(`❌ Минимальная сумма: ${orderData.minAmount} CES`);
      }
      
      if (amount > orderData.maxAmount) {
        return await ctx.reply(`❌ Максимальная сумма: ${orderData.maxAmount} CES`);
      }
      
      // Calculate transaction details
      const totalPrice = amount * orderData.pricePerToken;
      
      // Check against maker's ruble limits
      if (orderData.minRubles && totalPrice < orderData.minRubles) {
        return await ctx.reply(`❌ Минимальная сумма мейкера: ${orderData.minRubles.toFixed(2)} ₽`);
      }
      
      if (orderData.maxRubles && totalPrice > orderData.maxRubles) {
        return await ctx.reply(`❌ Максимальная сумма мейкера: ${orderData.maxRubles.toFixed(2)} ₽`);
      }
      
      // Store confirmed amount in session
      sessionManager.setSessionData(chatId, 'confirmedBuyAmount', amount);
      sessionManager.setSessionData(chatId, 'totalBuyPrice', totalPrice);
      sessionManager.setSessionData(chatId, 'waitingForBuyAmount', false);
      
      // Show confirmation screen for buying
      const message = `Покупка CES\n` +
                     `Сумма ${totalPrice.toFixed(2)} ₽\n` +
                     `Цена: ${orderData.pricePerToken.toFixed(2)} ₽\n` +
                     `Общее количество: ${amount} CES\n` +
                     `Комиссия за транзакцию: 0 %`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Продолжить', 'continue_with_buy_payment')],
        [Markup.button.callback('🔙 Назад', 'back_to_buy_amount_input')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Buy amount input error:', error);
      await ctx.reply('❌ Ошибка обработки суммы.');
    }
  }
  
  async handleCESAmountInput(ctx, amountText) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const orderData = sessionManager.getSessionData(chatId, 'currentBuyOrder');
      
      if (!orderData) {
        return await ctx.reply('❌ Данные ордера не найдены.');
      }
      
      // Parse and validate amount
      const amount = parseFloat(amountText.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        return await ctx.reply('❌ Неверный формат. Введите число больше 0.');
      }
      
      // Check against order limits
      if (amount < orderData.minAmount) {
        return await ctx.reply(`❌ Минимальная сумма: ${orderData.minAmount} CES`);
      }
      
      if (amount > orderData.maxAmount) {
        return await ctx.reply(`❌ Максимальная сумма: ${orderData.maxAmount} CES`);
      }
      
      // Check user's CES balance
      const walletService = require('../services/walletService');
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (walletInfo.cesBalance < amount) {
        return await ctx.reply(`❌ Недостаточно CES. Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES`);
      }
      
      // Calculate transaction details
      const totalPrice = amount * orderData.pricePerToken;
      
      // Check against maker's ruble limits
      if (orderData.minRubles && totalPrice < orderData.minRubles) {
        return await ctx.reply(`❌ Минимальная сумма мейкера: ${orderData.minRubles.toFixed(2)} ₽`);
      }
      
      if (orderData.maxRubles && totalPrice > orderData.maxRubles) {
        return await ctx.reply(`❌ Максимальная сумма мейкера: ${orderData.maxRubles.toFixed(2)} ₽`);
      }
      
      // Store confirmed amount in session
      sessionManager.setSessionData(chatId, 'confirmedAmount', amount);
      sessionManager.setSessionData(chatId, 'totalPrice', totalPrice);
      sessionManager.setSessionData(chatId, 'waitingForAmount', false);
      
      // Show confirmation screen
      const message = `Продажа CES\n` +
                     `Сумма ${totalPrice.toFixed(2)} ₽\n` +
                     `Цена: ${orderData.pricePerToken.toFixed(2)} ₽\n` +
                     `Общее количество: ${amount} CES\n` +
                     `Комиссия за транзакцию: 0 %`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Продолжить', 'continue_with_payment')],
        [Markup.button.callback('🔙 Назад', 'back_to_amount_input')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('CES amount input error:', error);
      await ctx.reply('❌ Ошибка обработки суммы.');
    }
  }
  
  async handleConfirmSellAmount(ctx) {
    await ctx.reply('🚧 В разработке');
  }
  
  async handleBackToAmountInput(ctx) {
    return this.handleContinueSellOrder(ctx);
  }
  
  async handleBackToAmountConfirmation(ctx) {
    const chatId = ctx.chat.id.toString();
    const sessionManager = require('./SessionManager');
    const orderData = sessionManager.getSessionData(chatId, 'currentBuyOrder');
    const confirmedAmount = sessionManager.getSessionData(chatId, 'confirmedAmount');
    const totalPrice = sessionManager.getSessionData(chatId, 'totalPrice');
    
    if (!orderData || !confirmedAmount || !totalPrice) {
      return await ctx.reply('❌ Данные сделки не найдены.');
    }
    
    // Show confirmation screen again
    const message = `Продажа CES\n` +
                   `Сумма ${totalPrice.toFixed(2)} ₽\n` +
                   `Цена: ${orderData.pricePerToken.toFixed(2)} ₽\n` +
                   `Общее количество: ${confirmedAmount} CES\n` +
                   `Комиссия за транзакцию: 0 %`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Продолжить', 'continue_with_payment')],
      [Markup.button.callback('🔙 Назад', 'back_to_amount_input')]
    ]);
    
    await ctx.reply(message, keyboard);
  }
  
  async handleContinueWithPayment(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const orderData = sessionManager.getSessionData(chatId, 'currentBuyOrder');
      const confirmedAmount = sessionManager.getSessionData(chatId, 'confirmedAmount');
      
      if (!orderData || !confirmedAmount) {
        return await ctx.reply('❌ Данные сделки не найдены.');
      }
      
      // Get available payment methods from maker
      const paymentMethods = orderData.paymentMethods || [];
      const activeMethods = paymentMethods.filter(pm => pm.isActive);
      
      if (activeMethods.length === 0) {
        return await ctx.reply('❌ У мейкера нет доступных способов оплаты.');
      }
      
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
      
      const message = `Выберите способ оплаты:`;
      
      // Create payment method buttons
      const paymentButtons = activeMethods.map(pm => [
        Markup.button.callback(bankNames[pm.bank] || pm.bank, `select_payment_${pm.bank}`)
      ]);
      
      // Add back button
      paymentButtons.push([Markup.button.callback('🔙 Назад', 'back_to_amount_confirmation')]);
      
      const keyboard = Markup.inlineKeyboard(paymentButtons);
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Continue with payment error:', error);
      await ctx.reply('❌ Ошибка выбора способа оплаты.');
    }
  }
  
  async handleSelectPayment(ctx, bankCode) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const orderData = sessionManager.getSessionData(chatId, 'currentBuyOrder');
      const confirmedAmount = sessionManager.getSessionData(chatId, 'confirmedAmount');
      const totalPrice = sessionManager.getSessionData(chatId, 'totalPrice');
      
      if (!orderData || !confirmedAmount || !totalPrice) {
        return await ctx.reply('❌ Данные сделки не найдены.');
      }
      
      // Find selected payment method
      const selectedMethod = orderData.paymentMethods.find(pm => pm.bank === bankCode && pm.isActive);
      if (!selectedMethod) {
        return await ctx.reply('❌ Выбранный способ оплаты недоступен.');
      }
      
      // Store selected payment method
      sessionManager.setSessionData(chatId, 'selectedPaymentMethod', selectedMethod);
      
      // Generate order number
      const orderNumber = `CES${Date.now().toString().slice(-8)}`;
      const currentTime = new Date().toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      sessionManager.setSessionData(chatId, 'orderNumber', orderNumber);
      
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
      
      const message = `Ордер на продажу\n` +
                     `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                     `Номер ордера: ${orderNumber}\n` +
                     `Время создания: ${currentTime}\n` +
                     `Количество: ${confirmedAmount} CES\n` +
                     `Цена: ${orderData.pricePerToken.toFixed(2)} ₽\n` +
                     `Общая сумма: ${totalPrice.toFixed(2)} ₽\n` +
                     `Способ оплаты: ${bankNames[bankCode]}\n\n` +
                     `Правила сделки:\n` +
                     `1. После нажатия "Оплатить" ваши CES будут заморожены\n` +
                     `2. Ожидайте получение рублей от покупателя\n` +
                     `3. После получения денег нажмите "Платёж получен"\n` +
                     `4. Не отменяйте сделку после заморозки CES\n` +
                     `5. Обращайтесь в поддержку при любых проблемах`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💳 Оплатить', 'make_payment')],
        [Markup.button.callback('❌ Отменить', 'cancel_trade')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Select payment error:', error);
      await ctx.reply('❌ Ошибка подтверждения ордера.');
    }
  }
  
  async handleBackToPaymentSelection(ctx) {
    return this.handleContinueWithPayment(ctx);
  }
  
  async handleMakePayment(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const orderData = sessionManager.getSessionData(chatId, 'currentBuyOrder');
      const confirmedAmount = sessionManager.getSessionData(chatId, 'confirmedAmount');
      const totalPrice = sessionManager.getSessionData(chatId, 'totalPrice');
      const selectedPaymentMethod = sessionManager.getSessionData(chatId, 'selectedPaymentMethod');
      const orderNumber = sessionManager.getSessionData(chatId, 'orderNumber');
      
      if (!orderData || !confirmedAmount || !totalPrice || !selectedPaymentMethod || !orderNumber) {
        return await ctx.reply('❌ Данные сделки не найдены.');
      }
      
      // Create trade in P2P service and escrow CES tokens
      const p2pService = require('../services/p2pService');
      const { User } = require('../database/models');
      
      // ИСПРАВЛЕНИЕ: Правильно определяем роли участников
      // seller = тейкер (продавец CES, замораживает токены и получает деньги)
      // buyer = мейкер (покупатель CES, должен оплатить)
      const seller = await User.findOne({ chatId }); // Тейкер - тот, кто нажал "make_payment"
      const buyer = await User.findById(orderData.makerId); // Мейкер - создатель ордера
      
      if (!buyer || !seller) {
        return await ctx.reply('❌ Ошибка получения данных пользователей.');
      }

      // Автоматическое одобрение токенов перед эскроу
      try {
        await ctx.reply('🔐 Подготовка сделки...⚡️ Одобряем токены автоматически');
        
        const walletService = require('../services/walletService');
        const approvalResult = await walletService.autoApproveCESTokens(chatId, confirmedAmount);
        
        if (approvalResult.success) {
          if (approvalResult.txHash) {
            await ctx.reply(`✅ Токены автоматически одобрены!⚡️ Создаём безопасную сделку...`);
          } else {
            await ctx.reply(`✅ Одобрение уже есть!⚡️ Создаём сделку...`);
          }
        }
      } catch (approvalError) {
        console.error('Auto-approval error:', approvalError);
        const message = `❌ Ошибка автоматического одобрения токенов✋️⚠️ Попробуйте создать сделку через несколько минут или одобрите токены вручную через MetaMask.`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔁 Повторить попытку', 'make_payment')],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // Create P2P trade with escrow
      const tradeResult = await p2pService.createTradeWithEscrow({
        buyerChatId: buyer.chatId,
        sellerChatId: seller.chatId,
        cesAmount: confirmedAmount,
        pricePerToken: orderData.pricePerToken,
        totalPrice: totalPrice,
        paymentMethod: selectedPaymentMethod,
        tradeTimeLimit: orderData.tradeTimeLimit || 30,
        orderNumber: orderNumber,
        buyOrderId: orderData.buyOrderId // Include the buy order ID
      });
      
      if (!tradeResult.success) {
        // Проверяем, если ошибка связана с allowance
        if (tradeResult.error && tradeResult.error.includes('Insufficient allowance')) {
          const message = `🚀 ПОПРОБУЙТЕ ЕЩЁ РАЗ⚡️\n\n` +
                         `Одобрение токенов ещё обрабатывается.\n` +
                         `Подождите 30-60 секунд и нажмите "Повторить".\n\n` +
                         `💡 Система автоматически одобряет токены\n` +
                         `для безопасной сделки без MetaMask!`;
          
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Повторить', 'make_payment')],
            [Markup.button.callback('🔙 Назад', 'p2p_menu')]
          ]);
          
          return await ctx.reply(message, keyboard);
        }
        
        return await ctx.reply(`❌ Ошибка создания сделки: ${tradeResult.error}`);
      }
      
      // Store trade ID in session
      sessionManager.setSessionData(chatId, 'tradeId', tradeResult.tradeId);
      
      // Set payment timer (30 minutes)
      const timeLimit = orderData.tradeTimeLimit || 30;
      const expiryTime = new Date(Date.now() + timeLimit * 60 * 1000);
      const expiryTimeStr = expiryTime.toLocaleTimeString('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      sessionManager.setSessionData(chatId, 'paymentExpiryTime', expiryTime.getTime());
      
      // ИСПРАВЛЕНИЕ: Отправляем правильные уведомления участникам
      
      // 1. Уведомляем тейкера (продавца) - он получит деньги и замораживает CES
      const sellerMessage = `💰 СДЕЛКА СОЗДАНА\n` +
                            `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                            `Ордер: ${orderNumber}\n` +
                            `Количество: ${confirmedAmount} CES\n` +
                            `Сумма: ${totalPrice.toFixed(2)} ₽\n\n` +
                            `🔒 Ваши CES заморожены в смарт-контракте!\n` +
                            `💵 Ожидайте перевод от покупателя.\n\n` +
                            `⏰ ВАЖНО: Средства блокируются на 30 минут для безопасности.\n` +
                            `❌ Отмена возможна только после истечения блокировки.\n\n` +
                            `✅ После получения денег подтвердите платёж.`;

      // 🎯 КНОПКИ ОТМЕНЫ: Показываем только тем, кто имеет право отменить
      // Согласно требованиям - отменять может только покупатель!
      const { P2POrder } = require('../database/models');
      const buyOrder = await P2POrder.findById(orderData.buyOrderId || orderData._id);
      
      let sellerCanCancel = false; // Продавец НИКОГДА не может отменить
      
      if (buyOrder) {
        // ✅ СООТВЕТСТВУЕТ ТРЕБОВАНИЯМ:
        // Мейкер покупает CES → продавец (тейкер) НЕ может отменить
        // Мейкер продаёт CES → продавец (мейкер) НЕ может отменить
        // Отменять может только покупатель в обоих случаях!
        sellerCanCancel = false;
      }
      
      const sellerKeyboard = sellerCanCancel 
        ? Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отменить сделку', 'cancel_payment')]
          ])
        : null; // Не показываем кнопку отмены

      await ctx.reply(sellerMessage, sellerKeyboard);
      
      // 2. Уведомляем мейкера (покупателя) - он должен оплатить
      let sellerName = 'Пользователь';
      if (seller.p2pProfile && seller.p2pProfile.fullName) {
        sellerName = seller.p2pProfile.fullName;
      } else if (seller.firstName) {
        sellerName = seller.firstName;
        if (seller.lastName) {
          sellerName += ` ${seller.lastName}`;
        }
      }
      
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
      
      let displayCardNumber = selectedPaymentMethod.cardNumber || 'Не указано';
      
      const buyerMessage = `💳 ОПЛАТА\n` +
                          `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                          `Ордер: ${orderNumber}\n` +
                          `Время оплаты: ${timeLimit} мин. (до ${expiryTimeStr})\n` +
                          `Сумма: ${totalPrice.toFixed(2)} ₽\n\n` +
                          `Данные для оплаты:\n` +
                          `Банк: ${bankNames[selectedPaymentMethod.bank]}\n` +
                          `Карта: ${displayCardNumber}\n` +
                          `Получатель: ${sellerName}\n\n` +
                          `⚠️ Оплатите точную сумму в указанные сроки.\n` +
                          `После оплаты нажмите "Платёж выполнен".`;

      // 🎯 ПОКУПАТЕЛЬ ВСЕГДА может отменить (согласно требованиям)
      // Мейкер покупает CES → мейкер (покупатель) может отменить ✅
      // Мейкер продаёт CES → тейкер (покупатель) может отменить ✅
      const buyerKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Платёж выполнен', 'payment_completed')],
        [Markup.button.callback('❌ Отменить сделку', 'cancel_payment')]
      ]);
      
      // Отправляем сообщение мейкеру (покупателю)
      const botInstance = require('../bot/telegramBot');
      const bot = botInstance.getInstance();
      try {
        await bot.telegram.sendMessage(buyer.chatId, buyerMessage, {
          reply_markup: buyerKeyboard.reply_markup,
          parse_mode: 'HTML'
        });
        console.log(`✅ Notification sent to buyer ${buyer.chatId}`);
      } catch (notifyError) {
        console.error('⚠️ Failed to notify buyer:', notifyError);
      }
      
      // Schedule automatic cancellation
      setTimeout(async () => {
        try {
          const currentSession = sessionManager.getSessionData(chatId, 'tradeId');
          if (currentSession === tradeResult.tradeId) {
            // Trade is still active, cancel it
            await p2pService.cancelTradeWithTimeout(tradeResult.tradeId);
            sessionManager.clearUserSession(chatId);
            
            await ctx.reply('⏰ Время оплаты истекло. Сделка автоматически отменена. CES возвращены на ваш баланс.');
          }
        } catch (timeoutError) {
          console.error('Timeout cancellation error:', timeoutError);
        }
      }, timeLimit * 60 * 1000);
      
    } catch (error) {
      console.error('Make payment error:', error);
      await ctx.reply('❌ Ошибка создания платежа.');
    }
  }
  
  async handleCancelTrade(ctx) {
    await ctx.reply('🚧 В разработке');
  }
  
  async handlePaymentReceived(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      let tradeId = sessionManager.getSessionData(chatId, 'tradeId');
      let orderNumber = sessionManager.getSessionData(chatId, 'orderNumber');
      
      // If session data is missing (e.g., notification sent via script), find active trade for seller
      if (!tradeId || !orderNumber) {
        console.log(`🔍 Session data missing for user ${chatId}, searching for active trade`);
        
        // Import required models
        const { P2PTrade, User } = require('../database/models');
        
        // First find the user by chatId to get their ObjectId
        const user = await User.findOne({ chatId });
        if (!user) {
          return await ctx.reply('❌ Пользователь не найден.');
        }
        
        // Find active trade where user is the seller using their ObjectId
        const trade = await P2PTrade.findOne({
          sellerId: user._id,  // Use ObjectId instead of chatId
          status: { $in: ['payment_pending', 'payment_made'] }
        }).populate('buyerId').populate('sellerId');
        
        if (!trade) {
          return await ctx.reply('❌ Активная сделка не найдена. Возможно, время оплаты истекло.');
        }
        
        tradeId = trade._id.toString();
        orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
        console.log(`🔍 Found active trade for seller ${chatId}: tradeId=${tradeId}, orderNumber=${orderNumber}`);
      }
      
      // Mark payment as received by seller
      const p2pService = require('../services/p2pService');
      const result = await p2pService.confirmPaymentReceived(tradeId, chatId);
      
      if (!result.success) {
        return await ctx.reply(`❌ Ошибка: ${result.error}`);
      }
      
      // Clear session
      sessionManager.clearUserSession(chatId);
      
      const message = `✅ ПЛАТЁЖ ПОДТВЁРЖДЁН

` +
                     `Ордер: ${orderNumber}

` +
                     `Спасибо за подтверждение !
` +
                     `CES токены переданы покупателю.

` +
                     `Сделка успешно завершена!`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Payment received error:', error);
      await ctx.reply('❌ Ошибка подтверждения платежа.');
    }
  }

  async handlePaymentCompleted(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      let tradeId = sessionManager.getSessionData(chatId, 'tradeId');
      let orderNumber = sessionManager.getSessionData(chatId, 'orderNumber');
      
      // If session data is missing (e.g., notification sent via script), find active trade for buyer
      if (!tradeId || !orderNumber) {
        console.log(`🔍 Session data missing for user ${chatId}, searching for active trade`);
        
        // Import required models and services
        const { P2PTrade, User } = require('../database/models');
        
        // First find the user by chatId to get their ObjectId
        const user = await User.findOne({ chatId });
        if (!user) {
          return await ctx.reply('❌ Пользователь не найден.');
        }
        
        // Find active trade where user is the buyer using their ObjectId
        const trade = await P2PTrade.findOne({
          buyerId: user._id,  // Use ObjectId instead of chatId
          status: { $in: ['escrow_locked', 'payment_pending'] }
        }).populate('buyerId').populate('sellerId');
        
        if (!trade) {
          return await ctx.reply('❌ Активная сделка не найдена. Возможно, время оплаты истекло.');
        }
        
        tradeId = trade._id.toString();
        orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
        console.log(`🔍 Found active trade for buyer ${chatId}: tradeId=${tradeId}, orderNumber=${orderNumber}`);
      }
      
      // Mark payment as made by buyer (not completed by seller)
      const p2pService = require('../services/p2pService');
      const result = await p2pService.markPaymentMade(tradeId, chatId);
      
      if (!result.success) {
        return await ctx.reply(`❌ Ошибка: ${result.error}`);
      }
      
      // Clear session
      sessionManager.clearUserSession(chatId);
      
      const message = `✅ ПЛАТЁЖ ОТМЕЧЕН КАК ВЫПОЛНЕННЫЙ\n` +
                     `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                     `Ордер: ${orderNumber}\n\n` +
                     `Мы уведомили продавца о выполненном платеже.\n` +
                     `Ожидайте подтверждения и освобождения CES с эскроу.\n\n` +
                     `Сделка будет завершена после подтверждения получения платежа продавцом.`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚨 Открыть спор', `initiate_dispute_${tradeId}`)],
        [Markup.button.callback('📞 Обратиться в поддержку', 'contact_support')],
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Payment completed error:', error);
      await ctx.reply('❌ Ошибка обработки платежа.');
    }
  }
  
  async handleCancelPayment(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      let tradeId = sessionManager.getSessionData(chatId, 'tradeId');
      let orderNumber = sessionManager.getSessionData(chatId, 'orderNumber');
      
      // If session data is missing (e.g., notification sent via script), find active trade for user
      if (!tradeId || !orderNumber) {
        console.log(`🔍 Session data missing for user ${chatId}, searching for active trade`);
        
        // Import required models
        const { P2PTrade, User } = require('../database/models');
        
        // First find the user by chatId to get their ObjectId
        const user = await User.findOne({ chatId });
        if (!user) {
          return await ctx.reply('❌ Пользователь не найден.');
        }
        
        // Find active trade where user is either buyer or seller using their ObjectId
        const trade = await P2PTrade.findOne({
          $or: [
            { buyerId: user._id },
            { sellerId: user._id }
          ],
          status: { $in: ['escrow_locked', 'payment_pending'] }
        }).populate('buyerId').populate('sellerId');
        
        if (!trade) {
          return await ctx.reply('❌ Активная сделка не найдена. Возможно, время оплаты истекло.');
        }
        
        tradeId = trade._id.toString();
        orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
        console.log(`🔍 Found active trade for user ${chatId}: tradeId=${tradeId}, orderNumber=${orderNumber}`);
      }
      
      // 🔒 НОВАЯ ЛОГИКА ОТМЕНЫ СДЕЛОК
      // Получаем данные сделки для проверки прав отмены
      const { P2PTrade, User, P2POrder } = require('../database/models');
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
        
      if (!trade) {
        return await ctx.reply('❌ Сделка не найдена.');
      }
      
      // Проверяем, что пользователь является участником сделки
      const user = await User.findOne({ chatId });
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      const isParticipant = trade.buyerId._id.toString() === user._id.toString() || 
                           trade.sellerId._id.toString() === user._id.toString();
      
      if (!isParticipant) {
        return await ctx.reply('❌ Вы не являетесь участником этой сделки.');
      }
      
      // 🚫 ПРАВИЛО 1: После подтверждения оплаты никто не может отменить
      if (['payment_made', 'payment_confirmed', 'completed', 'disputed'].includes(trade.status)) {
        const message = `🚫 ОТМЕНА НЕВОЗМОЖНА\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `Ордер: ${orderNumber}\n\n` +
                       `⚠️ Сделка находится в стадии подтверждения платежа.\n` +
                       `Отмена невозможна - только открытие спора.\n\n` +
                       `💡 Варианты действий:\n` +
                       `• Дождитесь завершения сделки\n` +
                       `• Откройте спор при проблемах\n` +
                       `• Обратитесь в поддержку`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🚨 Открыть спор', `initiate_dispute_${tradeId}`)],
          [Markup.button.callback('📞 Связаться с поддержкой', 'contact_support')],
          [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // Определяем, кто является мейкером и тейкером на основе времени создания ордеров
      const buyOrder = await P2POrder.findById(trade.buyOrderId);
      const sellOrder = await P2POrder.findById(trade.sellOrderId);
      
      if (!buyOrder || !sellOrder) {
        return await ctx.reply('❌ Ошибка получения данных ордеров.');
      }
      
      const buyOrderTime = new Date(buyOrder.createdAt).getTime();
      const sellOrderTime = new Date(sellOrder.createdAt).getTime();
      
      let isBuyerMaker = buyOrderTime < sellOrderTime;
      let isUserBuyer = trade.buyerId._id.toString() === user._id.toString();
      
      // 🎯 ПРАВИЛО 2: Определяем права отмены (СООТВЕТСТВУЕТ ТРЕБОВАНИЯМ)
      let canCancel = false;
      let cancelReason = '';
      
      if (isBuyerMaker) {
        // Мейкер покупает CES → только мейкер (покупатель) может отменить
        canCancel = isUserBuyer;
        cancelReason = isUserBuyer ? '' : 'Только покупатель (мейкер) может отменить эту сделку.';
      } else {
        // Мейкер продаёт CES → только тейкер (покупатель) может отменить  
        canCancel = isUserBuyer;
        cancelReason = isUserBuyer ? '' : 'Только покупатель (тейкер) может отменить эту сделку.';
      }
      
      // ✅ В ОБОИХ СЛУЧАЯХ: отменять может только покупатель (isUserBuyer)
      
      if (!canCancel) {
        const message = `🚫 ОТМЕНА ЗАПРЕЩЕНА\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `Ордер: ${orderNumber}\n\n` +
                       `⚠️ ${cancelReason}\n\n` +
                       `💡 Если есть проблемы, обратитесь в поддержку.`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📞 Связаться с поддержкой', 'contact_support')],
          [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // ✅ Пользователь имеет право отменить сделку - выполняем отмену
      console.log(`🔄 User ${chatId} has permission to cancel trade ${tradeId}`);
      
      // Cancel trade and release escrow
      const p2pService = require('../services/p2pService');
      const result = await p2pService.cancelTradeByUser(tradeId, chatId);
      
      if (!result.success) {
        // Check for timelock-specific errors
        if (result.requiresManualIntervention && result.interventionType === 'timelock') {
          const timeRemainingMinutes = Math.ceil(result.timeRemaining / 60);
          
          const timelockMessage = `⏰ СДЕЛКА НЕ МОЖЕТ БЫТЬ ОТМЕНЕНА\n` +
                                 `➖➖➖➖➖➖➖➖➖➖➖\n` +
                                 `Ордер: ${orderNumber}\n\n` +
                                 `🔒 Смарт-контракт блокирует средства на 30 минут для безопасности.\n` +
                                 `⏰ Осталось ждать: ${timeRemainingMinutes} мин.\n\n` +
                                 `💡 Варианты действий:\n` +
                                 `• Дождитесь истечения блокировки\n` +
                                 `• Продолжите сделку как обычно\n` +
                                 `• Обратитесь в поддержку при проблемах`;
          
          const timelockKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📞 Связаться с поддержкой', 'contact_support')],
            [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
          ]);
          
          return await ctx.reply(timelockMessage, timelockKeyboard);
        }
        
        if (result.requiresManualIntervention) {
          // Other types of manual intervention
          const supportMessage = result.escrowId 
            ? `Ошибка смарт-контракта (ID: ${result.escrowId}). Обратитесь в поддержку для ручного возврата средств.`
            : `Ошибка смарт-контракта. Обратитесь в поддержку для ручного возврата средств.`;
          
          const errorKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📞 Обратиться в поддержку', 'contact_support')],
            [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
          ]);
          
          return await ctx.reply(`❌ ${supportMessage}`, errorKeyboard);
        }
        
        return await ctx.reply(`❌ Ошибка отмены: ${result.error}`);
      }
      
      // Clear session
      sessionManager.clearUserSession(chatId);
      
      const message = `❌ СДЕЛКА ОТМЕНЕНА\n` +
                     `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                     `Ордер: ${orderNumber}\n\n` +
                     `Сделка была отменена по вашему запросу.\n` +
                     `CES возвращены на ваш баланс.`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Cancel payment error:', error);
      await ctx.reply('❌ Ошибка отмены сделки.');
    }
  }
  
  async handleBackToBuyAmountInput(ctx) {
    return this.handleContinueBuyOrder(ctx);
  }
  
  async handleContinueWithBuyPayment(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const orderData = sessionManager.getSessionData(chatId, 'currentSellOrder');
      const confirmedAmount = sessionManager.getSessionData(chatId, 'confirmedBuyAmount');
      
      console.log(`🔄 Пользователь ${chatId} продолжает покупку ${confirmedAmount} CES`);
      
      if (!orderData || !confirmedAmount) {
        console.log(`⚠️ Отсутствуют данные сделки для ${chatId}`);
        return await ctx.reply('❌ Данные сделки не найдены.');
      }
      
      // 🔒 ПРОТИВ RACE CONDITION: Повторная проверка доступности ордера
      const { P2POrder } = require('../database/models');
      const currentSellOrder = await P2POrder.findById(orderData.sellOrderId).populate('userId');
      if (!currentSellOrder || currentSellOrder.status !== 'active' || currentSellOrder.remainingAmount < confirmedAmount) {
        return await ctx.reply('❌ Ордер больше недоступен или количество CES уменьшилось. Попробуйте снова.');
      }
      
      // 🎯 ПРОВЕРКА ЛИМИТОВ: Проверяем лимиты перед выбором банка
      if (confirmedAmount < orderData.minAmount || confirmedAmount > orderData.maxAmount) {
        return await ctx.reply(`❌ Количество должно быть от ${orderData.minAmount} до ${orderData.maxAmount} CES`);
      }
      
      let totalPrice = confirmedAmount * orderData.pricePerToken;
      if (totalPrice < orderData.minRubles || totalPrice > orderData.maxRubles) {
        return await ctx.reply(`❌ Сумма должна быть от ${orderData.minRubles} до ${orderData.maxRubles} ₽`);
      }
      
      // 🏦 ВЫБОР БАНКА: Показываем банки мейкера для выбора
      const paymentMethods = orderData.paymentMethods || [];
      const activeMethods = paymentMethods.filter(pm => pm.isActive);
      
      if (activeMethods.length === 0) {
        return await ctx.reply('❌ У мейкера нет доступных способов оплаты.');
      }
      
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
      
      // 📋 Получаем информацию о мейкере
      const makerName = currentSellOrder.userId.p2pProfile?.fullName || 'Не указано';
      const tradingTime = Math.round((Date.now() - new Date(currentSellOrder.createdAt).getTime()) / (1000 * 60));
      
      const message = `🏦 ВЫБОР БАНКА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Продавец: ${makerName}\n` +
                     `Количество: ${confirmedAmount} CES\n` +
                     `Сумма: ${totalPrice.toFixed(2)} ₽\n` +
                     `Ордер активен: ${tradingTime} мин.\n\n` +
                     `Выберите банк для оплаты:\n\n` +
                     `⏰ У вас есть 5 минут для выбора банка`;
      
      // Создаём кнопки банков с эмодзи
      const bankButtons = activeMethods.map(pm => {
        const bankEmoji = {
          'sberbank': '💚',
          'vtb': '🔵',
          'gazprombank': '⚫',
          'alfabank': '🔴',
          'tbank': '🟡',
          'default': '🏦'
        };
        
        const emoji = bankEmoji[pm.bank] || bankEmoji.default;
        const bankName = bankNames[pm.bank] || pm.bank;
        
        return [Markup.button.callback(`${emoji} ${bankName}`, `select_buy_bank_${pm.bank}`)];
      });
      
      // Добавляем кнопку "Назад"
      bankButtons.push([Markup.button.callback('🔙 Назад', 'back_to_buy_amount_input')]);
      
      const keyboard = Markup.inlineKeyboard(bankButtons);
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Continue with buy payment error:', error);
      await ctx.reply('❌ Ошибка выбора банка.');
    }
  }
  
  async handleSelectBuyBank(ctx, bankCode) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const orderData = sessionManager.getSessionData(chatId, 'currentSellOrder');
      const confirmedAmount = sessionManager.getSessionData(chatId, 'confirmedBuyAmount');
      
      if (!orderData || !confirmedAmount) {
        return await ctx.reply('❌ Данные сделки не найдены.');
      }
      
      const p2pService = require('../services/p2pService');
      const { User, P2POrder } = require('../database/models');
      
      // Get buyer (current user - taker)
      const buyer = await User.findOne({ chatId });
      if (!buyer) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // 🔒 ПРОТИВ RACE CONDITION: Повторная проверка доступности ордера
      const currentSellOrder = await P2POrder.findById(orderData.sellOrderId).populate('userId');
      if (!currentSellOrder || currentSellOrder.status !== 'active' || currentSellOrder.remainingAmount < confirmedAmount) {
        return await ctx.reply('❌ Ордер больше недоступен или количество CES уменьшилось. Попробуйте снова.');
      }
      
      // 🚫 ПРОВЕРКА БЕЗОПАСНОСТИ: Нельзя торговать сам с собой
      if (currentSellOrder.userId.chatId === chatId) {
        return await ctx.reply('❌ Нельзя покупать у самого себя.');
      }
      
      // Находим выбранный способ оплаты
      const paymentMethods = orderData.paymentMethods || [];
      const selectedMethod = paymentMethods.find(pm => pm.bank === bankCode && pm.isActive);
      
      if (!selectedMethod) {
        return await ctx.reply('❌ Выбранный способ оплаты недоступен.');
      }
      
      // 💰 СОЗДАНИЕ СДЕЛКИ: С выбранным банком и БЕЗ двойного блокирования CES
      const tradeResult = await p2pService.createTradeFromSellOrderWithBank(
        chatId, // Покупатель (тейкер)
        orderData.sellOrderId, // ID sell-ордера мейкера
        confirmedAmount, // Количество CES для покупки
        orderData.pricePerToken, // Цена за токен
        selectedMethod // Выбранный способ оплаты
      );
      
      if (!tradeResult.success) {
        sessionManager.clearUserSession(chatId);
        return await ctx.reply(`❌ Ошибка создания сделки: ${tradeResult.error}`);
      }
      
      // 🏆 УСПЕШНОЕ СОЗДАНИЕ СДЕЛКИ
      const { trade, seller, paymentDetails, timeLimit, orderNumber } = tradeResult;
      
      // Очищаем сессию и сохраняем данные о сделке
      sessionManager.clearUserSession(chatId);
      sessionManager.setSessionData(chatId, 'tradeId', trade._id);
      sessionManager.setSessionData(chatId, 'orderNumber', orderNumber);
      
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
      
      // 📋 ПОЛНЫЕ РЕКВИЗИТЫ ПЛАТЕЖА ДЛЯ КОПИРОВАНИЯ
      const totalPrice = confirmedAmount * orderData.pricePerToken;
      const expiryTime = new Date(Date.now() + timeLimit * 60 * 1000);
      const expiryTimeStr = expiryTime.toLocaleTimeString('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const buyerMessage = `💳 ОПЛАТА\n` +
                          `➖➖➖➖➖➖➖➖➖➖➖\n` +
                          `Ордер: ${orderNumber}\n` +
                          `Время оплаты: ${timeLimit} мин. (до ${expiryTimeStr})\n` +
                          `Количество: ${confirmedAmount} CES\n` +
                          `Сумма: ${totalPrice.toFixed(2)} ₽\n\n` +
                          `🏦 Данные для оплаты:\n` +
                          `Банк: ${bankNames[selectedMethod.bank]}\n` +
                          `Карта/Счёт: ${selectedMethod.cardNumber}\n` +
                          `Получатель: ${paymentDetails.recipientName}\n\n` +
                          `⚠️ Оплатите ТОЧНО ${totalPrice.toFixed(2)} ₽ в указанные сроки.\n` +
                          `После оплаты нажмите "Платёж выполнен".`;
      
      const buyerKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Платёж выполнен', 'payment_completed')],
        [Markup.button.callback('❌ Отменить', 'cancel_payment')]
      ]);
      
      await ctx.reply(buyerMessage, buyerKeyboard);
      
      // 🔔 УВЕДОМЛЯЕМ ПРОДАВЦА О НОВОЙ СДЕЛКЕ
      const sellerNotification = `💰 НОВАЯ СДЕЛКА\n` +
                                `➖➖➖➖➖➖➖➖➖➖➖\n` +
                                `Ордер: ${orderNumber}\n` +
                                `Покупатель выбрал банк: ${bankNames[selectedMethod.bank]}\n` +
                                `Количество: ${confirmedAmount} CES\n` +
                                `Сумма к получению: ${totalPrice.toFixed(2)} ₽\n\n` +
                                `🔒 Ваши CES заблокированы в эскроу.\n` +
                                `⏰ Ожидайте поступление средств на указанные реквизиты.\n` +
                                `После получения денег нажмите "Платёж получен".`;
      
      const sellerKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Платёж получен', 'payment_received')],
        [Markup.button.callback('📞 Поддержка', 'contact_support')]
        // Кнопка отмены убрана - отменять может только покупатель
      ]);
      
      try {
        await ctx.telegram.sendMessage(seller.chatId, sellerNotification, sellerKeyboard);
        console.log(`📤 Уведомление отправлено продавцу ${seller.chatId}`);
      } catch (notifyError) {
        console.error('⚠️ Ошибка отправки уведомления продавцу:', notifyError);
        // Не критично - сделка уже создана
      }
      
    } catch (error) {
      console.error('Select buy bank error:', error);
      await ctx.reply('❌ Ошибка создания сделки.');
    }
  }

  async handleContactSupport(ctx) {
    try {
      const message = `📞 КОНТАКТЫ ПОДДЕРЖКИ\n\n` +
                     `ℹ️ По всем вопросам обращайтесь к нашей команде:\n\n` +
                     `💬 Telegram: @asselikhov\n\n` +
                     `⚠️ ПРИ ОБРАЩЕНИИ ПО МОШЕННИЧЕСТВУ:\n` +
                     `• Укажите номер ордера\n` +
                     `• Приложите скриншоты переписки\n` +
                     `• Опишите проблему подробно`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('💬 Написать в Telegram', 'https://t.me/asselikhov')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Contact support error:', error);
      await ctx.reply('❌ Ошибка отображения контактов.');
    }
  }
}

module.exports = MessageHandler;