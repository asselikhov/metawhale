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
const LocalizationHelper = require('../utils/localizationHelper');

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
      
      // Main menu with regular keyboard buttons (4 buttons in 1 row)
      const mainMenu = Markup.keyboard(
        LocalizationHelper.getLocalizedMainMenu(chatId)
      ).resize();
      
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

  // Handle price command for any token
  async handlePrice(ctx, tokenSymbol = 'CES') {
    try {
      console.log(`💰 handlePrice called for ${tokenSymbol}`);
      
      // Send immediate acknowledgment
      const sentMessage = await ctx.reply(`⏳ Получаем актуальную цену ${tokenSymbol}...`);
      console.log(`💰 Price command acknowledgment sent for ${tokenSymbol}`);
      
      // Process price data in background and update the message
      this.processPriceData(ctx, sentMessage, tokenSymbol);
      
    } catch (error) {
      console.error(`Error sending ${tokenSymbol} price to user:`, error);
      try {
        await ctx.reply(`❌ Не удается получить цену ${tokenSymbol} в данный момент. Попробуйте позже.`);
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  // Process price data in background
  async processPriceData(ctx, sentMessage, tokenSymbol = 'CES') {
    try {
      let priceData;
      
      // Get price data based on token symbol
      switch (tokenSymbol.toUpperCase()) {
        case 'CES':
          priceData = await priceService.getCESPrice();
          break;
        case 'POL':
          priceData = await priceService.getPOLPrice();
          break;
        case 'TRX':
          priceData = await priceService.getTRXPrice();
          break;
        case 'BNB':
          priceData = await priceService.getBNBPrice();
          break;
        case 'SOL':
          priceData = await priceService.getSOLPrice();
          break;
        case 'ETH':
          priceData = await priceService.getETHPrice();
          break;
        case 'ARB':
          priceData = await priceService.getARBPrice();
          break;
        case 'AVAX':
          priceData = await priceService.getAVAXPrice();
          break;
        case 'USDT':
          priceData = await priceService.getUSDTPrice();
          break;
        case 'USDC':
          priceData = await priceService.getUSDCPrice();
          break;
        case 'BUSD':
          priceData = await priceService.getBUSDPrice();
          break;
        case 'TON':
          priceData = await priceService.getTONPrice();
          break;
        case 'NOT':
          priceData = await priceService.getNOTPrice();
          break;
        default:
          throw new Error(`Unsupported token: ${tokenSymbol}`);
      }
      
      // Save data to database (only for CES and if database is available)
      if (isDatabaseConnected() && !priceData.cached && tokenSymbol === 'CES') {
        try {
          await new PriceHistory(priceData).save();
          console.log(`💾 Price data saved: $${priceData.price.toFixed(2)} | ATH: $${priceData.ath ? priceData.ath.toFixed(2) : 'N/A'}`);
        } catch (dbError) {
          console.error('Database error during price saving:', dbError);
        }
      }
      
      // Determine emoji for price change
      const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
      const changeSign = priceData.change24h >= 0 ? '+' : '';
      
      // Token-specific display configuration
      const tokenConfig = this.getTokenDisplayConfig(tokenSymbol);
      
      // Check if current price is ATH (mainly for CES)
      let athDisplay = '';
      if (priceData.ath) {
        const isNewATH = priceData.price >= priceData.ath;
        athDisplay = ` • 🅐🅣🅗 ${isNewATH ? '🏆' : ''} $ ${priceData.ath.toFixed(2)}`;
      }
      
      // Source indicator (only for database)
      const sourceEmoji = priceData.source === 'database' ? '🗄️' : '';
      
      // Format volume if available
      let volumeDisplay = '';
      if (priceData.volume24h) {
        volumeDisplay = ` • 🅥 $ ${priceService.formatNumber(priceData.volume24h)}`;
      }
      
      // Message format - all tokens now show P2P promotion
      let message;
      if (tokenSymbol === 'CES') {
        // Special format for CES with P2P promotion
        message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${tokenConfig.emoji} Цена токена ${tokenSymbol}: $ ${priceData.price.toFixed(tokenConfig.priceDecimals)} | ₽ ${priceData.priceRub.toFixed(2)}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(1)}%${volumeDisplay}${athDisplay}

Торгуй CES удобно и безопасно  
<a href="https://t.me/rogassistant_bot">P2P Биржа</a>: Покупка и продажа за ₽`;
      } else {
        // Standard format for ALL other tokens with P2P promotion using token name
        message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${tokenConfig.emoji} Цена токена ${tokenSymbol}: $ ${priceData.price.toFixed(tokenConfig.priceDecimals)} | ₽ ${priceData.priceRub.toFixed(2)}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(1)}%${volumeDisplay}${athDisplay}

Торгуй ${tokenSymbol} удобно и безопасно  
<a href="https://t.me/rogassistant_bot">P2P Биржа</a>: Покупка и продажа за ₽`;
      }
      
      // Edit the original message
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        message,
        { parse_mode: 'HTML' }
      );
      
    } catch (error) {
      console.error(`Error processing ${tokenSymbol} price data:`, error);
      // Update the message with error
      try {
        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          `❌ Не удается получить цену ${tokenSymbol} в данный момент. Попробуйте позже.`
        );
      } catch (editError) {
        console.error('Error editing message:', editError);
        // If editing fails, send a new message
        try {
          await ctx.reply(`❌ Не удается получить цену ${tokenSymbol} в данный момент. Попробуйте позже.`);
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
      
      // 🚨 Check if DisputeHandler can process this text input
      try {
        const DisputeHandler = require('./DisputeHandler');
        const disputeHandler = new DisputeHandler();
        const disputeHandled = await disputeHandler.processTextInput(ctx, text);
        if (disputeHandled) {
          return; // Text was processed by dispute handler
        }
      } catch (disputeError) {
        console.error('Dispute handler error:', disputeError);
        // Continue with normal processing if dispute handler fails
      }
      
      // ⚖️ Check if AdminDisputeHandler can process this text input
      try {
        const AdminDisputeHandler = require('./AdminDisputeHandler');
        const adminDisputeHandler = new AdminDisputeHandler();
        const adminHandled = await adminDisputeHandler.processTextInput(ctx, text);
        if (adminHandled) {
          return; // Text was processed by admin dispute handler
        }
      } catch (adminDisputeError) {
        console.error('Admin dispute handler error:', adminDisputeError);
        // Continue with normal processing if admin dispute handler fails
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
      
      // Handle settings button
      if (text.includes('⚙️') || text.includes('Настройки')) {
        console.log(`⚙️ Handling Settings request from ${chatId}`);
        return await this.handleSettingsMenu(ctx);
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
      const chatId = ctx.chat.id.toString();
      const mainMenu = Markup.keyboard(
        LocalizationHelper.getLocalizedMainMenu(chatId)
      ).resize();
      
      await ctx.reply(LocalizationHelper.getText(chatId, 'main_menu'), mainMenu);
    } catch (error) {
      console.error('Back to menu error:', error);
      await ctx.reply('❌ Ошибка возврата в главное меню.');
    }
  }

  // Handle settings menu
  async handleSettingsMenu(ctx) {
    try {
      const languageService = require('../services/languageService');
      
      const message = '⚙️ Настройки';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🌍 Выберите язык', 'select_language')],
        [Markup.button.callback('🔗 Выберите сеть', 'select_network')],
        [Markup.button.callback('💰 Выберите валюту', 'select_currency')],
        [Markup.button.callback('🔙 Назад', 'back_to_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Settings menu error:', error);
      await ctx.reply('❌ Ошибка открытия настроек.');
    }
  }

  // Handle language selection
  async handleLanguageSelection(ctx) {
    try {
      const languageService = require('../services/languageService');
      const languages = languageService.getSupportedLanguages();
      
      const message = '🌍 Выберите язык интерфейса:';
      
      // Create language buttons (2 per row)
      const languageButtons = [];
      for (let i = 0; i < languages.length; i += 2) {
        const row = [];
        
        // First language in row
        const lang1 = languages[i];
        row.push(Markup.button.callback(
          `${lang1.flag} ${lang1.country}`,
          `select_language_${lang1.code}`
        ));
        
        // Second language in row (if exists)
        if (i + 1 < languages.length) {
          const lang2 = languages[i + 1];
          row.push(Markup.button.callback(
            `${lang2.flag} ${lang2.country}`,
            `select_language_${lang2.code}`
          ));
        }
        
        languageButtons.push(row);
      }
      
      // Add back button
      languageButtons.push([Markup.button.callback('🔙 Назад', 'settings_menu')]);
      
      const keyboard = Markup.inlineKeyboard(languageButtons);
      
      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Language selection error:', error);
      await ctx.reply('❌ Ошибка выбора языка.');
    }
  }

  // Handle language selection confirmation
  async handleLanguageSelected(ctx, languageCode) {
    try {
      const chatId = ctx.chat.id.toString();
      const languageService = require('../services/languageService');
      
      // Set user language preference
      languageService.setUserLanguage(chatId, languageCode);
      
      // Get language config
      const languageConfig = languageService.getLanguageConfig(languageCode);
      
      const message = `✅ Язык интерфейса установлен: ${languageConfig.flag} ${languageConfig.country}`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'settings_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Language selection confirmation error:', error);
      await ctx.reply('❌ Ошибка установки языка.');
    }
  }

  // Handle network selection
  async handleNetworkSelection(ctx) {
    try {
      const userNetworkService = require('../services/userNetworkService');
      const multiChainService = require('../services/multiChainService');
      
      const chatId = ctx.chat.id.toString();
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      
      const message = '🌐 Выберите блокчейн сеть:';
      
      // Get network selector buttons
      const networkButtons = multiChainService.getNetworkSelectorButtons(currentNetwork);
      
      // Add back button
      networkButtons.push([Markup.button.callback('🔙 Назад', 'settings_menu')]);
      
      const keyboard = Markup.inlineKeyboard(networkButtons);
      
      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Network selection error:', error);
      await ctx.reply('❌ Ошибка выбора сети.');
    }
  }

  // Handle network selection confirmation
  async handleNetworkSelected(ctx, networkId) {
    try {
      const chatId = ctx.chat.id.toString();
      const userNetworkService = require('../services/userNetworkService');
      const multiChainService = require('../services/multiChainService');
      
      // Set user network preference
      await userNetworkService.setUserNetwork(chatId, networkId);
      
      // Get network config
      const networkConfig = multiChainService.getNetworkConfig(networkId);
      const networkEmoji = multiChainService.getNetworkEmoji(networkId);
      
      const message = `✅ Сеть установлена: ${networkEmoji} ${networkConfig.name}`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'settings_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Network selection confirmation error:', error);
      await ctx.reply('❌ Ошибка установки сети.');
    }
  }

  // Handle currency selection
  async handleCurrencySelection(ctx) {
    try {
      const fiatCurrencyService = require('../services/fiatCurrencyService');
      
      const chatId = ctx.chat.id.toString();
      const currentCurrency = await fiatCurrencyService.getUserCurrency(chatId);
      
      const message = '💰 Выберите фиатную валюту:';
      
      // Get supported currencies
      const supportedCurrencies = [
        { code: 'RUB', name: 'Российский рубль', flag: '🇷🇺' },
        { code: 'USD', name: 'Доллар США', flag: '🇺🇸' },
        { code: 'EUR', name: 'Евро', flag: '🇪🇺' },
        { code: 'CNY', name: 'Китайский юань', flag: '🇨🇳' },
        { code: 'INR', name: 'Индийская рупия', flag: '🇮🇳' },
        { code: 'NGN', name: 'Нигерийская найра', flag: '🇳🇬' },
        { code: 'VND', name: 'Вьетнамский донг', flag: '🇻🇳' },
        { code: 'KRW', name: 'Южнокорейская вона', flag: '🇰🇷' },
        { code: 'JPY', name: 'Японская иена', flag: '🇯🇵' },
        { code: 'BRL', name: 'Бразильский реал', flag: '🇧🇷' }
      ];
      
      // Create currency buttons (2 per row)
      const currencyButtons = [];
      for (let i = 0; i < supportedCurrencies.length; i += 2) {
        const row = [];
        
        // First currency in row
        const currency1 = supportedCurrencies[i];
        const isSelected1 = currency1.code === currentCurrency;
        const buttonText1 = isSelected1 
          ? `${currency1.flag} ${currency1.name} (${currency1.code}) ✅` 
          : `${currency1.flag} ${currency1.name} (${currency1.code})`;
        row.push(Markup.button.callback(buttonText1, `select_currency_${currency1.code}`));
        
        // Second currency in row (if exists)
        if (i + 1 < supportedCurrencies.length) {
          const currency2 = supportedCurrencies[i + 1];
          const isSelected2 = currency2.code === currentCurrency;
          const buttonText2 = isSelected2 
            ? `${currency2.flag} ${currency2.name} (${currency2.code}) ✅` 
            : `${currency2.flag} ${currency2.name} (${currency2.code})`;
          row.push(Markup.button.callback(buttonText2, `select_currency_${currency2.code}`));
        }
        
        currencyButtons.push(row);
      }
      
      // Add back button
      currencyButtons.push([Markup.button.callback('🔙 Назад', 'settings_menu')]);
      
      const keyboard = Markup.inlineKeyboard(currencyButtons);
      
      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Currency selection error:', error);
      await ctx.reply('❌ Ошибка выбора валюты.');
    }
  }

  // Handle currency selection confirmation
  async handleCurrencySelected(ctx, currencyCode) {
    try {
      const chatId = ctx.chat.id.toString();
      const fiatCurrencyService = require('../services/fiatCurrencyService');
      
      // Set user currency preference
      await fiatCurrencyService.setUserCurrency(chatId, currencyCode);
      
      // Get currency info
      const supportedCurrencies = [
        { code: 'RUB', name: 'Российский рубль', flag: '🇷🇺' },
        { code: 'USD', name: 'Доллар США', flag: '🇺🇸' },
        { code: 'EUR', name: 'Евро', flag: '🇪🇺' },
        { code: 'CNY', name: 'Китайский юань', flag: '🇨🇳' },
        { code: 'INR', name: 'Индийская рупия', flag: '🇮🇳' },
        { code: 'NGN', name: 'Нигерийская найра', flag: '🇳🇬' },
        { code: 'VND', name: 'Вьетнамский донг', flag: '🇻🇳' },
        { code: 'KRW', name: 'Южнокорейская вона', flag: '🇰🇷' },
        { code: 'JPY', name: 'Японская иена', flag: '🇯🇵' },
        { code: 'BRL', name: 'Бразильский реал', flag: '🇧🇷' }
      ];
      
      const selectedCurrency = supportedCurrencies.find(c => c.code === currencyCode);
      
      const message = `✅ Валюта установлена: ${selectedCurrency.flag} ${selectedCurrency.name} (${selectedCurrency.code})`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'settings_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Currency selection confirmation error:', error);
      await ctx.reply('❌ Ошибка установки валюты.');
    }
  }

  // Get token display configuration
  getTokenDisplayConfig(tokenSymbol) {
    const configs = {
      CES: {
        emoji: '💰',
        priceDecimals: 2,
        description: 'Торгуй CES удобно и безопасно на P2P бирже!'
      },
      POL: {
        emoji: '🟣',
        priceDecimals: 4,
        description: 'Polygon экосистема • Низкие комиссии • Быстрые транзакции'
      },
      TRX: {
        emoji: '🔴',
        priceDecimals: 4,
        description: 'TRON блокчейн • Бесплатные транзакции • Высокая пропускная способность'
      },
      BNB: {
        emoji: '🟡',
        priceDecimals: 2,
        description: 'Binance Smart Chain • DeFi экосистема • Низкие комиссии'
      },
      SOL: {
        emoji: '🟢',
        priceDecimals: 2,
        description: 'Solana блокчейн • Молниеносные транзакции • NFT и DeFi'
      },
      ETH: {
        emoji: '🔵',
        priceDecimals: 2,
        description: 'Ethereum • Пионер смарт-контрактов • DeFi и NFT экосистема'
      },
      ARB: {
        emoji: '🔵',
        priceDecimals: 4,
        description: 'Arbitrum One • Layer 2 Ethereum • Масштабирование без потерь'
      },
      AVAX: {
        emoji: '🔶',
        priceDecimals: 2,
        description: 'Avalanche • Быстрая и масштабируемая платформа'
      },
      USDT: {
        emoji: '💵',
        priceDecimals: 4,
        description: 'Tether USD • Стабильная монета • 1:1 к USD'
      },
      USDC: {
        emoji: '💵',
        priceDecimals: 4,
        description: 'USD Coin • Централизованная стабильная монета'
      },
      BUSD: {
        emoji: '🟡',
        priceDecimals: 4,
        description: 'Binance USD • Стабильная монета Binance'
      },
      TON: {
        emoji: '💎',
        priceDecimals: 2,
        description: 'TON Network • Быстрый и масштабируемый блокчейн'
      },
      NOT: {
        emoji: '💎',
        priceDecimals: 6,
        description: 'Notcoin • Мем-коин на TON • Коммюнити проект'
      }
    };
    
    return configs[tokenSymbol.toUpperCase()] || {
      emoji: '💰',
      priceDecimals: 4,
      description: 'Криптовалюта'
    };
  }
}

module.exports = BaseCommandHandler;