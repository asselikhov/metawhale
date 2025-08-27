/**
 * P2P Orders Handler
 * Handles complex P2P order display, pagination, and order management
 */

const { Markup } = require('telegraf');
const p2pService = require('../services/p2pService');
const { User } = require('../database/models');
const sessionManager = require('./SessionManager');

class P2POrdersHandler {
  
  /**
   * Рассчитывает оставшееся время ордера и возвращает форматированную строку
   * @param {Object} order - Ордер
   * @returns {Object} - {timeText: string, isExpiringSoon: boolean, isExpired: boolean}
   */
  calculateRemainingTime(order) {
    try {
      const now = new Date();
      const timeLimit = order.tradeTimeLimit || 30; // По умолчанию 30 минут
      const orderCreatedAt = new Date(order.createdAt);
      const expiresAt = new Date(orderCreatedAt.getTime() + timeLimit * 60 * 1000);
      const timeRemaining = expiresAt.getTime() - now.getTime();
      
      if (timeRemaining <= 0) {
        return {
          timeText: '⛔ Просрочен',
          isExpiringSoon: false,
          isExpired: true,
          expiresAt
        };
      }
      
      const minutesRemaining = Math.ceil(timeRemaining / 60000);
      
      // Определяем статус и эмодзи
      let timeText, isExpiringSoon;
      
      if (minutesRemaining <= 5) {
        timeText = `🔴 ${minutesRemaining} мин. (критично!)`; // Красный - мало времени
        isExpiringSoon = true;
      } else if (minutesRemaining <= 10) {
        timeText = `🟡 ${minutesRemaining} мин.`; // Жёлтый - предупреждение
        isExpiringSoon = true;
      } else {
        timeText = `🟢 ${minutesRemaining} мин.`; // Зелёный - много времени
        isExpiringSoon = false;
      }
      
      return {
        timeText,
        isExpiringSoon,
        isExpired: false,
        expiresAt,
        minutesRemaining
      };
      
    } catch (error) {
      console.error('Ошибка расчёта времени ордера:', error);
      return {
        timeText: '⚠️ Неизвестно',
        isExpiringSoon: false,
        isExpired: false,
        expiresAt: null,
        minutesRemaining: 0
      };
    }
  }

  /**
   * Рассчитывает расширенную информацию об ордере
   * @param {Object} order - Ордер
   * @param {Object} user - Пользователь
   * @returns {Object} - Расширенная информация
   */
  async calculateEnhancedOrderInfo(order, user) {
    try {
      const totalValue = order.amount * order.pricePerToken;
      const filledAmount = order.filledAmount || 0;
      const remainingAmount = order.remainingAmount || order.amount;
      const filledValue = filledAmount * order.pricePerToken;
      const remainingValue = remainingAmount * order.pricePerToken;
      
      // Комиссия (мейкер платит 1%)
      const commissionRate = 0.01; // 1%
      const commission = totalValue * commissionRate;
      
      // Прогресс исполнения
      const progressPercent = order.amount > 0 ? Math.round((filledAmount / order.amount) * 100) : 0;
      
      // Получаем среднерыночную цену (мок)
      const p2pService = require('../services/p2pService');
      let marketPrice = order.pricePerToken; // По умолчанию
      let priceDeviation = 0;
      
      try {
        const marketData = await p2pService.getMarketPriceSuggestion();
        if (marketData && marketData.averagePrice) {
          marketPrice = marketData.averagePrice;
          priceDeviation = ((order.pricePerToken - marketPrice) / marketPrice) * 100;
        }
      } catch (error) {
        console.log('Не удалось получить рыночную цену');
      }
      
      // Временная информация
      const timeInfo = this.calculateRemainingTime(order);
      
      // Информация о прогрессе
      const progressBar = this.generateProgressBar(progressPercent);
      const progressInfo = `${progressBar} ${progressPercent}%`;
      
      // Рыночная информация
      let marketInfo = '';
      if (priceDeviation !== 0) {
        const deviationText = priceDeviation > 0 ? 
          `+${priceDeviation.toFixed(1)}%` : 
          `${priceDeviation.toFixed(1)}%`;
        const deviationEmoji = priceDeviation > 0 ? '🔺' : '🔻';
        marketInfo = `📊 Рынок: ₽${marketPrice.toLocaleString('ru-RU')} (${deviationEmoji}${deviationText})`;
      } else {
        marketInfo = `📊 Рынок: ₽${marketPrice.toLocaleString('ru-RU')}`;
      }
      
      return {
        totalValue,
        filledAmount,
        remainingAmount,
        filledValue,
        remainingValue,
        commission,
        progressPercent,
        marketPrice,
        priceDeviation,
        timeInfo: timeInfo.timeText,
        progressInfo,
        marketInfo
      };
      
    } catch (error) {
      console.error('Ошибка расчёта расширенной информации:', error);
      return {
        totalValue: 0,
        filledAmount: 0,
        remainingAmount: 0,
        filledValue: 0,
        remainingValue: 0,
        commission: 0,
        progressPercent: 0,
        marketPrice: 0,
        priceDeviation: 0,
        timeInfo: '⚠️ Неизвестно',
        progressInfo: '░░░░░░░░░░ 0%',
        marketInfo: '📊 Рынок: недоступен'
      };
    }
  }

  /**
   * Форматирует улучшенный статус ордера
   * @param {Object} order - Ордер
   * @param {Object} enhancedInfo - Расширенная информация
   * @returns {string} - Форматированный статус
   */
  formatEnhancedStatus(order, enhancedInfo) {
    const timeInfo = this.calculateRemainingTime(order);
    let statusEmoji = '';
    let statusText = '';
    let statusDetails = '';
    
    switch (order.status) {
      case 'active':
        if (timeInfo.isExpired) {
          statusEmoji = '🔴';
          statusText = 'Просрочен';
          statusDetails = '(требует отмены)';
        } else if (timeInfo.isExpiringSoon) {
          statusEmoji = '🟡';
          statusText = 'Активен';
          statusDetails = `(осталось ${timeInfo.minutesRemaining} мин.)`;
        } else {
          statusEmoji = '🟢';
          statusText = 'Активен';
          statusDetails = `(осталось ${timeInfo.minutesRemaining} мин.)`;
        }
        break;
      case 'partial':
        statusEmoji = '🟡';
        statusText = 'Частично исполнен';
        statusDetails = `(${enhancedInfo.progressPercent}% исполнено)`;
        break;
      case 'completed':
        statusEmoji = '✅';
        statusText = 'Полностью исполнен';
        statusDetails = '';
        break;
      case 'cancelled':
        statusEmoji = '❌';
        statusText = 'Отменён';
        statusDetails = '';
        break;
      default:
        statusEmoji = '⚠️';
        statusText = 'Неизвестно';
        statusDetails = '';
    }
    
    return `${statusEmoji} ${statusText} ${statusDetails}`.trim();
  }

