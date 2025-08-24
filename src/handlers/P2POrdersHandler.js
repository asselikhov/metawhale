/**
 * P2P Orders Handler
 * Handles complex P2P order display, pagination, and order management
 */

const { Markup } = require('telegraf');
const p2pService = require('../services/p2pService');
const { User } = require('../database/models');
const sessionManager = require('./SessionManager');

class P2POrdersHandler {
  // Handle buy orders display with pagination (edit existing messages)
  async handleP2PBuyOrders(ctx, page = 1) {
    try {
      const limit = 5; // Показываем по 5 ордеров на странице
      const offset = (page - 1) * limit;
      const result = await p2pService.getMarketOrders(limit, offset);
      const chatId = ctx.chat.id.toString();
      
      // Buy orders section shows sell orders from database (users wanting to buy CES)
      if (result.sellOrders.length === 0) {
        const message = `📈 ОРДЕРА НА ПОКУПКУ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `⚠️ Активных ордеров на покупку пока нет\n\n` +
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
      const isEditMode = sessionData && sessionData.headerMessageId;
      
      // Отправляем заголовок
      let headerMessage = `📈 ОРДЕРА НА ПОКУПКУ\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖\n`;
      
      let headerMessageId;
      
      if (isEditMode && sessionData.headerMessageId) {
        // Edit existing header message
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            sessionData.headerMessageId,
            null,
            headerMessage
          );
          headerMessageId = sessionData.headerMessageId;
        } catch (error) {
          console.log('Could not edit header message, sending new one');
          const headerMsg = await ctx.reply(headerMessage);
          headerMessageId = headerMsg.message_id;
        }
      } else {
        // Send new header message
        const headerMsg = await ctx.reply(headerMessage);
        headerMessageId = headerMsg.message_id;
      }
      
      // Отправляем каждый ордер отдельным сообщением или редактируем
      const reputationService = require('../services/reputationService');
      const orderMessageIds = [];
      
      // Display sell orders from database (users wanting to buy CES from market perspective)
      for (let i = 0; i < result.sellOrders.length; i++) {
        const order = result.sellOrders[i];
        const username = order.userId.username || order.userId.firstName || 'Пользователь';
        
        // Get standardized user statistics
        const stats = await reputationService.getStandardizedUserStats(order.userId._id);
        
        // Extract only emoji from rating (remove the number part)
        const emoji = stats.rating.split(' ').pop(); // Gets the last part after space (emoji)
        
        // Calculate limits in rubles based on price and amounts
        const minAmount = order.minTradeAmount || 1;
        const maxAmount = order.maxTradeAmount || order.remainingAmount;
        const minRubles = (minAmount * order.pricePerToken).toFixed(2);
        const maxRubles = (maxAmount * order.pricePerToken).toFixed(2);
        
        const orderMessage = `₽ ${order.pricePerToken.toFixed(2)} / CES | @${username} ${emoji}\n` +
                           `Количество: ${order.remainingAmount.toFixed(2)} CES\n` +
                           `Лимиты: ${minRubles} - ${maxRubles} ₽`;
        
        const orderKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🟩 Купить', `buy_details_${order.userId._id}_${order._id}`)]
        ]);
        
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
      
      // Пагинация над кнопкой "Назад"
      const navigationButtons = [];
      if (totalPages > 1) {
        const paginationButtons = [];
        
        if (page > 1) {
          paginationButtons.push(Markup.button.callback('⬅️', `p2p_buy_orders_page_${page - 1}`));
        }
        
        paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_buy_orders'));
        
        if (page < totalPages) {
          paginationButtons.push(Markup.button.callback('➡️', `p2p_buy_orders_page_${page + 1}`));
        }
        
        navigationButtons.push(paginationButtons);
      }
      
      // Кнопка "Назад" внизу
      navigationButtons.push([Markup.button.callback('🔙 Назад', 'p2p_market_orders')]);
      
      const navigationKeyboard = Markup.inlineKeyboard(navigationButtons);
      
      let navigationMessageId;
      
      // Navigation message with page number in the correct format
      const navigationText = totalPages > 1 ? `➖➖➖➖➖➖➖➖➖➖➖` : 'Навигация';
      
      // Edit navigation message if exists
      if (isEditMode && sessionData.navigationMessageId) {
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            sessionData.navigationMessageId,
            null,
            navigationText,
            navigationKeyboard
          );
          navigationMessageId = sessionData.navigationMessageId;
        } catch (error) {
          console.log('Could not edit navigation message, sending new one');
          const navMsg = await ctx.reply(navigationText, navigationKeyboard);
          navigationMessageId = navMsg.message_id;
        }
      } else {
        // Send new navigation message
        const navMsg = await ctx.reply(navigationText, navigationKeyboard);
        navigationMessageId = navMsg.message_id;
      }
      
      // Store message IDs in session for future edits
      sessionManager.setSessionData(chatId, 'buyOrdersMessages', {
        headerMessageId,
        orderMessageIds,
        navigationMessageId
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
      
      // Sell orders section shows buy orders from database (users wanting to sell CES)
      if (result.buyOrders.length === 0) {
        const message = `📉 ОРДЕРА НА ПРОДАЖУ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `⚠️ Активных ордеров на продажу пока нет\n\n` +
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
      const isEditMode = sessionData && sessionData.headerMessageId;
      
      // Отправляем заголовок
      let headerMessage = `📉 ОРДЕРА НА ПРОДАЖУ\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖\n`;
      
      let headerMessageId;
      
      if (isEditMode && sessionData.headerMessageId) {
        // Edit existing header message
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            sessionData.headerMessageId,
            null,
            headerMessage
          );
          headerMessageId = sessionData.headerMessageId;
        } catch (error) {
          console.log('Could not edit header message, sending new one');
          const headerMsg = await ctx.reply(headerMessage);
          headerMessageId = headerMsg.message_id;
        }
      } else {
        // Send new header message
        const headerMsg = await ctx.reply(headerMessage);
        headerMessageId = headerMsg.message_id;
      }
      
      // Отправляем каждый ордер отдельным сообщением или редактируем
      const reputationService = require('../services/reputationService');
      const orderMessageIds = [];
      
      // Display buy orders from database (users wanting to sell CES from market perspective)
      for (let i = 0; i < result.buyOrders.length; i++) {
        const order = result.buyOrders[i];
        const username = order.userId.username || order.userId.firstName || 'Пользователь';
        
        // Get standardized user statistics
        const stats = await reputationService.getStandardizedUserStats(order.userId._id);
        
        // Extract only emoji from rating (remove the number part)
        const emoji = stats.rating.split(' ').pop(); // Gets the last part after space (emoji)
        
        // Calculate limits in rubles based on price and amounts
        const minAmount = order.minTradeAmount || 1;
        const maxAmount = order.maxTradeAmount || order.remainingAmount;
        const minRubles = (minAmount * order.pricePerToken).toFixed(2);
        const maxRubles = (maxAmount * order.pricePerToken).toFixed(2);
        
        const orderMessage = `₽ ${order.pricePerToken.toFixed(2)} / CES | @${username} ${emoji}\n` +
                           `Количество: ${order.remainingAmount.toFixed(2)} CES\n` +
                           `Лимиты: ${minRubles} - ${maxRubles} ₽`;
        
        const orderKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🟥 Продать', `sell_details_${order.userId._id}_${order._id}`)]
        ]);
        
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
      
