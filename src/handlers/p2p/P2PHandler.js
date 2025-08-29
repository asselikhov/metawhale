/**
 * P2P Trade Handler
 * Handles all P2P trading operations including orders, market display, and user interactions
 */

const { Markup } = require('telegraf');
const { p2pService } = require('../../services/p2p');
const { walletService } = require('../../services/wallet');
const { User, P2PTrade } = require('../../database/models');
const sessionManager = require('../SessionManager');
const { fiatCurrencyService } = require('../../services/utility');
const LocalizationHelper = require('../../utils/localizationHelper');

class P2PTradeHandler {
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
      const userNetworkService = require('../../services/userNetworkService');
      const multiChainService = require('../../services/multiChainService');
      
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
      const P2PDataHandler = require('../P2PDataHandler');
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
        [Markup.button.callback('🔙 Назад', 'p2p_menu')
]
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
      const P2PDataHandler = require('../P2PDataHandler');
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
      console.log(`🔄 Handling P2P market orders for user ${chatId}`);
      
      // Get user's current network
      const userNetworkService = require('../../services/userNetworkService');
      const multiChainService = require('../../services/multiChainService');
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkTokens = multiChainService.getNetworkTokens(currentNetwork);
      
      // Get selected token from session or default to CES
      const sessionData = sessionManager.getUserSession(chatId);
      const selectedToken = sessionData?.selectedToken || 'CES';
      
      // Get token info
      const tokenInfo = networkTokens[selectedToken.toUpperCase()] || networkTokens['CES'];
      const tokenName = tokenInfo?.name || selectedToken;
      
      // Get market orders with pagination
      const { buyOrders, sellOrders } = await p2pService.getMarketOrders(10, 0, { tokenType: selectedToken });
      
      // Format buy orders (top 5)
      let buyOrdersText = '';
      if (buyOrders.length > 0) {
        buyOrdersText += '📈 ОРДЕРА НА ПОКУПКУ:\n';
        buyOrders.slice(0, 5).forEach((order, index) => {
          const amount = order.remainingAmount || order.amount;
          const totalValue = amount * order.pricePerToken;
          const userName = order.userId?.firstName || order.userId?.username || 'Пользователь';
          buyOrdersText += `${index + 1}. ${amount.toFixed(2)} ${selectedToken} за ₽${order.pricePerToken.toFixed(2)} (₽${totalValue.toFixed(2)}) от ${userName}\n`;
        });
      } else {
        buyOrdersText += '.DataGridViewColumn Нет ордеров на покупку\n';
      }
      
      // Format sell orders (top 5)
      let sellOrdersText = '';
      if (sellOrders.length > 0) {
        sellOrdersText += '\n.DataGridViewColumn НА ПРОДАЖУ:\n';
        sellOrders.slice(0, 5).forEach((order, index) => {
          const amount = order.remainingAmount || order.amount;
          const totalValue = amount * order.pricePerToken;
          const userName = order.userId?.firstName || order.userId?.username || 'Пользователь';
          sellOrdersText += `${index + 1}. ${amount.toFixed(2)} ${selectedToken} за ₽${order.pricePerToken.toFixed(2)} (₽${totalValue.toFixed(2)}) от ${userName}\n`;
        });
      } else {
        sellOrdersText += '\n📈 Нет ордеров на продажу\n';
      }
      