  /**
   * Форматирует финансовую информацию
   * @param {Object} order - Ордер
   * @param {Object} enhancedInfo - Расширенная информация
   * @returns {string} - Форматированная строка
   */
  formatFinancialInfo(order, enhancedInfo) {
    let priceDisplay = `💰 Цена: ₽${order.pricePerToken.toLocaleString('ru-RU')} за CES`;
    let financialDisplay = `📋 Общая сумма: ₽${enhancedInfo.totalValue.toLocaleString('ru-RU')}`;
    
    if (enhancedInfo.commission > 0) {
      financialDisplay += `\n💳 Комиссия: ₽${enhancedInfo.commission.toLocaleString('ru-RU')} (1%)`;
    }
    
    if (enhancedInfo.remainingValue > 0 && enhancedInfo.remainingValue !== enhancedInfo.totalValue) {
      financialDisplay += `\n🔄 Осталось: ₽${enhancedInfo.remainingValue.toLocaleString('ru-RU')}`;
    }
    
    return `${priceDisplay}\n${financialDisplay}`;
  }
  /**
   * Генерирует прогресс-бар
   * @param {number} percent - Процент завершения
   * @returns {string} - Визуальный прогресс-бар
   */
  generateProgressBar(percent) {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    
    const filled = '█'.repeat(filledBlocks);
    const empty = '░'.repeat(emptyBlocks);
    
    return `${filled}${empty}`;
  }

  /**
   * Форматирует информацию о цене
   * @param {Object} order - Ордер
   * @param {Object} enhancedInfo - Расширенная информация
   * @returns {string} - Форматированная строка
   */
  formatPriceInfo(order, enhancedInfo) {
    let priceDisplay = `💰 Цена: ₽${order.pricePerToken.toLocaleString('ru-RU')} за CES`;
    
    // Добавляем сравнение с рынком
    if (enhancedInfo.priceDeviation !== 0) {
      const deviationText = enhancedInfo.priceDeviation > 0 ? 
        `+${enhancedInfo.priceDeviation.toFixed(1)}%` : 
        `${enhancedInfo.priceDeviation.toFixed(1)}%`;
      const deviationEmoji = enhancedInfo.priceDeviation > 0 ? '🔺' : '🔻';
      priceDisplay += `\n📊 Рынок: ₽${enhancedInfo.marketPrice.toLocaleString('ru-RU')} (${deviationEmoji}${deviationText})`;
    }
    
    return priceDisplay;
  }

  /**
   * Форматирует финансовую информацию
   * @param {Object} enhancedInfo - Расширенная информация
   * @returns {string} - Форматированная строка
   */
  formatFinancialInfo(enhancedInfo) {
    let financialDisplay = `📋 Общая сумма: ₽${enhancedInfo.totalValue.toLocaleString('ru-RU')}`;
    
    if (enhancedInfo.commission > 0) {
      financialDisplay += `\n💳 Комиссия: ₽${enhancedInfo.commission.toLocaleString('ru-RU')} (1%)`;
    }
    
    if (enhancedInfo.remainingValue > 0 && enhancedInfo.remainingValue !== enhancedInfo.totalValue) {
      financialDisplay += `\n🔄 Осталось: ₽${enhancedInfo.remainingValue.toLocaleString('ru-RU')}`;
    }
    
    return financialDisplay;
  }

  /**
   * Генерирует улучшенные кнопки для ордера
   * @param {Object} order - Ордер
   * @param {Object} enhancedInfo - Расширенная информация
   * @returns {Array} - Массив кнопок
   */
  async generateEnhancedOrderButtons(order, enhancedInfo) {
    const buttons = [];
    const timeInfo = this.calculateRemainingTime(order);
    
    // Кнопки для активных ордеров
    if (order.status === 'active' || order.status === 'partial') {
      const actionButtons = [];
      
      // Основные действия
      actionButtons.push(Markup.button.callback('❌ Отменить', `cancel_order_${order._id}`));
      
      if (timeInfo.isExpiringSoon || timeInfo.isExpired) {
        actionButtons.push(Markup.button.callback('🔄 +время', `extend_time_${order._id}`));
      }
      
      buttons.push(actionButtons);
      
      // Дополнительные действия
      const extraButtons = [];
      extraButtons.push(Markup.button.callback('📊 Аналитика', `order_analytics_${order._id}`));
      extraButtons.push(Markup.button.callback('📈 История', `order_history_${order._id}`));
      buttons.push(extraButtons);
      
      // Кнопки управления
      const managementButtons = [];
      if (order.type === 'sell') {
        managementButtons.push(Markup.button.callback('💰 Изм. цену', `edit_price_${order._id}`));
      }
      managementButtons.push(Markup.button.callback('📤 Поделиться', `share_order_${order._id}`));
      if (managementButtons.length > 0) {
        buttons.push(managementButtons);
      }
    }
    
    // Кнопки для завершённых ордеров
    else if (order.status === 'completed') {
      const completedButtons = [];
      completedButtons.push(Markup.button.callback('📈 История', `order_history_${order._id}`));
      completedButtons.push(Markup.button.callback('🔄 Повторить', `duplicate_order_${order._id}`));
      buttons.push(completedButtons);
    }
    
    return buttons;
  }

