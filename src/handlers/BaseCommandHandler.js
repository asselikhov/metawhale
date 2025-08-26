/**
 * Base Command Handler
 * Handles basic commands like /start, /ces and message routing
 */

const { Markup } = require('telegraf');
const priceService = require('../services/priceService');
const commissionTrackingService = require('../services/commissionTrackingService');
const visitorStatsService = require('../services/visitorStatsService');
const { User, PriceHistory, isDatabaseConnected } = require('../database/models');
const sessionManager = require('./SessionManager');
const fs = require('fs').promises;

class BaseCommandHandler {
  constructor() {
    // Handlers will be injected to avoid circular imports
    this.walletHandler = null;
    this.p2pHandler = null;
    this.transferHandler = null;
  }

  // Method to inject handlers (called from MessageHandler)
  setHandlers(walletHandler, p2pHandler, transferHandler, dataHandler) {
    this.walletHandler = walletHandler;
    this.p2pHandler = p2pHandler;
    this.transferHandler = transferHandler;
    this.dataHandler = dataHandler;
  }

  // Handle /start command
  async handleStart(ctx) {
    try {
      console.log('🚀 handleStart called');
      
      const chatId = ctx.chat.id.toString();
      console.log(`🚀 Handling /start command for user ${chatId}`);
      
      // Register or update user in database (if available)
      let user = null;
      if (isDatabaseConnected()) {
        try {
          user = await User.findOneAndUpdate(
            { chatId },
            {
              username: ctx.from.username,
              firstName: ctx.from.first_name,
              lastName: ctx.from.last_name,
              isActive: true
            },
            { upsert: true, new: true }
          );
          console.log(`👤 User registered/updated in database:`, user ? `User ${user.username || user.firstName}` : 'No user data');
        } catch (dbError) {
          console.error('Database error during user registration:', dbError);
        }
      }
      
      const welcomeMessage = 'Добро пожаловать в Rustling Grass 🌾 assistant !';
      console.log(`💬 Welcome message: ${welcomeMessage}`);
      
      // Main menu with regular keyboard buttons (3 buttons in 1 row)
      const mainMenu = Markup.keyboard([
        ['👤 ЛК', '🔄 P2P', '💠 Matrix']
      ]).resize();
      
      console.log(`📤 Sending welcome message to user ${chatId}`);
      console.log(`⌨ Keyboard markup configured`);
      
      const result = await ctx.reply(welcomeMessage, mainMenu);
      console.log(`✅ Welcome message sent successfully to user ${chatId}`);
      
    } catch (error) {
      console.error('Start command error:', error);
      try {
        await ctx.reply('Произошла ошибка при запуске. Попробуйте еще раз.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  // Handle ces command and button with immediate response
  async handlePrice(ctx) {
    try {
      console.log('💰 handlePrice called');
      
      // Send immediate acknowledgment
      const sentMessage = await ctx.reply('⏳ Получаем актуальную цену...');
      console.log('💰 Price command acknowledgment sent');
      
      // Process price data in background and update the message
      this.processPriceData(ctx, sentMessage);
      
    } catch (error) {
      console.error('Error sending price to user:', error);
      try {
        await ctx.reply('❌ Не удается получить цену CES в данный момент. Попробуйте позже.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  // Process price data in background
  async processPriceData(ctx, sentMessage) {
    try {
      const priceData = await priceService.getCESPrice();
      
      // Save data to database (only when calling /ces and if database is available)
      if (isDatabaseConnected() && !priceData.cached) {
        try {
          await new PriceHistory(priceData).save();
          console.log(`💾 Price data saved: $${priceData.price.toFixed(2)} | ATH: $${priceData.ath.toFixed(2)}`);
        } catch (dbError) {
          console.error('Database error during price saving:', dbError);
        }
      }
      
      // Determine emoji for price change
      const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
      const changeSign = priceData.change24h >= 0 ? '+' : '';
      
      // Check if current price is ATH
      const isNewATH = priceData.price >= priceData.ath;
      const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
      
      // Source indicator (only for database)
      const sourceEmoji = priceData.source === 'database' ? '🗄️' : '';
      
      // Message format with P2P promotional content (same as scheduled message)
      const message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $ ${priceData.price.toFixed(2)} | ₽ ${priceData.priceRub.toFixed(2)}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(1)}% • 🅥 $ ${priceService.formatNumber(priceData.volume24h).replace(/(\d+\.\d{2})K/, (match) => {
        const num = parseFloat(match.replace('K', ''));
        return num.toFixed(1) + 'K';
      })} • 🅐🅣🅗 ${athDisplay}

⚡️ Торгуй CES удобно и безопасно  
💱 [P2P Биржа](https://t.me/rogassistant_bot): Покупка и продажа за ₽`;
      
      // Edit the original message instead of sending new one
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        message,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Error processing price data:', error);
      // Update the message with error
      try {
        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          '❌ Не удается получить цену CES в данный момент. Попробуйте позже.'
        );
      } catch (editError) {
        console.error('Error editing message:', editError);
        // If editing fails, send a new message
        try {
          await ctx.reply('❌ Не удается получить цену CES в данный момент. Попробуйте позже.');
        } catch (replyError) {
          console.error('Failed to send error message:', replyError);
        }
      }
    }
  }

  // Handle text messages from regular keyboard buttons
  async handleTextMessage(ctx) {
    try {
      console.log('📝 handleTextMessage called');
      
      // Skip processing if this is a callback query (button press)
      if (ctx.callbackQuery) {
        console.log('📝 Skipping text processing - this is a callback query');
        return;
      }
      
      const text = ctx.message.text;
      const chatId = ctx.chat.id.toString();
      
      console.log(`📝 Processing text message from ${chatId}: "${text}"`);
      
      // Check user state and delegate to appropriate handler
      const userState = sessionManager.getUserState(chatId);
      
      // Check if P2P data handler can process this text input
      if (this.dataHandler) {
        const handled = await this.dataHandler.processTextInput(ctx, text);
        if (handled) {
          return; // Text was processed by P2P data handler
        }
      }
      
      switch (userState) {
        case 'transfer':
          if (!this.transferHandler) {
            return await ctx.reply('❌ Ошибка: Transfer handler не инициализирован');
          }
          const transferType = sessionManager.getSessionData(chatId, 'transferType') || 'CES';
          sessionManager.clearUserSession(chatId);
          return await this.transferHandler.processTransferCommand(ctx, text, transferType);
          
        case 'p2p_order':
          if (!this.p2pHandler) {
            return await ctx.reply('❌ Ошибка: P2P handler не инициализирован');
          }
          const orderType = sessionManager.getSessionData(chatId, 'p2pOrderType') || 'buy';
          console.log(`🔄 Processing P2P order: type=${orderType}, text="${text}"`);
          // NOTE: Don't clear session here - let processP2POrder handle it after successful processing
          return await this.p2pHandler.processP2POrder(ctx, text, orderType);
          
        case 'user_message':
          if (!this.p2pHandler) {
            return await ctx.reply('❌ Ошибка: P2P handler не инициализирован');
          }
          console.log(`🔄 Processing user message: text="${text}"`);
          sessionManager.clearUserSession(chatId);
          return await this.p2pHandler.processUserMessage(ctx, text);
      }
      
      // Handle main menu buttons
      if (text.includes('ЛК') || text.includes('Личный кабинет')) {
        console.log(`🏠 Handling Personal Cabinet request from ${chatId}`);
        if (!this.walletHandler) {
          // Fallback - create WalletHandler instance
          const WalletHandler = require('./WalletHandler');
          const walletHandler = new WalletHandler();
          return await walletHandler.handlePersonalCabinetText(ctx);
        }
        return await this.walletHandler.handlePersonalCabinetText(ctx);
      }
      
      if (text.includes('P2P Биржа') || text.includes('🔄 P2P') || text.includes('P2P')) {
        console.log(`🔄 Handling P2P Menu request from ${chatId}`);
        if (!this.p2pHandler) {
          return await ctx.reply('❌ Ошибка: P2P handler не инициализирован');
        }
        return await this.p2pHandler.handleP2PMenu(ctx);
      }
      
      if (text.includes('Matrix CES') || text.includes('💠 Matrix') || text.includes('Matrix')) {
        console.log(`💠 Handling Matrix request from ${chatId}`);
        return await ctx.reply('⚠️ Этот раздел находится в разработке.\n\n🔔 Следите за обновлениями — запуск уже скоро!');
      }
      
      // Check if message looks like a transfer command (address amount)
      const transferPattern = /^0x[a-fA-F0-9]{40}\s+\d+\.?\d*$/;
      if (transferPattern.test(text.trim())) {
        if (!this.transferHandler) {
          return await ctx.reply('❌ Ошибка: Transfer handler не инициализирован');
        }
        return await this.transferHandler.processTransferCommand(ctx, text, 'CES');
      }
      
      // Check if message looks like a P2P order (amount price)
      const p2pOrderPattern = /^\d+[,.]?\d*\s+\d+[,.]?\d*$/;
      if (p2pOrderPattern.test(text.trim())) {
        console.log(`🤔 Message looks like P2P order but no session found: "${text}"`);
        return await ctx.reply('❌ Сначала выберите тип ордера (покупка или продажа) через меню P2P.\n\n💡 Нажмите кнопку "P2P" для доступа к торговле.');
      }
      
      // Default response for unknown text
      console.log(`❓ Unknown command from ${chatId}: "${text}"`);
      await ctx.reply('😕 Не понимаю эту команду. Используйте кнопки меню или команду /start');
      
    } catch (error) {
      console.error('Text message handler error:', error);
      try {
        await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  // Handle /fees command (admin only)
  async handleFees(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`💰 handleFees called by user ${chatId}`);
      
      // Check if user is admin
      const ADMIN_CHAT_ID = '942851377';
      if (chatId !== ADMIN_CHAT_ID) {
        console.log(`❌ Unauthorized fees command attempt by ${chatId}`);
        return await ctx.reply('❌ У вас нет доступа к этой команде.');
      }
      
      // Send immediate acknowledgment
      const sentMessage = await ctx.reply('⏳ Генерируем отчет по комиссиям...');
      console.log('💰 Fees command acknowledgment sent');
      
      // Process fee data in background and update the message
      this.processFeeData(ctx, sentMessage);
      
    } catch (error) {
      console.error('Error handling fees command:', error);
      try {
        await ctx.reply('❌ Ошибка генерации отчета по комиссиям.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  // Handle /stat command (admin only)
  async handleStat(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`📊 handleStat called by user ${chatId}`);
      
      // Check if user is admin
      const ADMIN_CHAT_ID = '942851377';
      if (chatId !== ADMIN_CHAT_ID) {
        console.log(`❌ Unauthorized stat command attempt by ${chatId}`);
        return await ctx.reply('❌ У вас нет доступа к этой команде.');
      }
      
      // Send immediate acknowledgment
      const sentMessage = await ctx.reply('⏳ Генерируем статистику посетителей...');
      console.log('📊 Stat command acknowledgment sent');
      
      // Process stat data in background and send Excel file
      this.processStatData(ctx, sentMessage);
      
    } catch (error) {
      console.error('Error handling stat command:', error);
      try {
        await ctx.reply('❌ Ошибка генерации статистики посетителей.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  // Process stat data in background and send Excel file
  async processStatData(ctx, sentMessage) {
    try {
      console.log('📊 Generating visitor statistics Excel report...');
      
      // Generate summary first
      const summary = await visitorStatsService.getVisitorStatsSummary();
      
      // Update message with progress
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        `📊 Генерируем Excel файл...

📊 Найдено посетителей: ${summary.totalMonthlyVisitors}
📅 Период: ${summary.monthYear}`
      );
      
      // Generate Excel file
      const excelFilePath = await visitorStatsService.generateExcelReport();
      
      // Create caption for the Excel file
      const caption = `📊 СТАТИСТИКА ПОСЕТИТЕЛЕЙ
` +
                     `➖➖➖➖➖➖➖➖➖➖➖

` +
                     `📅 Период: ${summary.monthYear}
` +
                     `👥 Всего посетителей: ${summary.totalMonthlyVisitors}
` +
                     `🔄 Активных на неделе: ${summary.recentlyActive}
` +
                     `🌅 Активных сегодня: ${summary.todayActive}
` +
                     `⭐ Новых за неделю: ${summary.newThisWeek}

` +
                     `📝 Столбцы:
` +
                     `1. ID Пользователя
` +
                     `2. Username
` +
                     `3. Имя
` +
                     `4. Дата посещения
` +
                     `5. Последняя активность

` +
                     `🕰 Сгенерировано: ${new Date().toLocaleString('ru-RU')}`;
      
      // Send Excel file
      await ctx.replyWithDocument(
        { source: excelFilePath },
        { caption }
      );
      
      // Delete the original processing message
      try {
        await ctx.telegram.deleteMessage(sentMessage.chat.id, sentMessage.message_id);
      } catch (deleteError) {
        console.log('Note: Could not delete processing message:', deleteError.message);
      }
      
      // Clean up the temporary file
      try {
        await fs.unlink(excelFilePath);
        console.log('🗑️ Temporary Excel file cleaned up');
      } catch (cleanupError) {
        console.log('Note: Could not clean up temporary file:', cleanupError.message);
      }
      
      // Clean up old files
      await visitorStatsService.cleanupOldFiles();
      
      console.log('✅ Visitor statistics Excel report sent successfully');
      
    } catch (error) {
      console.error('Error processing stat data:', error);
      
      // Update the message with error
      try {
        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          `❌ Ошибка генерации статистики посетителей.

⚠️ Ошибка: ${error.message}

🔄 Попробуйте позже.`
        );
      } catch (editError) {
        console.error('Error editing message:', editError);
        try {
          await ctx.reply('❌ Ошибка генерации статистики посетителей. Попробуйте позже.');
        } catch (replyError) {
          console.error('Failed to send error message:', replyError);
        }
      }
    }
  }

  // Process fee data in background
  async processFeeData(ctx, sentMessage) {
    try {
      console.log('💰 Generating comprehensive fee report...');
      
      const report = await commissionTrackingService.generateFeeReport();
      const formattedMessage = commissionTrackingService.formatFeeReport(report);
      
      // Edit the original message with the fee report
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        formattedMessage
      );
      
      console.log('✅ Fee report sent successfully');
      
    } catch (error) {
      console.error('Error processing fee data:', error);
      
      // Update the message with error
      try {
        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          '❌ Ошибка генерации отчета по комиссиям. Попробуйте позже.'
        );
      } catch (editError) {
        console.error('Error editing message:', editError);
        try {
          await ctx.reply('❌ Ошибка генерации отчета по комиссиям. Попробуйте позже.');
        } catch (replyError) {
          console.error('Failed to send error message:', replyError);
        }
      }
    }
  }

  // Handle back to main menu
  async handleBackToMenu(ctx) {
    try {
      const mainMenu = Markup.keyboard([
        ['👤 ЛК', '🔄 P2P', '💠 Matrix']
      ]).resize();
      
      await ctx.reply('🌾 Главное меню', mainMenu);
    } catch (error) {
      console.error('Back to menu error:', error);
      await ctx.reply('❌ Ошибка возврата в главное меню.');
    }
  }
}

module.exports = BaseCommandHandler;