      // Create message with token name
      const message = `📊 РЫНОК P2P - ${tokenName} (${selectedToken})\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `${buyOrdersText}\n` +
                     `${sellOrdersText}\n` +
                     `🔄 Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`;
      
      // Create keyboard with token selection and refresh
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`📈 Купить ${tokenName}`, `p2p_buy_${selectedToken.toLowerCase()}`)],
        [Markup.button.callback(`.DataGridViewColumn Продать ${tokenName}`, `p2p_sell_${selectedToken.toLowerCase()}`)],
        [Markup.button.callback('🔄 Обновить', 'p2p_market_orders')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      console.log(`📤 Sending P2P market orders to user ${chatId}`);
      await ctx.reply(message, keyboard);
      console.log(`✅ P2P market orders sent successfully to user ${chatId}`);
      
    } catch (error) {
      console.error('P2P market orders error:', error);
      await ctx.reply('❌ Ошибка загрузки рыночных ордеров.');
    }
  }

  // Check if token should be shown for trading based on network
  shouldShowTokenForTrading(network, tokenSymbol) {
    // For Polygon network, hide native tokens that are too expensive for small trades
    if (network === 'polygon' && tokenSymbol === 'MATIC') {
      return false;
    }
    
    // For Tron network, hide native tokens that are too expensive for small trades
    if (network === 'tron' && tokenSymbol === 'TRX') {
      return false;
    }
    
    // Show all other tokens
    return true;
  }

  // Start real-time price updates for P2P orders
  async startRealTimePriceUpdates(ctx, message, orderType, walletInfo = null) {
    try {
      const chatId = ctx.chat.id.toString();
      let priceUpdateCount = 0;
      const maxPriceUpdates = 10; // Limit updates to prevent spam
      
      const updatePrice = async () => {
        try {
          if (priceUpdateCount >= maxPriceUpdates) {
            console.log(`🛑 Stopping price updates for user ${chatId} (max updates reached)`);
            return;
          }
          
          // Get current CES price
          const priceService = require('../../services/priceService');
          const cesPriceData = await priceService.getCESPrice();
          const currentPrice = cesPriceData.priceRub;
          
          // Calculate suggested price with small premium/discount
          const suggestedPrice = orderType === 'buy' ? currentPrice * 1.02 : currentPrice * 0.98;
          
          // Format message based on order type
          let updatedMessage;
          if (orderType === 'buy') {
            updatedMessage = `📈 ПОКУПКА CES ТОКЕНОВ\n` +
                           `➖➖➖➖➖➖➖➖➖➖➖\n` +
                           `📊 Актуальная цена: ₽${currentPrice.toFixed(2)}\n` +
                           `💡 Рекомендуемая цена: ₽${suggestedPrice.toFixed(2)}\n\n` +
                           `⚠️ Введите [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                           `💡 Пример: 10 ${suggestedPrice.toFixed(0)} 1000 ${(suggestedPrice * 10).toFixed(0)}\n\n` +
                           `Информация:\n` +
                           `• Минимальная сумма: 10 ₽\n` +
                           `• Комиссия платформы: 1% (только с мейкеров)`;
          } else {
            // For sell orders, include wallet balance
            const balanceText = walletInfo ? `Баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` : '';
            updatedMessage = `.DataGridViewColumn ПРОДАЖА CES ТОКЕНОВ\n` +
                           `➖➖➖➖➖➖➖➖➖➖➖\n` +
                           `📊 Актуальная цена: ₽${currentPrice.toFixed(2)}\n` +
                           `💡 Рекомендуемая цена: ₽${suggestedPrice.toFixed(2)}\n` +
                           `${balanceText}` +
                           `⚠️ Введите  [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                           `💡 Пример: 50 ${suggestedPrice.toFixed(0)} 1000 ${(suggestedPrice * 50).toFixed(0)}\n\n` +
                           `Информация:\n` +
                           `• Минимальная сумма: 10 ₽\n` +
                           `• Комиссия платформы: 1%`;
          }
          
          // Update message with new price
          await ctx.telegram.editMessageText(
            message.chat.id,
            message.message_id,
            null,
            updatedMessage,
            Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Обновить цену', `refresh_price_${orderType}`)],
              [Markup.button.callback('🔙 Назад', 'p2p_menu')]
            ])
          );
          
          priceUpdateCount++;
          console.log(`📈 Price updated for user ${chatId} (${priceUpdateCount}/${maxPriceUpdates})`);
          
          // Schedule next update in 30 seconds
          setTimeout(updatePrice, 30000);
        } catch (error) {
          console.error('Price update error:', error);
        }
      };
      
      // Start first update
      await updatePrice();
    } catch (error) {
      console.error('Start real-time price updates error:', error);
    }
  }
}

module.exports = P2PTradeHandler;