  /**
   * Генерирует расширенную статистику пользователя
   * @param {Object} user - Пользователь
   * @returns {string} - Форматированная статистика
   */
  async generateUserStatistics(user) {
    try {
      const { P2POrder, P2PTrade } = require('../database/models');
      
      // Подсчитываем статистику ордеров
      const activeOrders = await P2POrder.countDocuments({
        userId: user._id,
        status: { $in: ['active', 'partial'] }
      });
      
      const completedOrders = await P2POrder.countDocuments({
        userId: user._id,
        status: 'completed'
      });
      
      const totalOrders = await P2POrder.countDocuments({
        userId: user._id
      });
      
      // Подсчитываем статистику сделок за 30 дней
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentTrades = await P2PTrade.find({
        $or: [
          { buyerId: user._id },
          { sellerId: user._id }
        ],
        createdAt: { $gte: thirtyDaysAgo },
        status: 'completed'
      });
      
      // Общий объём торгов
      const totalVolume = recentTrades.reduce((sum, trade) => sum + trade.amount, 0);
      const totalValue = recentTrades.reduce((sum, trade) => sum + trade.totalValue, 0);
      
      // Успешность
      const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
      
      // Получаем репутацию
      const reputationService = require('../services/reputationService');
      const stats = await reputationService.getStandardizedUserStats(user._id);
      
      // Ранг пользователя
      let userRank = '🌱 Новичок';
      if (completedOrders >= 50) {
        userRank = '👑 Мастер';
      } else if (completedOrders >= 20) {
        userRank = '🔥 Эксперт';
      } else if (completedOrders >= 10) {
        userRank = '⭐ Опытный';
      } else if (completedOrders >= 5) {
        userRank = '💪 Продвинутый';
      }
      
      const statisticsHeader = `📈 МОЯ СТАТИСТИКА P2P\n` +
                              `➖➖➖➖➖➖➖➖➖➖➖\n` +
                              `🟢 Активных ордеров: ${activeOrders}\n` +
                              `✅ Исполнено всего: ${completedOrders} ордеров\n` +
                              `📊 Объём за 30 дней: ${totalVolume.toFixed(2)} CES\n` +
                              `💵 Стоимость сделок: ₽${totalValue.toLocaleString('ru-RU')}\n` +
                              `✨ Успешность: ${successRate}%\n` +
                              `🏆 Ранг: ${userRank}\n` +
                              ` Чеы Рейтинг: ${stats.rating || '⭐ Новичок'}\n\n`;
      
      return statisticsHeader;
      
    } catch (error) {
      console.error('Ошибка генерации статистики:', error);
      return '📈 МОЯ СТАТИСТИКА P2P\n➖➖➖➖➖➖➖➖➖➖➖\n⚠️ Ошибка загрузки статистики\n\n';
    }
  }

  // Handle buy orders display with pagination (edit existing messages)
  async handleP2PBuyOrders(ctx, page = 1) {
    try {
      const limit = 5; // Показываем по 5 ордеров на странице
      const offset = (page - 1) * limit;
      const result = await p2pService.getMarketOrders(limit, offset);
      const chatId = ctx.chat.id.toString();
      
      // Filter out orders with null userId
      const validSellOrders = result.sellOrders.filter(order => order.userId !== null);
      
      // Buy orders section shows sell orders from database (users wanting to buy CES)
      if (validSellOrders.length === 0) {
        const message = `⚠️ Активных ордеров на покупку пока нет\n\n` +
                       `💡 Создайте первый ордер на покупку!`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_market_orders')]
        ]);
        
        // Clear any existing session data
        sessionManager.clearUserSession(chatId);
        return await ctx.reply(message, keyboard);
      }
      
      const totalPages = Math.ceil(result.sellOrdersCount / limit);
      
      // Check if this is pagination (edit mode) or initial display
      const sessionData = sessionManager.getSessionData(chatId, 'buyOrdersMessages');
      const isEditMode = sessionData && sessionData.orderMessageIds;
      
      // Отправляем каждый ордер отдельным сообщением или редактируем
      const reputationService = require('../services/reputationService');
      const orderMessageIds = [];
      
