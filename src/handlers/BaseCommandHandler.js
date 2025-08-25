/**
 * Base Command Handler
 * Handles basic commands like /start, /price and message routing
 */

const { Markup } = require('telegraf');
const priceService = require('../services/priceService');
const { User, PriceHistory, isDatabaseConnected } = require('../database/models');
const sessionManager = require('./SessionManager');

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
      
      // Main menu with regular keyboard buttons (only 2 buttons as requested)
      const mainMenu = Markup.keyboard([
        ['👤 Личный кабинет', '🔄 P2P Биржа']
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

  // Handle price command and button with immediate response
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
      
      // Save data to database (only when calling /price and if database is available)
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
      
      // Message format exactly as in example
      const message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $ ${priceData.price.toFixed(2)} | ₽ ${priceData.priceRub.toFixed(2)}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(1)}% • 🅥 $ ${priceService.formatNumber(priceData.volume24h).replace(/(\d+\.\d{2})K/, (match) => {
        const num = parseFloat(match.replace('K', ''));
        return num.toFixed(1) + 'K';
      })} • 🅐🅣🅗 ${athDisplay}`;
      
      // Edit the original message instead of sending new one
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        message
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
      if (text.includes('Личный кабинет')) {
        console.log(`🏠 Handling Personal Cabinet request from ${chatId}`);
        if (!this.walletHandler) {
          // Fallback - create WalletHandler instance
          const WalletHandler = require('./WalletHandler');
          const walletHandler = new WalletHandler();
          return await walletHandler.handlePersonalCabinetText(ctx);
        }
        return await this.walletHandler.handlePersonalCabinetText(ctx);
      }
      
      if (text.includes('P2P Биржа') || text.includes('🔄 P2P')) {
        console.log(`🔄 Handling P2P Menu request from ${chatId}`);
        if (!this.p2pHandler) {
          return await ctx.reply('❌ Ошибка: P2P handler не инициализирован');
        }
        return await this.p2pHandler.handleP2PMenu(ctx);
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

  // Handle back to main menu
  async handleBackToMenu(ctx) {
    try {
      const mainMenu = Markup.keyboard([
        ['👤 Личный кабинет', '🔄 P2P']
      ]).resize();
      
      await ctx.reply('🌾 Главное меню', mainMenu);
    } catch (error) {
      console.error('Back to menu error:', error);
      await ctx.reply('❌ Ошибка возврата в главное меню.');
    }
  }
}

module.exports = BaseCommandHandler;