      // Пагинация над кнопкой "Назад" - умная логика для кнопок
      const navigationButtons = [];
      if (totalPages > 1) {
        const paginationButtons = [];
        
        // На первой странице - только кнопка вперед
        if (page === 1 && totalPages > 1) {
          paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_sell_orders'));
          paginationButtons.push(Markup.button.callback('➡️', `p2p_sell_orders_page_${page + 1}`));
        }
        // На последней странице - только кнопка назад
        else if (page === totalPages && totalPages > 1) {
          paginationButtons.push(Markup.button.callback('⬅️', `p2p_sell_orders_page_${page - 1}`));
          paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_sell_orders'));
        }
        // На средних страницах - обе кнопки
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
      
      const navigationKeyboard = Markup.inlineKeyboard(navigationButtons);
      
      let navigationMessageId;
      
      // Navigation message with page number in the correct format
      const navigationText = totalPages > 1 ? `➖➖➖➖➖➖➖➖➖➖➖` : 'Навигация';
      
      // Edit navigation message if exists
      if (isEditMode && sessionData.navigationMessageId) {
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            sessionData.navigationMessageId,
            null,
            navigationText,
            navigationKeyboard
          );
          navigationMessageId = sessionData.navigationMessageId;
        } catch (error) {
          console.log('Could not edit navigation message, sending new one');
          const navMsg = await ctx.reply(navigationText, navigationKeyboard);
          navigationMessageId = navMsg.message_id;
        }
      } else {
        // Send new navigation message
        const navMsg = await ctx.reply(navigationText, navigationKeyboard);
        navigationMessageId = navMsg.message_id;
      }
      
      // Store message IDs in session for future edits
      sessionManager.setSessionData(chatId, 'sellOrdersMessages', {
        headerMessageId,
        orderMessageIds,
        navigationMessageId
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
      const isEditMode = sessionData && sessionData.headerMessageId;
      
      const totalPages = Math.ceil(result.totalCount / limit);
      
      // Отправляем заголовок
      let headerMessage = `📋 МОИ ОРДЕРА\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖\n`;
      
      let headerMessageId;
      
      if (isEditMode && sessionData.headerMessageId) {
        // Edit existing header message
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            sessionData.headerMessageId,
            null,
            headerMessage
          );
          headerMessageId = sessionData.headerMessageId;
        } catch (error) {
          console.log('Could not edit header message, sending new one');
          const headerMsg = await ctx.reply(headerMessage);
          headerMessageId = headerMsg.message_id;
        }
      } else {
        // Send new header message
        const headerMsg = await ctx.reply(headerMessage);
        headerMessageId = headerMsg.message_id;
      }
      
      // Отправляем каждый ордер отдельным сообщением или редактируем
      const orderMessageIds = [];
      
      if (result.orders.length === 0) {
        // Show empty state message
        const emptyMessage = page === 1 ? 
          `⚠️ У вас пока нет активных ордеров\n\n💡 Создайте ордер на покупку или продажу CES !` :
          `⚠️ На этой странице нет ордеров`;
        
        let emptyMessageId;
        
        // Try to edit existing empty message if we have session data
        if (isEditMode && sessionData.orderMessageIds && sessionData.orderMessageIds[0]) {
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              sessionData.orderMessageIds[0],
              null,
              emptyMessage
            );
            emptyMessageId = sessionData.orderMessageIds[0];
          } catch (error) {
            console.log('Could not edit empty message, sending new one');
            const emptyMsg = await ctx.reply(emptyMessage);
            emptyMessageId = emptyMsg.message_id;
          }
        } else {
          // Send new empty message
          const emptyMsg = await ctx.reply(emptyMessage);
          emptyMessageId = emptyMsg.message_id;
        }
        
        orderMessageIds.push(emptyMessageId);
      } else {
        // Display orders if any exist
        for (let i = 0; i < result.orders.length; i++) {
          const order = result.orders[i];
          const orderNumber = offset + i + 1;
          const orderType = order.type === 'buy' ? '📈 Покупка' : '📉 Продажа';
          const status = order.status === 'active' ? 'Активен' : 
                        order.status === 'partial' ? 'Частично исполнен' : 
                        order.status === 'completed' ? 'Исполнен' : 'Отменен';
          
          const orderMessage = `${orderNumber}. ${orderType}\n` +
                              `${order.amount.toFixed(2)} CES по ₽ ${order.pricePerToken.toFixed(2)}\n` +
                              `Статус: ${status}\n` +
                              `${order.createdAt.toLocaleString('ru-RU')}\n` +
                              `ID: ${order._id}`;
          
          // Add cancel button for active and partial orders
          const orderKeyboard = (order.status === 'active' || order.status === 'partial') ?
            Markup.inlineKeyboard([
              [Markup.button.callback(`❌ Отменить ордер #${order._id.toString().substr(0, 6)}`, `cancel_order_${order._id}`)]
            ]) : null;
          
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
      
      // Пагинация над кнопкой "Назад" - умная логика для кнопок (как в рыночных ордерах)
      const navigationButtons = [];
      if (totalPages > 1) {
        const paginationButtons = [];
        
        // На первой странице - только кнопка вперед
        if (page === 1 && totalPages > 1) {
          paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
          paginationButtons.push(Markup.button.callback('➡️', `p2p_my_orders_page_${page + 1}`));
        }
        // На последней странице - только кнопка назад
        else if (page === totalPages && totalPages > 1) {
          paginationButtons.push(Markup.button.callback('⬅️', `p2p_my_orders_page_${page - 1}`));
          paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_my_orders'));
        }
        // На средних страницах - обе кнопки
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
      
      const navigationKeyboard = Markup.inlineKeyboard(navigationButtons);
      
      let navigationMessageId;
      
      // Navigation message with clean separator format
      const navigationText = totalPages > 1 ? `➖➖➖➖➖➖➖➖➖➖➖` : 'Навигация';
      
      // Edit navigation message if exists
      if (isEditMode && sessionData.navigationMessageId) {
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            sessionData.navigationMessageId,
            null,
            navigationText,
            navigationKeyboard
          );
          navigationMessageId = sessionData.navigationMessageId;
        } catch (error) {
          console.log('Could not edit navigation message, sending new one');
          const navMsg = await ctx.reply(navigationText, navigationKeyboard);
          navigationMessageId = navMsg.message_id;
        }
      } else {
        // Send new navigation message
        const navMsg = await ctx.reply(navigationText, navigationKeyboard);
        navigationMessageId = navMsg.message_id;
      }
      
      // Store message IDs in session for future edits (using same key structure as market orders)
      sessionManager.setSessionData(chatId, 'myOrdersMessages', {
        headerMessageId,
        orderMessageIds,
        navigationMessageId
      });
      
    } catch (error) {
      console.error('My orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров.');
    }
  }
}

module.exports = P2POrdersHandler;