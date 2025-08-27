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
          isExpired: true
        };
      }
      
      const minutesRemaining = Math.ceil(timeRemaining / 60000);
      
      // Определяем статус и эмодзи
      let timeText, isExpiringSoon;
      
      if (minutesRemaining <= 5) {
        timeText = `🔴 ${minutesRemaining} мин.`; // Красный - мало времени
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
        isExpired: false
      };
      
    } catch (error) {
      console.error('Ошибка расчёта времени ордера:', error);
      return {
        timeText: '⚠️ Неизвестно',
        isExpiringSoon: false,
        isExpired: false
      };
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

  // Handle user's orders with pagination (following market orders pattern)
  async handleP2PMyOrders(ctx, page = 1) {
    try {
      const chatId = ctx.chat.id.toString();
      const limit = 5; // Показываем по 5 ордеров на странице
      const offset = (page - 1) * limit;
      const result = await p2pService.getUserOrders(chatId, limit, offset);
      
      // Check if this is pagination (edit mode) or initial display
      const sessionData = sessionManager.getSessionData(chatId, 'myOrdersMessages');
      const isEditMode = sessionData && sessionData.orderMessageIds;
      
      // Отправляем каждый ордер отдельным сообщением или редактируем
      const orderMessageIds = [];
      const totalPages = Math.ceil(result.totalCount / limit);
      
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
          
          // Определяем статус ордера
          let status;
          if (order.status === 'active') {
            status = 'Активен';
          } else if (order.status === 'partial') {
            status = 'Частично исполнен';
          } else if (order.status === 'completed') {
            status = '✅ Исполнен';
          } else {
            status = '✖️ Отменен';
          }
          
          // Показываем остаток и исполненную часть
          let amountDisplay;
          if (order.status === 'completed') {
            amountDisplay = `Исполнено: ${(order.filledAmount || order.amount).toFixed(2)} CES`;
          } else if (order.status === 'partial') {
            const filled = order.filledAmount || 0;
            const remaining = order.remainingAmount || 0;
            amountDisplay = `Осталось: ${remaining.toFixed(2)} CES | Исполнено: ${filled.toFixed(2)} CES`;
          } else {
            amountDisplay = `Количество: ${(order.remainingAmount || order.amount).toFixed(2)} CES`;
          }
          
          // Calculate remaining time for active orders
          let timeDisplay = '';
          if (order.status === 'active' || order.status === 'partial') {
            const timeInfo = this.calculateRemainingTime(order);
            timeDisplay = `\n⏰ Время: ${timeInfo.timeText}`;
          }
          
          const orderMessage = `${orderNumber}. ${orderType}\n` +
                              `${amountDisplay}\n` +
                              `Цена: ₽ ${order.pricePerToken.toFixed(2)} за CES\n` +
                              `Статус: ${status}${timeDisplay}\n` +
                              `${order.createdAt.toLocaleString('ru-RU')}\n` +
                              `ID: ${order._id.toString().substr(0, 8)}...`;
          
          // Check if this is the last order on page to add navigation
          const isLastOrder = i === result.orders.length - 1;
          let orderKeyboard;
          
          if (isLastOrder) {
            // Create navigation buttons for the last order
            const navigationButtons = [];
            
            // Add cancel button for active and partial orders
            if (order.status === 'active' || order.status === 'partial') {
              const quickButtons = [];
              
              // Кнопка быстрой отмены
              quickButtons.push(Markup.button.callback(`⚡ Отменить`, `quick_cancel_${order._id}`));
              
              // Кнопка продления времени (только если мало времени осталось)
              const timeInfo = this.calculateRemainingTime(order);
              if (timeInfo.isExpiringSoon || timeInfo.isExpired) {
                quickButtons.push(Markup.button.callback(`🔄 +время`, `extend_time_${order._id}`));
              }
              
              navigationButtons.push(quickButtons);
            }
            
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
            
            orderKeyboard = Markup.inlineKeyboard(navigationButtons);
          } else {
            // Add cancel button for active and partial orders (non-last orders)
            if (order.status === 'active' || order.status === 'partial') {
              const quickButtons = [];
              
              // Кнопка быстрой отмены
              quickButtons.push(Markup.button.callback(`⚡ Отменить`, `quick_cancel_${order._id}`));
              
              // Кнопка продления времени
              const timeInfo = this.calculateRemainingTime(order);
              if (timeInfo.isExpiringSoon || timeInfo.isExpired) {
                quickButtons.push(Markup.button.callback(`🔄 +время`, `extend_time_${order._id}`));
              }
              
              orderKeyboard = Markup.inlineKeyboard([quickButtons]);
            } else {
              orderKeyboard = null;
            }
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
}

module.exports = P2POrdersHandler;