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

  async handlePrice(ctx) {
    return this.baseHandler.handlePrice(ctx);
  }

  async handleTextMessage(ctx) {
    const chatId = ctx.chat.id.toString();
    const sessionData = sessionManager.getUserSession(chatId);
    
    // Handle CES amount input in selling flow
    if (sessionData && sessionData.waitingForAmount) {
      return this.handleCESAmountInput(ctx, ctx.message.text);
    }
    
    return this.baseHandler.handleTextMessage(ctx);
  }

  async handleBackToMenu(ctx) {
    return this.baseHandler.handleBackToMenu(ctx);
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
    return this.ordersHandler.handleP2PBuyOrders(ctx, page);
  }

  async handleP2PSellOrders(ctx, page) {
    return this.ordersHandler.handleP2PSellOrders(ctx, page);
  }

  async handleP2PMyOrders(ctx, page) {
    return this.ordersHandler.handleP2PMyOrders(ctx, page);
  }

  // Placeholder methods for future implementation
  async handleP2PAnalytics(ctx) {
    await ctx.reply('🚧 Функция аналитики в разработке');
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
      const sessionManager = require('./SessionManager');
      const pendingOrder = sessionManager.getPendingP2POrder(chatId);
      
      if (!pendingOrder) {
        return await ctx.reply('❌ Ордер не найден. Попробуйте создать ордер заново.');
      }
      
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
      let order;
      
      try {
        if (orderType === 'buy') {
          order = await p2pService.createBuyOrder(chatId, amount, pricePerToken, minAmount, maxAmount);
        } else {
          // Get payment methods for sell order
          const paymentMethods = user.p2pProfile?.paymentMethods?.filter(pm => pm.isActive) || [];
          order = await p2pService.createSellOrder(chatId, amount, pricePerToken, paymentMethods, minAmount, maxAmount);
        }
      } catch (error) {
        console.error('Order creation error:', error);
        return await ctx.reply(`❌ Ошибка создания ордера: ${error.message}`);
      }
      
      // Clear pending order from session
      sessionManager.clearUserSession(chatId);
      
      // Send simple success message
      await ctx.reply('✅ Ордер успешно создан!');
      
      // Automatically return to P2P exchange page
      const P2PHandler = require('./P2PHandler');
      const p2pHandler = new P2PHandler();
      await p2pHandler.handleP2PMenu(ctx);
      
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
                     `➖➖➖➖➖➖➖➖➖➖➖\n\n` +
                     `🛡️ МАКСИМАЛЬНАЯ БЕЗОПАСНОСТЬ\n` +
                     `Ваши CES токены будут реально заблокированы \nв смарт-контракте. Никто не сможет \nих потратить, даже вы сами!\n\n` +
                     `📋 К одобрению: ${amount} CES\n` +
                     `📍 Контракт: ${escrowContractAddress.slice(0,6)}...${escrowContractAddress.slice(-4)}\n\n` +
                     `⚠️ Для создания ордера нужно:\n` +
                     `1️⃣ Одобрить траты CES токенов\n` +
                     `2️⃣ Подписать транзакцию\n` +
                     `3️⃣ Дождаться подтверждения\n\n` +
                     `🚀 Продолжить?`;
      
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
      const { orderType, amount, pricePerToken, minAmount, maxAmount } = pendingOrder;
      
      const message = `🚀 СОЗДАНИЕ БЕЗОПАСНОГО ОРДЕРА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n\n` +
                     `⏳ Ожидайте, обрабатываем запрос...\n\n` +
                     `🔐 Токены будут заблокированы в смарт-контракте`;
      
      await ctx.reply(message);
      
      // Create order with smart contract escrow
      const p2pService = require('../services/p2pService');
      let order;
      
      try {
        if (orderType === 'buy') {
          order = await p2pService.createBuyOrder(chatId, amount, pricePerToken, minAmount, maxAmount);
        } else {
          // Get payment methods for sell order
          const paymentMethods = user.p2pProfile?.paymentMethods?.filter(pm => pm.isActive) || [];
          order = await p2pService.createSellOrder(chatId, amount, pricePerToken, paymentMethods, minAmount, maxAmount);
        }
        
        // Clear pending order from session
        const sessionManager = require('./SessionManager');
        sessionManager.clearUserSession(chatId);
        
        // Send success message
        const successMessage = `✅ ОРДЕР УСПЕШНО СОЗДАН!\n\n` +
                               `🛡️ Безопасность: МАКСИМАЛЬНАЯ\n` +
                               `🔒 Токены заблокированы в смарт-контракте\n` +
                               `❌ Никто не может их потратить`;
        
        await ctx.reply(successMessage);
        
        // Automatically return to P2P exchange page
        const P2PHandler = require('./P2PHandler');
        const p2pHandler = new P2PHandler();
        await p2pHandler.handleP2PMenu(ctx);
        
      } catch (error) {
        console.error('Secure order creation error:', error);
        await ctx.reply(`❌ Ошибка создания безопасного ордера: ${error.message}`);
      }
      
    } catch (error) {
      console.error('Proceed with secure order creation error:', error);
      await ctx.reply('❌ Ошибка создания ордера.');
    }
  }

  // Handle approve and create order for smart contract escrow
  async handleApproveAndCreateOrder(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
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
      
      const message = `🔐 ОДОБРЕНИЕ ТОКЕНОВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n\n` +
                     `✅ Подготавливаем транзакцию...\n\n` +
                     `🎯 Количество: ${amount} CES\n` +
                     `📍 Контракт: ${escrowContractAddress.slice(0,6)}...${escrowContractAddress.slice(-4)}\n\n` +
                     `⏳ Ожидайте выполнения транзакции...`;
      
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
        
        const progressMessage = `✅ ТРАНЗАКЦИЯ ОТПРАВЛЕНА!\n\n` +
                               `🔗 TX: ${tx.hash.slice(0,6)}...${tx.hash.slice(-4)}\n` +
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
        
        await ctx.reply(`${errorMessage}\n\nПодробности: ${error.message}`, keyboard);
      }
      
    } catch (error) {
      console.error('Approve and create order error:', error);
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
        const keyboard = Markup.inlineKeyboard(validation.keyboard || [[Markup.button.callback('🔙 Назад', 'p2p_sell_orders')]]);
        return await ctx.reply(validation.message, keyboard);
      }
      
      // Получаем ордер мейкера (ордер на покупку CES)
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

      const message = `Цена: ${buyOrder.pricePerToken.toFixed(2)} ₽ за CES\n` +
                     `Количество: ${buyOrder.remainingAmount.toFixed(2)} CES\n` +
                     `Лимиты: ${minRubles}-${maxRubles} ₽\n` +
                     `Способ оплаты: Банковский перевод\n` +
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
      
      const message = `Цена: ${buyOrder.pricePerToken.toFixed(2)} ₽ за CES\n` +
                     `Количество: ${buyOrder.remainingAmount.toFixed(2)} CES\n` +
                     `Лимиты: ${minRubles}-${maxRubles} ₽\n` +
                     `Способ оплаты: Банковский перевод\n` +
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
                     `Правила платежа:\n` +
                     `1. Оплатите точную сумму в указанные сроки\n` +
                     `2. Не указывайте CES в комментариях к переводу\n` +
                     `3. Оплачивайте с того же счёта, который указан в профиле\n` +
                     `4. Не отменяйте сделку после оплаты\n` +
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
      
      const buyer = await User.findById(orderData.makerId);
      const seller = await User.findOne({ chatId });
      
      if (!buyer || !seller) {
        return await ctx.reply('❌ Ошибка получения данных пользователей.');
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
          const message = `🔐 ТРЕБУЕТСЯ ОДОБРЕНИЕ ТОКЕНОВ\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖\n\n` +
                         `⚠️ Для создания безопасной сделки необходимо:\n` +
                         `1️⃣ Одобрить траты CES токенов для смарт-контракта\n` +
                         `2️⃣ Подписать транзакцию в кошельке\n\n` +
                         `💡 Это обеспечивает максимальную безопасность:\n` +
                         `• Токены блокируются в смарт-контракте\n` +
                         `• Невозможно потратить их до завершения сделки\n` +
                         `• Полная защита от мошенничества\n\n` +
                         `🔗 Для одобрения:\n` +
                         `1. Подключитесь к сайту через MetaMask\n` +
                         `2. Выполните одобрение токенов\n` +
                         `3. Повторите попытку создания сделки`;
          
          const keyboard = Markup.inlineKeyboard([
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
      
      // Get maker's payment details
      let makerName = 'Пользователь';
      if (buyer.p2pProfile && buyer.p2pProfile.fullName) {
        makerName = buyer.p2pProfile.fullName;
      } else if (buyer.firstName) {
        makerName = buyer.firstName;
        if (buyer.lastName) {
          makerName += ` ${buyer.lastName}`;
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
      
      // Display full card number for payment
      let displayCardNumber = selectedPaymentMethod.cardNumber || 'Не указано';
      
      const message = `💳 ОПЛАТА\n` +
                     `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                     `Ордер: ${orderNumber}\n` +
                     `Время оплаты: ${timeLimit} мин. (до ${expiryTimeStr})\n` +
                     `Сумма: ${totalPrice.toFixed(2)} ₽\n\n` +
                     `Данные для оплаты:\n` +
                     `Банк: ${bankNames[selectedPaymentMethod.bank]}\n` +
                     `Карта: ${displayCardNumber}\n` +
                     `Получатель: ${makerName}\n\n` +
                     `⚠️ Оплатите точную сумму в указанные сроки.\n` +
                     `После оплаты нажмите "Платёж выполнен".`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Платёж выполнен', 'payment_completed')],
        [Markup.button.callback('❌ Отменить сделку', 'cancel_payment')]
      ]);
      
      await ctx.reply(message, keyboard);
      
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
  
  async handlePaymentCompleted(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const sessionManager = require('./SessionManager');
      const tradeId = sessionManager.getSessionData(chatId, 'tradeId');
      const orderNumber = sessionManager.getSessionData(chatId, 'orderNumber');
      
      if (!tradeId || !orderNumber) {
        return await ctx.reply('❌ Данные сделки не найдены.');
      }
      
      // Mark payment as completed in P2P service
      const p2pService = require('../services/p2pService');
      const result = await p2pService.markPaymentCompleted(tradeId, chatId);
      
      if (!result.success) {
        return await ctx.reply(`❌ Ошибка: ${result.error}`);
      }
      
      // Clear session
      sessionManager.clearUserSession(chatId);
      
      const message = `✅ ПЛАТЁЖ ОТМЕЧЕН КАК ВЫПОЛНЕННЫЙ\n` +
                     `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                     `Ордер: ${orderNumber}\n\n` +
                     `Мы уведомили покупателя о выполненном платеже.\n` +
                     `Ожидайте подтверждения и освобождения CES с эскроу.\n\n` +
                     `Сделка будет завершена после подтверждения получения платежа.`;
      
      const keyboard = Markup.inlineKeyboard([
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
      const tradeId = sessionManager.getSessionData(chatId, 'tradeId');
      const orderNumber = sessionManager.getSessionData(chatId, 'orderNumber');
      
      if (!tradeId || !orderNumber) {
        return await ctx.reply('❌ Данные сделки не найдены.');
      }
      
      // Cancel trade and release escrow
      const p2pService = require('../services/p2pService');
      const result = await p2pService.cancelTradeByUser(tradeId, chatId);
      
      if (!result.success) {
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
}

module.exports = MessageHandler;