      // Display sell orders from database (users wanting to buy CES from market perspective)
      for (let i = 0; i < validSellOrders.length; i++) {
        const order = validSellOrders[i];
        // Проверяем, что userId существует перед доступом к username
        const username = order.userId ? (order.userId.username || order.userId.firstName || 'Пользователь') : 'Пользователь';
        
        // Get standardized user statistics
        const stats = await reputationService.getStandardizedUserStats(order.userId ? order.userId._id : null);
        
        // Extract only emoji from rating (remove the number part)
        const emoji = stats && stats.rating ? stats.rating.split(' ').pop() : '⭐'; // Gets the last part after space (emoji)
        
        // Calculate remaining time for this order
        const timeInfo = this.calculateRemainingTime(order);
        
        // Calculate limits in rubles based on price and amounts
        const minAmount = order.minTradeAmount || 1;
        const maxAmount = order.maxTradeAmount || order.remainingAmount;
        const minRubles = (minAmount * order.pricePerToken).toFixed(2);
        const maxRubles = (maxAmount * order.pricePerToken).toFixed(2);
        
        const orderMessage = `₽ ${order.pricePerToken.toFixed(2)} / CES | @${username} ${emoji}\n` +
                           `Доступно: ${order.remainingAmount.toFixed(2)} CES\n` +
                           `Лимиты: ${minRubles} - ${maxRubles} ₽\n` +
                           `⏰ Время: ${timeInfo.timeText}`;
        
        // Check if this is the last order on page to add navigation
        const isLastOrder = i === validSellOrders.length - 1;
        let orderKeyboard;
        
        if (isLastOrder) {
          // Create navigation buttons for the last order
          const navigationButtons = [[Markup.button.callback('🟩 Купить', order.userId && order.userId._id && order._id ? `buy_details_${order.userId._id}_${order._id}` : 'no_action')]];
          
          // Add pagination if there are multiple pages
          if (totalPages > 1) {
            const paginationButtons = [];
            
            // На первой странице - некликабельная левая кнопка и кликабельная правая
            if (page === 1 && totalPages > 1) {
              paginationButtons.push(Markup.button.callback('⬅️', 'no_action')); // некликабельная
              paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_buy_orders'));
              paginationButtons.push(Markup.button.callback('➡️', `p2p_buy_orders_page_${page + 1}`));
            }
            // На последней странице - кликабельная левая кнопка и некликабельная правая
            else if (page === totalPages && totalPages > 1) {
              paginationButtons.push(Markup.button.callback('⬅️', `p2p_buy_orders_page_${page - 1}`));
              paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_buy_orders'));
              paginationButtons.push(Markup.button.callback('➡️', 'no_action')); // некликабельная
            }
            // На средних страницах - обе кнопки кликабельные
            else if (page > 1 && page < totalPages) {
              paginationButtons.push(Markup.button.callback('⬅️', `p2p_buy_orders_page_${page - 1}`));
              paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_buy_orders'));
              paginationButtons.push(Markup.button.callback('➡️', `p2p_buy_orders_page_${page + 1}`));
            }
            
            if (paginationButtons.length > 0) {
              navigationButtons.push(paginationButtons);
            }
          }
          
          // Кнопка "Назад" внизу
          navigationButtons.push([Markup.button.callback('🔙 Назад', 'p2p_market_orders')]);
          
          orderKeyboard = Markup.inlineKeyboard(navigationButtons);
        } else {
          orderKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🟩 Купить', order.userId && order.userId._id && order._id ? `buy_details_${order.userId._id}_${order._id}` : 'no_action')]
          ]);
        }
        
        let orderMessageId;
        
        // Try to edit existing message if we have session data
        if (isEditMode && sessionData.orderMessageIds && sessionData.orderMessageIds[i]) {
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              sessionData.orderMessageIds[i],
              null,
              orderMessage,
              orderKeyboard
            );
            orderMessageId = sessionData.orderMessageIds[i];
          } catch (error) {
            console.log(`Could not edit order message ${i}, sending new one`);
            const orderMsg = await ctx.reply(orderMessage, orderKeyboard);
            orderMessageId = orderMsg.message_id;
          }
        } else {
          // Send new order message
          const orderMsg = await ctx.reply(orderMessage, orderKeyboard);
          orderMessageId = orderMsg.message_id;
        }
        
        orderMessageIds.push(orderMessageId);
        
        // Небольшая пауза между сообщениями чтобы не спамить
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Store message IDs in session for future edits
      sessionManager.setSessionData(chatId, 'buyOrdersMessages', {
        orderMessageIds
      });
      
    } catch (error) {
      console.error('Buy orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров на покупку.');
    }
  }

  // Handle sell orders display with pagination (edit existing messages)
  async handleP2PSellOrders(ctx, page = 1) {
    try {
      const limit = 5; // Показываем по 5 ордеров на странице
      const offset = (page - 1) * limit;
      const result = await p2pService.getMarketOrders(limit, offset);
      const chatId = ctx.chat.id.toString();
      
      // Filter out orders with null userId
      const validBuyOrders = result.buyOrders.filter(order => order.userId !== null);
      
      // Sell orders section shows buy orders from database (users wanting to sell CES)
      if (validBuyOrders.length === 0) {
        const message = `⚠️ Активных ордеров на продажу пока нет\n\n` +
                       `💡 Создайте первый ордер на продажу!`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_market_orders')]
        ]);
        
        // Clear any existing session data
        sessionManager.clearUserSession(chatId);
        return await ctx.reply(message, keyboard);
      }
      
      const totalPages = Math.ceil(result.buyOrdersCount / limit);
      
      // Check if this is pagination (edit mode) or initial display
      const sessionData = sessionManager.getSessionData(chatId, 'sellOrdersMessages');
      const isEditMode = sessionData && sessionData.orderMessageIds;
      
      // Отправляем каждый ордер отдельным сообщением или редактируем
      const reputationService = require('../services/reputationService');
      const orderMessageIds = [];
      
      // Display buy orders from database (users wanting to sell CES from market perspective)
      for (let i = 0; i < validBuyOrders.length; i++) {
        const order = validBuyOrders[i];
        // Проверяем, что userId существует перед доступом к username
        const username = order.userId ? (order.userId.username || order.userId.firstName || 'Пользователь') : 'Пользователь';
        
        // Get standardized user statistics
        const stats = await reputationService.getStandardizedUserStats(order.userId ? order.userId._id : null);
        
        // Extract only emoji from rating (remove the number part)
        const emoji = stats && stats.rating ? stats.rating.split(' ').pop() : '⭐'; // Gets the last part after space (emoji)
        
        // Calculate remaining time for this order
        const timeInfo = this.calculateRemainingTime(order);
        
        // Calculate limits in rubles based on price and amounts
        const minAmount = order.minTradeAmount || 1;
        const maxAmount = order.maxTradeAmount || order.remainingAmount;
        const minRubles = (minAmount * order.pricePerToken).toFixed(2);
        const maxRubles = (maxAmount * order.pricePerToken).toFixed(2);
        
        const orderMessage = `₽ ${order.pricePerToken.toFixed(2)} / CES | @${username} ${emoji}\n` +
                           `Доступно: ${order.remainingAmount.toFixed(2)} CES\n` +
                           `Лимиты: ${minRubles} - ${maxRubles} ₽\n` +
                           `⏰ Время: ${timeInfo.timeText}`;
        
        // Check if this is the last order on page to add navigation
        const isLastOrder = i === validBuyOrders.length - 1;
        let orderKeyboard;
        
        if (isLastOrder) {
          // Create navigation buttons for the last order
          const navigationButtons = [[Markup.button.callback('🟥 Продать', order.userId && order.userId._id && order._id ? `sell_details_${order.userId._id}_${order._id}` : 'no_action')]];
          
          // Add pagination if there are multiple pages
          if (totalPages > 1) {
            const paginationButtons = [];
            
            // На первой странице - некликабельная левая кнопка и кликабельная правая
            if (page === 1 && totalPages > 1) {
              paginationButtons.push(Markup.button.callback('⬅️', 'no_action')); // некликабельная
              paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_sell_orders'));
              paginationButtons.push(Markup.button.callback('➡️', `p2p_sell_orders_page_${page + 1}`));
            }
            // На последней странице - кликабельная левая кнопка и некликабельная правая
            else if (page === totalPages && totalPages > 1) {
              paginationButtons.push(Markup.button.callback('⬅️', `p2p_sell_orders_page_${page - 1}`));
              paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_sell_orders'));
              paginationButtons.push(Markup.button.callback('➡️', 'no_action')); // некликабельная
            }
            // На средних страницах - обе кнопки кликабельные
            else if (page > 1 && page < totalPages) {
              paginationButtons.push(Markup.button.callback('⬅️', `p2p_sell_orders_page_${page - 1}`));
              paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_sell_orders'));
              paginationButtons.push(Markup.button.callback('➡️', `p2p_sell_orders_page_${page + 1}`));
            }
            
            if (paginationButtons.length > 0) {
              navigationButtons.push(paginationButtons);
            }
          }
          
          // Кнопка "Назад" внизу
          navigationButtons.push([Markup.button.callback('🔙 Назад', 'p2p_market_orders')]);
          
          orderKeyboard = Markup.inlineKeyboard(navigationButtons);
        } else {
          orderKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🟥 Продать', order.userId && order.userId._id && order._id ? `sell_details_${order.userId._id}_${order._id}` : 'no_action')]
          ]);
        }
        
        let orderMessageId;
        
        // Try to edit existing message if we have session data
        if (isEditMode && sessionData.orderMessageIds && sessionData.orderMessageIds[i]) {
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              sessionData.orderMessageIds[i],
              null,
              orderMessage,
              orderKeyboard
            );
            orderMessageId = sessionData.orderMessageIds[i];
          } catch (error) {
            console.log(`Could not edit order message ${i}, sending new one`);
            const orderMsg = await ctx.reply(orderMessage, orderKeyboard);
            orderMessageId = orderMsg.message_id;
          }
        } else {
          // Send new order message
          const orderMsg = await ctx.reply(orderMessage, orderKeyboard);
          orderMessageId = orderMsg.message_id;
        }
        
        orderMessageIds.push(orderMessageId);
        
        // Небольшая пауза между сообщениями чтобы не спамить
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Store message IDs in session for future edits
      sessionManager.setSessionData(chatId, 'sellOrdersMessages', {
        orderMessageIds
      });
      
    } catch (error) {
      console.error('Sell orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров на продажу.');
    }
  }

  /**
   * Генерирует статистику пользователя
   * @param {string} chatId - ID пользователя
   * @param {Object} result - Результат запроса ордеров
   * @returns {string} - Форматированная статистика
   */
  async generateUserStatistics(chatId, result) {
    try {
      const p2pService = require('../services/p2pService');
      const { User } = require('../database/models');
      
      // Получаем пользователя
      const user = await User.findOne({ chatId: chatId });
      if (!user) return '';
      
      // Подсчитываем статистику
      const activeOrders = result.orders.filter(order => order.status === 'active' || order.status === 'partial').length;
      const completedOrders = result.orders.filter(order => order.status === 'completed').length;
      const totalOrdersVolume = result.orders.reduce((sum, order) => {
        const filledAmount = order.filledAmount || 0;
        return sum + filledAmount;
      }, 0);
      
      const averageOrderSize = result.orders.length > 0 ? totalOrdersVolume / result.orders.length : 0;
      const successRate = result.orders.length > 0 ? Math.round((completedOrders / result.orders.length) * 100) : 0;
      
      // Получаем репутацию
      const reputationService = require('../services/reputationService');
      const stats = await reputationService.getStandardizedUserStats(user._id);
      
      const statisticsHeader = `📈 МОЯ СТАТИСТИКА\n` +
                              `➖➖➖➖➖➖➖➖➖➖➖\n` +
                              `🟢 Активных ордеров: ${activeOrders}\n` +
                              `✅ Исполнено за месяц: ${stats.ordersLast30Days} ордеров\n` +
                              `📊 Средний объём: ${averageOrderSize.toFixed(2)} CES\n` +
                              `✨ Успешность: ${stats.completionRateLast30Days}%\n` +
                              `🏆 Рейтинг: ${stats.rating}\n\n`;
      
      return statisticsHeader;
      
    } catch (error) {
      console.error('Ошибка генерации статистики:', error);
      return '';
    }
  }

  // Handle user's orders with pagination (following market orders pattern)
  async handleP2PMyOrders(ctx, page = 1) {
    try {
      const chatId = ctx.chat.id.toString();
      const limit = 5; // Показываем по 5 ордеров на странице
      const offset = (page - 1) * limit;
      const result = await p2pService.getUserOrders(chatId, limit, offset);
      
      // Получаем полную статистику для первой страницы
      let statisticsHeader = '';
      if (page === 1) {
        const user = await User.findOne({ chatId });
        if (user) {
          statisticsHeader = await this.generateUserStatistics(user);
        }
      }
      
      // Check if this is pagination (edit mode) or initial display
      const sessionData = sessionManager.getSessionData(chatId, 'myOrdersMessages');
      const isEditMode = sessionData && sessionData.orderMessageIds;
      
      // Отправляем каждый ордер отдельным сообщением или редактируем
      const orderMessageIds = [];
      const totalPages = Math.ceil(result.totalCount / limit);
      
      // Отправляем статистику на первой странице
      if (page === 1 && statisticsHeader && result.orders.length > 0) {
        const statsKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('📈 Полная аналитика', 'p2p_analytics'),
            Markup.button.callback('🏆 Топ трейдеров', 'p2p_top_traders')
          ]
        ]);
        
        const statsMsg = await ctx.reply(statisticsHeader, statsKeyboard);
        orderMessageIds.push(statsMsg.message_id);
        
        // Пауза перед отображением ордеров
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (result.orders.length === 0) {
        // Show empty state message with navigation
        const emptyMessage = page === 1 ? 
          `⚠️ У вас пока нет активных ордеров\n\n💡 Создайте ордер на покупку или продажу CES !` :
          `⚠️ На этой странице нет ордеров`;
        
        // Create navigation buttons for empty state
        const navigationButtons = [];
        
        // Add pagination if there are multiple pages
        if (totalPages > 1) {
          const paginationButtons = [];
          
          // На первой странице - некликабельная левая кнопка и кликабельная правая
          if (page === 1 && totalPages > 1) {
            paginationButtons.push(Markup.button.callback('⬅️', 'no_action')); // некликабельная
            paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
            paginationButtons.push(Markup.button.callback('➡️', `p2p_my_orders_page_${page + 1}`));
          }
          // На последней странице - кликабельная левая кнопка и некликабельная правая
          else if (page === totalPages && totalPages > 1) {
            paginationButtons.push(Markup.button.callback('⬅️', `p2p_my_orders_page_${page - 1}`));
            paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
            paginationButtons.push(Markup.button.callback('➡️', 'no_action')); // некликабельная
          }
          // На средних страницах - обе кнопки кликабельные
          else if (page > 1 && page < totalPages) {
            paginationButtons.push(Markup.button.callback('⬅️', `p2p_my_orders_page_${page - 1}`));
            paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
            paginationButtons.push(Markup.button.callback('➡️', `p2p_my_orders_page_${page + 1}`));
          }
          
          if (paginationButtons.length > 0) {
            navigationButtons.push(paginationButtons);
          }
        }
        
        // Кнопка "Назад" внизу
        navigationButtons.push([Markup.button.callback('🔙 Назад', 'p2p_menu')]);
        
        const emptyKeyboard = Markup.inlineKeyboard(navigationButtons);
        
        let emptyMessageId;
        
        // Try to edit existing empty message if we have session data
        if (isEditMode && sessionData.orderMessageIds && sessionData.orderMessageIds[0]) {
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              sessionData.orderMessageIds[0],
              null,
              emptyMessage,
              emptyKeyboard
            );
            emptyMessageId = sessionData.orderMessageIds[0];
          } catch (error) {
            console.log('Could not edit empty message, sending new one');
            const emptyMsg = await ctx.reply(emptyMessage, emptyKeyboard);
            emptyMessageId = emptyMsg.message_id;
          }
        } else {
          // Send new empty message
          const emptyMsg = await ctx.reply(emptyMessage, emptyKeyboard);
          emptyMessageId = emptyMsg.message_id;
        }
        
        orderMessageIds.push(emptyMessageId);
      } else {
        // Display orders if any exist
        for (let i = 0; i < result.orders.length; i++) {
          const order = result.orders[i];
          const orderNumber = offset + i + 1;
          const orderType = order.type === 'buy' ? '📈 Покупка' : '📉 Продажа';
          
          // 🎯 РАСШИРЕННАЯ ИНФОРМАЦИЯ ОБ ОРДЕРЕ
          const user = await User.findOne({ chatId });
          const enhancedInfo = await this.calculateEnhancedOrderInfo(order, user);
          const enhancedStatus = this.formatEnhancedStatus(order, enhancedInfo);
          const financialInfo = this.formatFinancialInfo(order, enhancedInfo);
          
          // Форматируем информацию о количестве и прогрессе
          let amountDisplay;
          if (order.status === 'completed') {
            amountDisplay = `✅ Исполнено: ${enhancedInfo.filledAmount.toFixed(4)} CES`;
          } else if (order.status === 'partial') {
            amountDisplay = `🟡 Прогресс: ${enhancedInfo.progressInfo}\n` +
                           `✅ Исполнено: ${enhancedInfo.filledAmount.toFixed(4)} CES\n` +
                           `🔄 Осталось: ${enhancedInfo.remainingAmount.toFixed(4)} CES`;
          } else {
            amountDisplay = `📊 Количество: ${enhancedInfo.remainingAmount.toFixed(4)} CES`;
          }
          
          // Форматируем временную информацию
          let timeDisplay = '';
          if (order.status === 'active' || order.status === 'partial') {
            const timeInfo = this.calculateRemainingTime(order);
            const expiryTime = timeInfo.expiresAt ? timeInfo.expiresAt.toLocaleString('ru-RU', { 
              hour: '2-digit', 
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit'
            }) : 'Неизвестно';
            timeDisplay = `\n⏰ Время: ${enhancedInfo.timeInfo}\n🕛 Истекает: ${expiryTime}`;
          }
          
          // Генерируем улучшенное сообщение об ордере
          const orderMessage = `${orderNumber}. ${orderType}\n` +
                              `➖➖➖➖➖➖➖➖➖➖➖\n` +
                              `🆔 ID: ${order._id.toString()}\n` +
                              `${amountDisplay}\n` +
                              `${financialInfo}\n` +
                              `${enhancedInfo.marketInfo}\n` +
                              `📋 Статус: ${enhancedStatus}${timeDisplay}\n` +
                              `\n📅 Создан: ${order.createdAt.toLocaleString('ru-RU')}`;
          
          // Определяем, является ли это последним ордером на странице
          const isLastOrder = i === result.orders.length - 1;
          
          // Генерируем улучшенные кнопки действий
          const orderKeyboard = await this.generateEnhancedOrderButtons(order, enhancedInfo);
          
          // Добавляем пагинацию и кнопку "Назад" для последнего ордера
          if (isLastOrder) {
            const enhancedButtons = orderKeyboard.reply_markup ? orderKeyboard.reply_markup.inline_keyboard : [];
            
            // Пагинация
            if (totalPages > 1) {
              const paginationButtons = [];
              
              if (page === 1 && totalPages > 1) {
                paginationButtons.push(Markup.button.callback('⬅️', 'no_action'));
                paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
                paginationButtons.push(Markup.button.callback('➡️', `p2p_my_orders_page_${page + 1}`));
              } else if (page === totalPages && totalPages > 1) {
                paginationButtons.push(Markup.button.callback('⬅️', `p2p_my_orders_page_${page - 1}`));
                paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
                paginationButtons.push(Markup.button.callback('➡️', 'no_action'));
              } else if (page > 1 && page < totalPages) {
                paginationButtons.push(Markup.button.callback('⬅️', `p2p_my_orders_page_${page - 1}`));
                paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
                paginationButtons.push(Markup.button.callback('➡️', `p2p_my_orders_page_${page + 1}`));
              }
              
              if (paginationButtons.length > 0) {
                enhancedButtons.push(paginationButtons);
              }
            }
            
            // Кнопка "Назад"
            enhancedButtons.push([Markup.button.callback('🔙 Назад', 'p2p_menu')]);
            
            // Обновляем клавиатуру
            orderKeyboard = enhancedButtons.length > 0 ? Markup.inlineKeyboard(enhancedButtons) : null;
          }
          
          let orderMessageId;
          
          // Try to edit existing message if we have session data
          if (isEditMode && sessionData.orderMessageIds && sessionData.orderMessageIds[i]) {
            try {
              await ctx.telegram.editMessageText(
                ctx.chat.id,
                sessionData.orderMessageIds[i],
                null,
                orderMessage,
                orderKeyboard
              );
              orderMessageId = sessionData.orderMessageIds[i];
            } catch (error) {
              console.log(`Could not edit order message ${i}, sending new one`);
              const orderMsg = await ctx.reply(orderMessage, orderKeyboard);
              orderMessageId = orderMsg.message_id;
            }
          } else {
            // Send new order message
            const orderMsg = await ctx.reply(orderMessage, orderKeyboard);
            orderMessageId = orderMsg.message_id;
          }
          
          orderMessageIds.push(orderMessageId);
          
          // Небольшая пауза между сообщениями чтобы не спамить
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Store message IDs in session for future edits
      sessionManager.setSessionData(chatId, 'myOrdersMessages', {
        orderMessageIds
      });
      
    } catch (error) {
      console.error('My orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров.');
    }
  }
  /**
   * ⚡ Быстрая отмена ордера с подтверждением
   */
  async handleQuickCancelOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const p2pService = require('../services/p2pService');
      
      console.log(`⚡ [QUICK-CANCEL] Пользователь ${chatId} инициирует быструю отмену ордера ${orderId}`);
      
      // Получаем ордер для проверки
      const { P2POrder, User } = require('../database/models');
      const order = await P2POrder.findById(orderId).populate('userId');
      
      if (!order) {
        await ctx.answerCbQuery('❌ Ордер не найден');
        return;
      }
      
      // Проверяем, что это ордер пользователя
      if (order.userId.chatId !== chatId) {
        await ctx.answerCbQuery('❌ Это не ваш ордер');
        return;
      }
      
      // Проверяем статус
      if (!['active', 'partial'].includes(order.status)) {
        await ctx.answerCbQuery('❌ Ордер нельзя отменить');
        return;
      }
      
      // Показываем подтверждение
      const orderType = order.type === 'buy' ? 'покупку' : 'продажу';
      const remainingTime = this.calculateRemainingTime(order);
      
      const message = `⚡ БЫСТРАЯ ОТМЕНА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ордер на ${orderType}:\n` +
                     `• Количество: ${order.amount} CES\n` +
                     `• Цена: ₽${order.pricePerToken} за CES\n` +
                     `• Осталось: ${order.remainingAmount} CES\n` +
                     `• Время: ${remainingTime.timeText}\n\n` +
                     `❕ Вы уверены, что хотите отменить этот ордер?`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Да, отменить', `confirm_cancel_${orderId}`),
          Markup.button.callback('❌ Нет', 'p2p_my_orders')
        ]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Ошибка быстрой отмены:', error);
      await ctx.answerCbQuery('❌ Ошибка отмены ордера');
    }
  }
  
  /**
   * ✅ Подтверждение отмены ордера
   */
  async handleConfirmCancelOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const p2pService = require('../services/p2pService');
      
      console.log(`✅ [CONFIRM-CANCEL] Подтверждение отмены ордера ${orderId}`);
      
      // Отменяем ордер через p2pService
      const result = await p2pService.cancelOrder(chatId, orderId);
      
      if (result.success) {
        await ctx.reply(`✅ Ордер успешно отменен!\n\n💰 Заблокированные средства освобождены.`);
        
        // Обновляем список ордеров
        setTimeout(() => this.handleP2PMyOrders(ctx), 1500);
      } else {
        await ctx.reply(`❌ Ошибка отмены: ${result.message}`);
      }
      
    } catch (error) {
      console.error('Ошибка подтверждения отмены:', error);
      await ctx.reply('❌ Ошибка отмены ордера.');
    }
  }
  
  /**
   * 🔄 Автоматическое продление времени ордера
   */
  async handleExtendOrderTime(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const { P2POrder, User } = require('../database/models');
      
      console.log(`🔄 [EXTEND-TIME] Продление времени ордера ${orderId}`);
      
      // Получаем ордер
      const order = await P2POrder.findById(orderId).populate('userId');
      
      if (!order || order.userId.chatId !== chatId) {
        await ctx.answerCbQuery('❌ Ордер не найден');
        return;
      }
      
      if (!['active', 'partial'].includes(order.status)) {
        await ctx.answerCbQuery('❌ Ордер нельзя продлить');
        return;
      }
      
      // Проверяем, можно ли продлить (максимум 1 раз в час)
      const now = new Date();
      const lastExtension = order.lastTimeExtension || order.createdAt;
      const timeSinceLastExtension = now.getTime() - new Date(lastExtension).getTime();
      const minExtensionInterval = 60 * 60 * 1000; // 1 час
      
      if (timeSinceLastExtension < minExtensionInterval) {
        const remainingMinutes = Math.ceil((minExtensionInterval - timeSinceLastExtension) / 60000);
        await ctx.answerCbQuery(`⚠️ Продлить можно через ${remainingMinutes} мин.`);
        return;
      }
      
      // Продлеваем на половину от исходного времени
      const originalTimeLimit = order.tradeTimeLimit || 30;
      const extensionTime = Math.ceil(originalTimeLimit / 2); // Половина от оригинального времени
      
      // Обновляем ордер
      order.createdAt = new Date(now.getTime() - (originalTimeLimit - extensionTime) * 60 * 1000);
      order.lastTimeExtension = now;
      await order.save();
      
      await ctx.answerCbQuery(`✅ Время продлено на ${extensionTime} мин.`);
      
      // Обновляем отображение
      setTimeout(() => this.handleP2PMyOrders(ctx), 1000);
      
    } catch (error) {
      console.error('Ошибка продления времени:', error);
      await ctx.answerCbQuery('❌ Ошибка продления');
    }
  }
  /**
   * 📊 Отображение аналитики ордера
   */
  async handleOrderAnalytics(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const { P2POrder } = require('../database/models');
      
      const order = await P2POrder.findById(orderId).populate('userId');
      if (!order || order.userId.chatId !== chatId) {
        await ctx.answerCbQuery('❌ Ордер не найден');
        return;
      }
      
      const enhancedInfo = await this.calculateEnhancedOrderInfo(order);
      const timeInfo = this.calculateRemainingTime(order);
      
      const analytics = `📊 АНАЛИТИКА ОРДЕРА\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `🏷️ ID: ${order._id}\n` +
                       `📈 Тип: ${order.type === 'buy' ? 'Покупка' : 'Продажа'}\n\n` +
                       `💰 ФИНАНСОВАЯ ИНФОРМАЦИЯ:\n` +
                       `• Общая сумма: ₽${enhancedInfo.totalValue.toLocaleString('ru-RU')}\n` +
                       `• Комиссия: ₽${enhancedInfo.commission.toLocaleString('ru-RU')}\n` +
                       `• Отклонение от рынка: ${enhancedInfo.priceDeviation.toFixed(1)}%\n\n` +
                       `📈 ПРОГРЕСС ИСПОЛНЕНИЯ:\n` +
                       `${this.generateProgressBar(enhancedInfo.progressPercent)} ${enhancedInfo.progressPercent}%\n` +
                       `• Исполнено: ${enhancedInfo.filledAmount.toFixed(4)} CES\n` +
                       `• Осталось: ${enhancedInfo.remainingAmount.toFixed(4)} CES\n\n` +
                       `⏰ ВРЕМЕННАЯ ИНФОРМАЦИЯ:\n` +
                       `• Статус: ${timeInfo.timeText}\n` +
                       `• Создан: ${order.createdAt.toLocaleString('ru-RU')}\n`;
      
      if (timeInfo.expiresAt) {
        analytics += `• Истекает: ${timeInfo.expiresAt.toLocaleString('ru-RU')}\n`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к ордерам', 'p2p_my_orders')]
      ]);
      
      await ctx.reply(analytics, keyboard);
      
    } catch (error) {
      console.error('Ошибка аналитики ордера:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки аналитики');
    }
  }
  
  /**
   * 📈 Отображение истории ордера
   */
  async handleOrderHistory(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const { P2POrder, P2PTrade } = require('../database/models');
      
      const order = await P2POrder.findById(orderId).populate('userId');
      if (!order || order.userId.chatId !== chatId) {
        await ctx.answerCbQuery('❌ Ордер не найден');
        return;
      }
      
      // Получаем связанные сделки
      const trades = await P2PTrade.find({
        $or: [
          { buyOrderId: orderId },
          { sellOrderId: orderId }
        ]
      }).populate(['buyerId', 'sellerId']).sort({ createdAt: -1 });
      
      let history = `📈 ИСТОРИЯ ОРДЕРА\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `🏷️ ID: ${order._id}\n` +
                   `📅 Создан: ${order.createdAt.toLocaleString('ru-RU')}\n\n`;
      
      if (trades.length === 0) {
        history += `💭 По этому ордеру ещё не было сделок`;
      } else {
        history += `💼 СДЕЛКИ (${trades.length}):\n`;
        
        trades.slice(0, 5).forEach((trade, index) => { // Показываем последние 5 сделок
          const statusEmoji = {
            'completed': '✅',
            'cancelled': '❌',
            'disputed': '⚠️',
            'escrow_locked': '🔒'
          }[trade.status] || '❔';
          
          history += `\n${index + 1}. ${statusEmoji} ₽${trade.totalValue.toLocaleString('ru-RU')} | ${trade.amount.toFixed(4)} CES\n`;
          history += `   ${trade.createdAt.toLocaleString('ru-RU')}\n`;
        });
        
        if (trades.length > 5) {
          history += `\n… и ещё ${trades.length - 5} сделок`;
        }
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к ордерам', 'p2p_my_orders')]
      ]);
      
      await ctx.reply(history, keyboard);
      
    } catch (error) {
      console.error('Ошибка истории ордера:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки истории');
    }
  }
  
  /**
   * 🔄 Повторение ордера
   */
  async handleDuplicateOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const { P2POrder } = require('../database/models');
      
      const order = await P2POrder.findById(orderId).populate('userId');
      if (!order || order.userId.chatId !== chatId) {
        await ctx.answerCbQuery('❌ Ордер не найден');
        return;
      }
      
      const message = `🔄 ПОВТОРИТЬ ОРДЕР\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Создать новый ордер на основе этого?\n\n` +
                     `📉 Тип: ${order.type === 'buy' ? 'Покупка' : 'Продажа'}\n` +
                     `📊 Количество: ${order.amount.toFixed(4)} CES\n` +
                     `💰 Цена: ₽${order.pricePerToken.toLocaleString('ru-RU')} за CES`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Да, повторить', `confirm_duplicate_${orderId}`),
          Markup.button.callback('❌ Отмена', 'p2p_my_orders')
        ]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Ошибка повторения ордера:', error);
      await ctx.answerCbQuery('❌ Ошибка повторения');
    }
  }
  
  /**
   * 📤 Поделиться ордером
   */
  async handleShareOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const { P2POrder } = require('../database/models');
      
      const order = await P2POrder.findById(orderId).populate('userId');
      if (!order || order.userId.chatId !== chatId) {
        await ctx.answerCbQuery('❌ Ордер не найден');
        return;
      }
      
      const shareText = `📤 P2P ОРДЕР\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `${order.type === 'buy' ? '📈 ПОКУПКА' : '📉 ПРОДАЖА'} CES\n` +
                       `📊 Количество: ${order.remainingAmount.toFixed(4)} CES\n` +
                       `💰 Цена: ₽${order.pricePerToken.toLocaleString('ru-RU')} за CES\n` +
                       `💵 Сумма: ₽${(order.remainingAmount * order.pricePerToken).toLocaleString('ru-RU')}\n\n` +
                       `🏷️ ID: ${order._id}\n\n` +
                       `🤖 @MetawhaleP2PBot`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.url('📤 Поделиться в Telegram', `https://t.me/share/url?url=${encodeURIComponent(shareText)}`)
        ],
        [Markup.button.callback('🔙 Назад', 'p2p_my_orders')]
      ]);
      
      await ctx.reply(`📤 ПОДЕЛИТЬСЯ ОРДЕРОМ\n\n${shareText}`, keyboard);
      
    } catch (error) {
      console.error('Ошибка поделиться ордером:', error);
      await ctx.answerCbQuery('❌ Ошибка поделиться');
    }
  }
  /**
   * ✅ Подтверждение повторения ордера
   */
  async handleConfirmDuplicateOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      const { P2POrder, User } = require('../database/models');
      
      const order = await P2POrder.findById(orderId).populate('userId');
      if (!order || order.userId.chatId !== chatId) {
        await ctx.answerCbQuery('❌ Ордер не найден');
        return;
      }
      
      // Создаём новый ордер на основе старого
      const p2pService = require('../services/p2pService');
      
      try {
        let result;
        if (order.type === 'buy') {
          result = await p2pService.createBuyOrder(
            chatId,
            order.amount,
            order.pricePerToken,
            order.minTradeAmount,
            order.maxTradeAmount
          );
        } else {
          result = await p2pService.createSellOrder(
            chatId,
            order.amount,
            order.pricePerToken,
            order.minTradeAmount,
            order.maxTradeAmount
          );
        }
        
        await ctx.reply(`✅ Ордер успешно повторён!\n\n🆕 ID: ${result._id}`);
        
        // Обновляем список ордеров
        setTimeout(() => this.handleP2PMyOrders(ctx), 1500);
        
      } catch (error) {
        await ctx.reply(`❌ Ошибка повторения: ${error.message}`);
      }
      
    } catch (error) {
      console.error('Ошибка подтверждения повторения:', error);
      await ctx.answerCbQuery('❌ Ошибка повторения');
    }
  }
}

module.exports = P2POrdersHandler;