/**
 * Message Handlers
 * Handles all Telegram bot message and callback processing
 */

const { Markup } = require('telegraf');
const priceService = require('../services/priceService');
const walletService = require('../services/walletService');
const p2pService = require('../services/p2pService');
const { User, PriceHistory, P2PTrade, isDatabaseConnected } = require('../database/models');

// Simple session storage for user states
const userSessions = new Map();

class MessageHandler {
  // Get or create user session
  getUserSession(chatId) {
    if (!userSessions.has(chatId)) {
      console.log(`🆕 Creating new session for user ${chatId}`);
      userSessions.set(chatId, {});
    } else {
      console.log(`🔄 Using existing session for user ${chatId}`);
    }
    return userSessions.get(chatId);
  }

  // Clear user session
  clearUserSession(chatId) {
    console.log(`🗑 Clearing session for user ${chatId}`);
    userSessions.delete(chatId);
  }

  // Set session data
  setSessionData(chatId, key, value) {
    const session = this.getUserSession(chatId);
    console.log(`💾 Setting session data for user ${chatId}: ${key} = ${JSON.stringify(value)}`);
    session[key] = value;
  }

  // Get session data
  getSessionData(chatId, key) {
    const session = this.getUserSession(chatId);
    const value = session[key];
    console.log(`🔍 Getting session data for user ${chatId}: ${key} = ${JSON.stringify(value)}`);
    return value;
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
      
      const text = ctx.message.text;
      const chatId = ctx.chat.id.toString();
      
      console.log(`📝 Processing text message from ${chatId}: "${text}"`);
      
      // Check if user is in transfer mode
      const awaitingTransfer = this.getSessionData(chatId, 'awaitingTransfer');
      if (awaitingTransfer) {
        const transferType = this.getSessionData(chatId, 'transferType') || 'CES';
        this.clearUserSession(chatId);
        return await this.processTransferCommand(ctx, text, transferType);
      }
      
      // Check if user is in P2P order mode
      const awaitingP2POrder = this.getSessionData(chatId, 'awaitingP2POrder');
      if (awaitingP2POrder) {
        const orderType = this.getSessionData(chatId, 'p2pOrderType') || 'buy';
        console.log(`🔄 Processing P2P order: type=${orderType}, text="${text}"`);
        this.clearUserSession(chatId);
        return await this.processP2POrder(ctx, text, orderType);
      }
      
      // Check if user is in user messaging mode
      const awaitingUserMessage = this.getSessionData(chatId, 'awaitingUserMessage');
      if (awaitingUserMessage) {
        console.log(`🔄 Processing user message: text="${text}"`);
        this.clearUserSession(chatId);
        return await this.processUserMessage(ctx, text);
      }
      
      if (text.includes('Личный кабинет')) {
        console.log(`🏠 Handling Personal Cabinet request from ${chatId}`);
        return await this.handlePersonalCabinetText(ctx);
      }
      
      if (text.includes('P2P Биржа') || text.includes('🔄 P2P')) {
        console.log(`🔄 Handling P2P Menu request from ${chatId}`);
        return await this.handleP2PMenu(ctx);
      }
      
      // Check if message looks like a transfer command (address amount)
      const transferPattern = /^0x[a-fA-F0-9]{40}\s+\d+\.?\d*$/;
      if (transferPattern.test(text.trim())) {
        return await this.processTransferCommand(ctx, text, 'CES');
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

  // Handle Personal Cabinet from text message
  async handlePersonalCabinetText(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`🏠 Processing Personal Cabinet request for user ${chatId}`);
      
      let walletInfo = null;
      if (isDatabaseConnected()) {
        try {
          walletInfo = await walletService.getUserWallet(chatId);
        } catch (dbError) {
          console.error('Database error during wallet retrieval:', dbError);
        }
      }
      
      // If database is not available or user not found, create a mock wallet info
      if (!walletInfo) {
        walletInfo = {
          hasWallet: false
        };
      }
      
      if (!walletInfo) {
        console.log(`❌ User ${chatId} not found`);
        return await ctx.reply('❌ Пользователь не найден. Выполните /start');
      }
      
      // Header as requested
      let message = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n';
      
      if (walletInfo.hasWallet) {
        console.log(`💼 User ${chatId} has wallet, showing wallet info`);
        // Get current price data for both tokens
        const [cesData, polData] = await Promise.all([
          priceService.getCESPrice(),
          priceService.getPOLPrice()
        ]);
      
        const cesTokenPrice = cesData ? cesData.price : 0;
        const cesTokenPriceRub = cesData ? cesData.priceRub : 0;
        const polTokenPrice = polData ? polData.price : 0.45;
        const polTokenPriceRub = polData ? polData.priceRub : 45.0;
      
        // Calculate total value of tokens on wallet
        const cesTotalUsd = (walletInfo.cesBalance * cesTokenPrice).toFixed(2);
        const cesTotalRub = (walletInfo.cesBalance * cesTokenPriceRub).toFixed(2);
        const polTotalUsd = (walletInfo.polBalance * polTokenPrice).toFixed(2);
        const polTotalRub = (walletInfo.polBalance * polTokenPriceRub).toFixed(2);
      
        // Format as requested
        message += `Баланс CES: ${walletInfo.cesBalance.toFixed(4)} • $ ${cesTotalUsd} • ₽ ${cesTotalRub}\n`;
        message += `Баланс POL: ${walletInfo.polBalance.toFixed(4)} • $ ${polTotalUsd} • ₽ ${polTotalRub}\n`;
      
        // Removed the refresh button as requested
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('💳 Кошелек', 'wallet_details')],
          [Markup.button.callback('💸 Перевод', 'transfer_menu')]
        ]);
      
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
      } else {
        console.log(`⚠️ User ${chatId} has no wallet, showing wallet creation prompt`);
        message += '⚠️ Кошелек не создан\n\n';
        message += '💡 Создайте кошелек для хранения токенов CES и POL';
      
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('➕ Создать кошелек', 'create_wallet')]
        ]);
      
        await ctx.reply(message, keyboard);
      }
      
    } catch (error) {
      console.error('Error showing personal cabinet:', error);
      try {
        await ctx.reply('❌ Ошибка загрузки личного кабинета. Попробуйте позже.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  // Handle user profile
  async handleUserProfile(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo) {
        return await ctx.reply('❌ Пользователь не найден. Выполните /start');
      }
      
      let message = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n';
      
      if (walletInfo.hasWallet) {
        // Get current price data for both tokens
        const [cesData, polData] = await Promise.all([
          priceService.getCESPrice(),
          priceService.getPOLPrice()
        ]);
        
        const cesTokenPrice = cesData ? cesData.price : 0;
        const cesTokenPriceRub = cesData ? cesData.priceRub : 0;
        const polTokenPrice = polData ? polData.price : 0.45;
        const polTokenPriceRub = polData ? polData.priceRub : 45.0;
        
        // Calculate total value of tokens on wallet
        const cesTotalUsd = (walletInfo.cesBalance * cesTokenPrice).toFixed(2);
        const cesTotalRub = (walletInfo.cesBalance * cesTokenPriceRub).toFixed(2);
        const polTotalUsd = (walletInfo.polBalance * polTokenPrice).toFixed(2);
        const polTotalRub = (walletInfo.polBalance * polTokenPriceRub).toFixed(2);
        
        message += `Баланс CES: ${walletInfo.cesBalance.toFixed(4)} • $ ${cesTotalUsd} • ₽ ${cesTotalRub}\n`;
        message += `Баланс POL: ${walletInfo.polBalance.toFixed(4)} • $ ${polTotalUsd} • ₽ ${polTotalRub}\n`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('💳 Кошелек', 'wallet_details')],
          [Markup.button.callback('💸 Перевод', 'transfer_menu')],
          [Markup.button.callback('🔄 Обновить', 'refresh_balance')]
        ]);
        
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        
      } else {
        message += '⚠️ Кошелек не создан\n\n';
        message += '💡 Создайте кошелек для хранения токенов CES и POL';
        
        // Remove the Главное меню button
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('➕ Создать кошелек', 'create_wallet')]
        ]);
        
        await ctx.reply(message, keyboard);
      }
      
    } catch (error) {
      console.error('Error showing personal cabinet:', error);
      await ctx.reply('❌ Ошибка загрузки личного кабинета. Попробуйте позже.');
    }
  }

  // Handle wallet creation
  async handleCreateWallet(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletResult = await walletService.createUserWallet(chatId);
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')],
        [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
      ]);
      
      await ctx.reply(
        `Кошелек успешно создан!\n\n` +
        `Адрес: \`${walletResult.address}\`\n` +
        `Сеть: Polygon\n\n` +
        `Важно: Сохраните приватный ключ в безопасном месте:\n` +
        `\`${walletResult.privateKey}\`\n\n` +
        `Предупреждение: Никому не сообщайте ваш приватный ключ!`,
        keyboard
      );
      
    } catch (error) {
      console.error('Wallet creation error:', error);
      await ctx.reply(`❌ ${error.message}`);
    }
  }

  // Handle wallet editing menu
  async handleWalletEdit(ctx) {
    try {
      const message = '⚙️ **Редактирование кошелька**\n\n' +
                     'Выберите действие:';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔑 Показать приватный ключ', 'show_private_key')],
        [Markup.button.callback('📤 Экспорт кошелька', 'export_wallet')],
        [Markup.button.callback('🗑 Удалить кошелек', 'delete_wallet')],
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Wallet edit menu error:', error);
      await ctx.reply('❌ Ошибка загрузки меню. Попробуйте позже.');
    }
  }

  // Handle wallet details view
  async handleWalletDetails(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);

      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.reply('❌ Кошелек не найден.');
      }

      // Get private key for display
      const privateKey = await walletService.getUserPrivateKey(chatId);

      // Format as requested
      const message = '💳 КОШЕЛЕК\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n' +
                     `Адрес: \n${walletInfo.address}\n\n` +
                     `Приватный ключ: ${privateKey}\n\n` +
                     `⚠️ Важно:\n` +
                     `Сохраните данные в безопасном месте\n` +
                     `Никому не передавайте приватный ключ\n` +
                     `Используйте для импорта в другие кошельки`;

      // Simplified keyboard with only back button
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'personal_cabinet')]
      ]);

      await ctx.reply(message, keyboard);

    } catch (error) {
      console.error('Wallet details error:', error);
      await ctx.reply('❌ Ошибка загрузки данных кошелька.');
    }
  }

  // Handle transfer menu
  async handleTransferMenu(ctx) {
    try {
      const message = '💸 ПЕРЕВОД\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n';

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💰 Перевести CES', 'send_ces_tokens')],
        [Markup.button.callback('💰 Перевести POL', 'send_pol_tokens')],
        [Markup.button.callback('📊 История', 'transaction_history')],
        [Markup.button.callback('🔙 Назад', 'personal_cabinet')]
      ]);

      await ctx.reply(message, keyboard);

    } catch (error) {
      console.error('Transfer menu error:', error);
      await ctx.reply('❌ Ошибка загрузки меню переводов.');
    }
  }

  // Show private key
  async handleShowPrivateKey(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const privateKey = await walletService.getUserPrivateKey(chatId);
      
      const message = `🔑 **Приватный ключ**\n\n` +
                     `⚠️ **Осторожно!** Никому не показывайте этот ключ!\n\n` +
                     `🔐 \`${privateKey}\``;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к редактированию', 'edit_wallet')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Show private key error:', error);
      await ctx.reply(`❌ ${error.message}`);
    }
  }

  // Handle wallet export
  async handleExportWallet(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      const privateKey = await walletService.getUserPrivateKey(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.reply('❌ Кошелек не найден.');
      }
      
      const message = `📤 **Экспорт кошелька**\n\n` +
                     `💳 Адрес: \`${walletInfo.address}\`\n` +
                     `🔑 Приватный ключ: \`${privateKey}\`\n\n` +
                     `⚠️ **Важно:**\n` +
                     `• Сохраните эту информацию в безопасном месте\n` +
                     `• Никому не передавайте приватный ключ\n` +
                     `• Используйте для импорта в другие кошельки`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к редактированию', 'edit_wallet')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Export wallet error:', error);
      await ctx.reply(`❌ ${error.message}`);
    }
  }

  // Handle wallet deletion
  async handleDeleteWallet(ctx) {
    try {
      const message = `⚠️ **Подтверждение удаления**\n\n` +
                     `🗑 Вы уверены, что хотите удалить кошелек?\n\n` +
                     `❗ **Это действие нельзя отменить!**\n` +
                     `• Все данные кошелька будут удалены\n` +
                     `• Доступ к средствам будет утрачен`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, удалить', 'confirm_delete_wallet')],
        [Markup.button.callback('❌ Отмена', 'edit_wallet')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Delete wallet confirmation error:', error);
      await ctx.reply('❌ Ошибка подтверждения удаления.');
    }
  }

  // Confirm wallet deletion
  async handleConfirmDeleteWallet(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      await walletService.deleteUserWallet(chatId);
      
      const message = `✅ **Кошелек успешно удален**\n\n` +
                     `🗑 Все данные кошелька удалены\n` +
                     `🔄 Вы можете создать новый кошелек`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Создать новый', 'create_wallet')],
        [Markup.button.callback('🔙 К личному кабинету', 'personal_cabinet')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Confirm delete wallet error:', error);
      await ctx.reply(`❌ Ошибка удаления: ${error.message}`);
    }
  }

  // Handle P2P menu
  async handleP2PMenu(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`🔄 Handling P2P menu callback for user ${chatId}`);
      
      // Clear any existing session when entering P2P menu
      this.clearUserSession(chatId);
      
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        const message = '⚠️ У вас нет кошелька.\n\n' +
                       '💡 Создайте кошелек в Личном кабинете для использования P2P функций.';
        
        // Remove the "Создать кошелек" button as it should only be in the personal cabinet
        const keyboard = Markup.inlineKeyboard([]);
        
        console.log(`📤 Sending wallet creation message to user ${chatId} (callback version)`);
        return await ctx.reply(message, keyboard);
      }
      
      // Get user reputation data
      const reputationService = require('../services/reputationService');
      const user = await User.findOne({ chatId });
      const reputation = await reputationService.getUserReputation(user._id);
      
      // Get user profile details for trading volume
      const profileDetails = await reputationService.getUserProfileDetails(user._id);
      const userLevel = this.getUserLevelDisplayNew(reputation.trustScore);
      
      // Prepare message text in the exact format requested
      // Adding extra spacing to ensure text width matches button width
      const message = `🔄 P2P БИРЖА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Рейтинг: ${reputation.trustScore}/1000 ${userLevel.emoji}\n` +
                     `Объем сделок: ${(profileDetails.totalTradeVolume || 0).toLocaleString('ru-RU')} ₽\n` +
                     `Завершенные сделки: ${reputation.completionRate}%\n` +
                     `Спорные сделки: ${reputation.disputeRate}%\n` +
                     `Всего сделок: ${reputation.totalTrades}\n\n` +
                     `⚡️ Быстро | 🔒 Безопасно | 📊 Прозрачно\n` +
                     `                         `;  // Extra spaces to match button width
      
      // Keyboard with buttons
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Купить CES', 'p2p_buy_ces'), Markup.button.callback('📉 Продать CES', 'p2p_sell_ces')],
        [Markup.button.callback('📊 Рынок ордеров', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордеры', 'p2p_my_orders')],
        [Markup.button.callback('🏆 Топ трейдеров', 'p2p_top_traders'), Markup.button.callback('🧮 Аналитика', 'p2p_analytics')]
      ]);
      
      console.log(`📤 Sending P2P menu text with buttons to user ${chatId}`);
      console.log(`📝 Message: ${message}`);
      console.log(`⌨ Keyboard: ${JSON.stringify(keyboard)}`);
      
      // Send text with buttons in one message
      await ctx.reply(message, keyboard);
      console.log(`✅ Text with buttons sent successfully to user ${chatId}`);
      
    } catch (error) {
      console.error('P2P menu error:', error);
      await ctx.reply('❌ Ошибка загрузки P2P меню. Попробуйте позже.');
    }
  }

  // Handle user profile
  async handleP2PMyProfile(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Get reputation data
      const reputationService = require('../services/reputationService');
      const profileDetails = await reputationService.getUserProfileDetails(user._id);
      
      // Create visual progress bar for trust score
      const progressBar = this.createProgressBar(profileDetails.trustScoreProgress, 100, 20);
      
      // Format member since date
      const memberSinceDate = profileDetails.memberSince ? 
        profileDetails.memberSince.toLocaleDateString('ru-RU') : 'Неизвестно';
      
      // Format trading limits
      const maxTradeAmount = profileDetails.tradingLimits.maxTradeAmount.toLocaleString('ru-RU');
      const dailyLimit = profileDetails.tradingLimits.dailyLimit.toLocaleString('ru-RU');
      const monthlyLimit = profileDetails.tradingLimits.monthlyLimit.toLocaleString('ru-RU');
      
      // Create achievements section
      let achievementsSection = '';
      if (profileDetails.achievements.length > 0) {
        achievementsSection = '\n🏆 *Достижения:*\n';
        profileDetails.achievements.forEach(achievement => {
          achievementsSection += `${achievement.emoji} **${achievement.name}** - ${achievement.description}\n`;
        });
      }
      
      // Create weekly activity section
      let activitySection = '\n📅 *Активность за неделю:*\n';
      const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      days.forEach(day => {
        const count = profileDetails.weeklyActivity[day] || 0;
        activitySection += `${day}: ${count} сделок\n`;
      });
      
      const message = `👤 **Профиль пользователя: @${profileDetails.username}**\n\n` +
                     `🌟 *Рейтинг пользователя: ${profileDetails.trustScore}/1000 (${profileDetails.userLevel.emoji} ${profileDetails.userLevel.name})*\n` +
                     `${progressBar} ${profileDetails.trustScoreProgress}%\n\n` +
                     `✅ Успешных сделок: ${profileDetails.successRate}% (${profileDetails.completedTrades}/${profileDetails.tradesLast30Days})\n` +
                     `⚖️ Спорные сделки: ${profileDetails.disputeRate}% (${Math.round(profileDetails.tradesLast30Days * profileDetails.disputeRate / 100)})\n` +
                     `⏱️ Среднее время ответа: ${profileDetails.avgResponseTime} мин\n` +
                     `💰 Объем торгов за 30 дней: ${profileDetails.totalTradeVolume.toLocaleString('ru-RU')} ₽\n` +
                     `📅 На платформе с: ${memberSinceDate}\n` +
                     `🏅 Верификация: ${profileDetails.verificationStatus}\n\n` +
                     `📊 *Торговые лимиты:*\n` +
                     `🔹 Макс. сделка: ${maxTradeAmount} ₽\n` +
                     `🔸 Суточный лимит: ${dailyLimit} ₽\n` +
                     `🔹 Месячный лимит: ${monthlyLimit} ₽\n` +
                     achievementsSection +
                     activitySection;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Profile error:', error);
      await ctx.reply('❌ Ошибка загрузки профиля. Попробуйте позже.');
    }
  }

  // Create visual progress bar
  createProgressBar(value, max, width) {
    const progress = Math.round((value / max) * width);
    const filled = '█'.repeat(progress);
    const empty = '░'.repeat(width - progress);
    return `[${filled}${empty}]`;
  }

  // Handle user profile view for other users
  async handleUserPublicProfile(ctx, targetUserId) {
    try {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Get reputation data
      const reputationService = require('../services/reputationService');
      const profileDetails = await reputationService.getUserProfileDetails(targetUser._id);
      
      // Create visual progress bar for trust score
      const progressBar = this.createProgressBar(profileDetails.trustScoreProgress, 100, 15);
      
      // Format member since date
      const memberSinceDate = profileDetails.memberSince ? 
        profileDetails.memberSince.toLocaleDateString('ru-RU') : 'Неизвестно';
      
      const message = `👤 **Профиль пользователя: @${profileDetails.username}**\n\n` +
                     `🌟 *Рейтинг: ${profileDetails.trustScore}/1000 (${profileDetails.userLevel.emoji} ${profileDetails.userLevel.name})*\n` +
                     `${progressBar} ${profileDetails.trustScoreProgress}%\n\n` +
                     `✅ Успешных сделок: ${profileDetails.successRate}%\n` +
                     `⚖️ Спорные сделки: ${profileDetails.disputeRate}%\n` +
                     `⏱️ Среднее время ответа: ${profileDetails.avgResponseTime} мин\n` +
                     `💰 Объем торгов за 30 дней: ${profileDetails.totalTradeVolume.toLocaleString('ru-RU')} ₽\n` +
                     `📅 На платформе с: ${memberSinceDate}\n` +
                     `🏅 Верификация: ${profileDetails.verificationStatus}\n\n` +
                     `*Выберите действие:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💬 Написать', `message_user_${targetUserId}`)],
        [Markup.button.callback('🔄 Создать ордер', `create_order_with_${targetUserId}`)],
        [Markup.button.callback('🔙 Назад', 'p2p_market_orders')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Public profile error:', error);
      await ctx.reply('❌ Ошибка загрузки профиля пользователя.');
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

  // Handle user profile display for P2P trading
  async handleP2PUserProfile(ctx, targetUserId) {
    try {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Get reputation data
      const reputationService = require('../services/reputationService');
      const profileDetails = await reputationService.getUserProfileDetails(targetUser._id);
      
      // Get user's recent trades count (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const userTrades = await P2PTrade.find({
        $or: [
          { buyerId: targetUser._id },
          { sellerId: targetUser._id }
        ],
        createdAt: { $gte: thirtyDaysAgo }
      });
      
      const completedTrades = userTrades.filter(trade => trade.status === 'completed').length;
      const totalTrades = userTrades.length;
      const completionRate = totalTrades > 0 ? (completedTrades / totalTrades * 100).toFixed(1) : '100.0';
      
      // Calculate average response time (simplified)
      const avgResponseTime = '5'; // Placeholder - in a real implementation this would be calculated
      
      const username = targetUser.username || targetUser.firstName || 'Пользователь';
      const userLevel = this.getUserLevelDisplayNew(profileDetails.trustScore);
      
      const message = `Условия мейкера:\n\n` +
                   `Сведения от транзакции:\n` +
                   `Имя продавца: @${username}\n` +
                   `Рейтинг: ${completedTrades}/1000 ${userLevel.emoji}\n` +
                   `Исполненные ордера за дней: ${completedTrades} Ордера\n` +
                   `Процент исполнения за 30 дней: ${completionRate}%\n` +
                   `Среднее время оплаты: ${avgResponseTime} мин.`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Введите сумму', `enter_amount_${targetUserId}`)],
        [Markup.button.callback('Назад', 'p2p_buy_orders')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('User profile error:', error);
      await ctx.reply('❌ Ошибка загрузки профиля пользователя.');
    }
  }

  // Refresh balance
  async handleRefreshBalance(ctx) {
    try {
      await this.handlePersonalCabinet(ctx);
    } catch (error) {
      // Handle "message not modified" error gracefully
      if (error.response && error.response.error_code === 400 && 
          error.response.description.includes('message is not modified')) {
        console.log('Ignoring "message not modified" error during refresh');
        // Message is already up to date, no need to show error
      } else {
        console.error('Refresh balance error:', error);
        await ctx.reply('❌ Ошибка обновления баланса. Попробуйте позже.');
      }
    }
  }

  // Handle CES token transfer initiation
  async handleSendCESTokens(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);

      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.reply('❌ У вас нет кошелька. Создайте его в Личном кабинете.');
      }

      if (walletInfo.cesBalance <= 0) {
        const message = '💰 ПЕРЕВОД CES\n' +
                       '➖➖➖➖➖➖➖➖➖➖➖\n' +
                       '⚠️ Недостаточно средств для перевода.\n' +
                       `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'transfer_menu')]
        ]);

        return await ctx.reply(message, keyboard);
      }

      const message = '💰 ПЕРЕВОД CES\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n' +
                     `Доступно: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                     '📝 Отправьте сообщение в формате:\n' +
                     'Адрес_кошелька Сумма\n\n' +
                     '📝 Пример:\n' +
                     '0x742d35Cc6734C0532925a3b8D4321F...89 10.5\n\n' +
                     '💡 Минимальная сумма: 0.001 CES';

      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingTransfer', true);
      this.setSessionData(chatId, 'transferType', 'CES');

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'transfer_menu')]
      ]);

      await ctx.reply(message, keyboard);

    } catch (error) {
      console.error('Error initiating CES transfer:', error);
      await ctx.reply('❌ Ошибка инициализации перевода. Попробуйте позже.');
    }
  }

  // Handle POL token transfer initiation
  async handleSendPOLTokens(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);

      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.reply('❌ У вас нет кошелька. Создайте его в Личном кабинете.');
      }

      if (walletInfo.polBalance <= 0.001) {
        const message = '💰 ПЕРЕВОД POL\n' +
                       '➖➖➖➖➖➖➖➖➖➖➖\n' +
                       '⚠️ Недостаточно средств для перевода.\n' +
                       `Ваш баланс: ${walletInfo.polBalance.toFixed(4)} POL\n\n` +
                       '💡 Минимум 0.001 POL нужно оставить для комиссии';

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'transfer_menu')]
        ]);

        return await ctx.reply(message, keyboard);
      }

      const maxTransfer = (walletInfo.polBalance - 0.001).toFixed(4);
      const message = '💰 ПЕРЕВОД POL\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n' +
                     `Доступно: ${maxTransfer} POL\n` +
                     `Всего: ${walletInfo.polBalance.toFixed(4)} POL\n\n` +
                     '📝 Отправьте сообщение в формате:\n' +
                     'Адрес_кошелька Сумма\n\n' +
                     '📝 Пример:\n' +
                     '0x742d35Cc6734C0532925a3b8D4321F...89 0.1\n\n' +
                     '💡 Минимальная сумма: 0.001 POL\n' +
                     '💡 0.001 POL останется для комиссии';

      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingTransfer', true);
      this.setSessionData(chatId, 'transferType', 'POL');

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'transfer_menu')]
      ]);

      await ctx.reply(message, keyboard);

    } catch (error) {
      console.error('Error initiating POL transfer:', error);
      await ctx.reply('❌ Ошибка инициализации перевода. Попробуйте позже.');
    }
  }

  // Handle transaction history
  async handleTransactionHistory(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const transactions = await walletService.getUserTransactions(chatId, 5);

      let message = '📊 ИСТОРИЯ\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n';

      if (transactions.length === 0) {
        message += '⚠️ Переводов пока не было\n\n' +
                  '💡 Начните отправлять CES токены другим пользователям !';
      } else {
        const user = await walletService.findUserByAddress(transactions[0].fromAddress) || 
                    await walletService.findUserByAddress(transactions[0].toAddress);

        transactions.forEach((tx, index) => {
          const isOutgoing = tx.fromUserId && tx.fromUserId.toString() === user._id.toString();
          const direction = isOutgoing ? '🟢 Исходящий' : '🔵 Входящий';
          const statusEmoji = tx.status === 'completed' ? '✅' : 
                             tx.status === 'pending' ? '⏳' : '❌';

          message += `${index + 1}. ${direction}\n`;
          message += `💰 ${tx.amount} ${tx.tokenType} ${statusEmoji}\n`;
          message += `📅 ${tx.createdAt.toLocaleString('ru-RU')}\n`;

          if (tx.txHash) {
            const shortHash = tx.txHash.substring(0, 10) + '...';
            message += `🔗 ${shortHash}\n`;
          }

          message += '\n';
        });
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'transfer_menu')]
      ]);

      await ctx.reply(message, keyboard);

    } catch (error) {
      console.error('Error showing transaction history:', error);
      await ctx.reply('❌ Ошибка загрузки истории. Попробуйте позже.');
    }
  }

  // Process transfer command from user message
  async processTransferCommand(ctx, transferData, tokenType = 'CES') {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Parse transfer data (address amount)
      const parts = transferData.trim().split(/\s+/);
      
      if (parts.length !== 2) {
        return await ctx.reply(`❌ Неверный формат. Используйте: \`адрес сумма\``, {
          parse_mode: 'Markdown'
        });
      }
      
      const [toAddress, amountStr] = parts;
      const amount = parseFloat(amountStr);
      
      if (isNaN(amount) || amount <= 0) {
        return await ctx.reply('❌ Неверная сумма. Укажите число больше 0.');
      }
      
      if (amount < 0.001) {
        return await ctx.reply(`❌ Минимальная сумма перевода: 0.001 ${tokenType}`);
      }
      
      // Show confirmation
      const recipient = await walletService.findUserByAddress(toAddress);
      const recipientInfo = recipient ? 
        `👤 Пользователь: @${recipient.username || recipient.firstName || 'Неизвестный'}` :
        '👤 Внешний кошелек';
      
      const message = `🔒 Подтверждение перевода
` +
                     `➖➖➖➖➖➖➖➖➖➖➖
` +
                     `Сумма: ${amount} ${tokenType}
` +
                     `Кому: ${toAddress}
` +
                     `${recipientInfo}

` +
                     '⚠️ Перевод нельзя отменить!';
      
      // Store transfer data in session to avoid callback data length limits
      this.setSessionData(chatId, 'pendingTransfer', {
        tokenType,
        toAddress,
        amount,
        timestamp: Date.now()
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', 'confirm_transfer')],
        [Markup.button.callback('❌ Отмена', 'transfer_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Error processing transfer command:', error);
      await ctx.reply('❌ Ошибка обработки команды перевода.');
    }
  }

  // Handle transfer confirmation
  async handleTransferConfirmation(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Get transfer data from session
      const pendingTransfer = this.getSessionData(chatId, 'pendingTransfer');
      
      if (!pendingTransfer || !pendingTransfer.tokenType || !pendingTransfer.toAddress || !pendingTransfer.amount) {
        throw new Error('Данные перевода не найдены. Попробуйте снова.');
      }
      
      // Check if transfer data is not too old (30 minutes)
      const transferAge = Date.now() - (pendingTransfer.timestamp || 0);
      if (transferAge > 30 * 60 * 1000) {
        this.setSessionData(chatId, 'pendingTransfer', null);
        throw new Error('Данные перевода устарели. Попробуйте снова.');
      }
      
      const { tokenType, toAddress, amount } = pendingTransfer;
      
      await ctx.reply('⏳ Обработка перевода... Подождите.');
      
      let result;
      if (tokenType === 'POL') {
        result = await walletService.sendPOLTokens(chatId, toAddress, amount);
      } else {
        result = await walletService.sendCESTokens(chatId, toAddress, amount);
      }
      
      // Clear pending transfer data
      this.setSessionData(chatId, 'pendingTransfer', null);
      
      if (result.success) {
        const message = `✅ Перевод успешен!
` +
                       `➖➖➖➖➖➖➖➖➖➖➖
` +
                       `Отправлено: ${amount} ${tokenType}
` +
                       `Кому: ${toAddress}
` +
                       `Hash: ${result.txHash}

` +
                       '⚠️ Транзакция подтверждена в блокчейне!';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback(`💸 Перевести еще ${tokenType}`, tokenType === 'POL' ? 'send_pol_tokens' : 'send_ces_tokens')],
          [Markup.button.callback('🔙 Назад', 'transfer_menu')]
        ]);
        
        await ctx.reply(message, keyboard);
      } else {
        // Handle case where result is not successful but no exception was thrown
        const errorMessage = '❌ Ошибка перевода\n\n' +
                            'ℹ️ Перевод не был выполнен. Попробуйте позже.';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'transfer_menu')]
        ]);
        
        await ctx.reply(errorMessage, keyboard);
      }
      
    } catch (error) {
      console.error('Transfer confirmation error:', error);
      
      const errorMessage = '❌ Ошибка перевода\n\n' +
                          `ℹ️ ${error.message}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'transfer_menu')]
      ]);
      
      await ctx.reply(errorMessage, keyboard);
    }
  }

  // Handle P2P Buy CES
  async handleP2PBuyCES(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `📈 ПОКУПКА CES ТОКЕНОВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество, цену, мин. и макс. сумму:\n` +
                     `➤ Формат: кол-во цена_за_токен мин_сумма макс_сумма\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)} 1 5\n\n` +
                     `Информация:\n` +
                     `➤ Минимальная сумма: 1 CES\n` +
                     `➤ Комиссия платформы: 1%`;
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P buy order session for ${chatId}`);
      this.setSessionData(chatId, 'awaitingP2POrder', true);
      this.setSessionData(chatId, 'p2pOrderType', 'buy');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P Buy CES error:', error);
      await ctx.reply('❌ Ошибка загрузки данных для покупки.');
    }
  }

  // Handle P2P Sell CES
  async handleP2PSellCES(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (walletInfo.cesBalance < 1) {
        const message = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `⚠️ Недостаточно CES для продажи\n` +
                       `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                       `Информация:\n` +
                       `➤ Минимальная сумма: 1 CES\n` +
                       `➤ Комиссия платформы: 1%\n\n` +
                       `💡 Пополните баланс CES`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество, цену, мин. и макс. сумму:\n` +
                     `➤ Формат: кол-во цена_за_токен мин_сумма макс_сумма\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)} 1 5\n\n` +
                     `Информация:\n` +
                     `➤ Минимальная сумма: 1 CES\n` +
                     `➤ Комиссия платформы: 1%`;
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P sell order session for ${chatId}`);
      this.setSessionData(chatId, 'awaitingP2POrder', true);
      this.setSessionData(chatId, 'p2pOrderType', 'sell');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P Sell CES error:', error);
      await ctx.reply('❌ Ошибка загрузки данных для продажи.');
    }
  }

  // Handle create order with user
  async handleCreateOrderWithUser(ctx, targetUserId) {
    try {
      const chatId = ctx.chat.id.toString();
      const targetUser = await User.findById(targetUserId);
      
      if (!targetUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      const username = targetUser.username || targetUser.firstName || 'Пользователь';
      
      const message = `📝 *Создание ордера с пользователем @${username}*\n\n` +
                     'Выберите тип ордера:';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Купить CES', `create_buy_order_with_${targetUserId}`)],
        [Markup.button.callback('📉 Продать CES', `create_sell_order_with_${targetUserId}`)],
        [Markup.button.callback('❌ Отмена', 'p2p_market_orders')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Create order with user error:', error);
      await ctx.reply('❌ Ошибка создания ордера с пользователем.');
    }
  }

  // Handle create buy order with user
  async handleCreateBuyOrderWithUser(ctx, targetUserId) {
    try {
      const chatId = ctx.chat.id.toString();
      const targetUser = await User.findById(targetUserId);
      
      if (!targetUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      const username = targetUser.username || targetUser.firstName || 'Пользователь';
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      // Store target user ID in session
      this.setSessionData(chatId, 'targetUserId', targetUserId);
      
      const message = `📈 *ПОКУПКА CES ТОКЕНОВ у @${username}*\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество, цену, мин. и макс. сумму:\n` +
                     `➤ Формат: кол-во цена_за_токен мин_сумма макс_сумма\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)} 1 5\n\n` +
                     `Информация:\n` +
                     `➤ Минимальная сумма: 1 CES\n` +
                     `➤ Комиссия платформы: 1%`;
      
      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingP2POrder', true);
      this.setSessionData(chatId, 'p2pOrderType', 'buy');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_market_orders')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Create buy order with user error:', error);
      await ctx.reply('❌ Ошибка создания ордера на покупку.');
    }
  }

  // Handle create sell order with user
  async handleCreateSellOrderWithUser(ctx, targetUserId) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      const targetUser = await User.findById(targetUserId);
      
      if (!targetUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.reply('❌ У вас нет кошелька. Создайте его в Личном кабинете.');
      }
      
      if (walletInfo.cesBalance < 1) {
        const message = `📉 *ПРОДАЖА CES ТОКЕНОВ пользователю @${targetUser.username || targetUser.firstName || 'Пользователь'}*\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `⚠️ Недостаточно CES для продажи\n` +
                       `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                       `Информация:\n` +
                       `➤ Минимальная сумма: 1 CES\n` +
                       `➤ Комиссия платформы: 1%\n\n` +
                       `💡 Пополните баланс CES`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'p2p_market_orders')]
        ]);
        
        return await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      const username = targetUser.username || targetUser.firstName || 'Пользователь';
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      // Store target user ID in session
      this.setSessionData(chatId, 'targetUserId', targetUserId);
      
      const message = `📉 *ПРОДАЖА CES ТОКЕНОВ пользователю @${username}*\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество, цену, мин. и макс. сумму:\n` +
                     `➤ Формат: кол-во цена_за_токен мин_сумма макс_сумма\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)} 1 5\n\n` +
                     `Информация:\n` +
                     `➤ Минимальная сумма: 1 CES\n` +
                     `➤ Комиссия платформы: 1%`;
      
      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingP2POrder', true);
      this.setSessionData(chatId, 'p2pOrderType', 'sell');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_market_orders')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Create sell order with user error:', error);
      await ctx.reply('❌ Ошибка создания ордера на продажу.');
    }
  }

  // Handle market orders display
  async handleP2PMarketOrders(ctx) {
    try {
      // Show selection menu for buy/sell orders
      const message = `📊 РЫНОК ОРДЕРОВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Выберите тип ордеров для просмотра:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Ордера на покупку', 'p2p_buy_orders')],
        [Markup.button.callback('📉 Ордера на продажу', 'p2p_sell_orders')],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);

      await ctx.reply(message, keyboard);

    } catch (error) {
      console.error('Market orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров.');
    }
  }

  // Handle buy orders display with pagination (each order in separate message)
  async handleP2PBuyOrders(ctx, page = 1) {
    try {
      const limit = 10; // Показываем по 10 ордеров на странице
      const offset = (page - 1) * limit;
      const result = await p2pService.getMarketOrders(limit, offset);
      
      if (result.sellOrders.length === 0) {
        const message = `📈 ОРДЕРА НА ПОКУПКУ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `⚠️ Активных ордеров на покупку пока нет\n\n` +
                       `💡 Создайте первый ордер на покупку!`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_market_orders')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // Отправляем заголовок
      let headerMessage = `📈 ОРДЕРА НА ПОКУПКУ\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖\n`;
      
      const totalPages = Math.ceil(result.sellOrdersCount / limit);
      if (totalPages > 1) {
        headerMessage += `Страница ${page} из ${totalPages}\n\n`;
      }
      
      // Пагинация в заголовке
      const headerButtons = [];
      if (totalPages > 1) {
        const paginationButtons = [];
        
        if (page > 1) {
          paginationButtons.push(Markup.button.callback('⬅️ Назад', `p2p_buy_orders_page_${page - 1}`));
        }
        
        paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_buy_orders'));
        
        if (page < totalPages) {
          paginationButtons.push(Markup.button.callback('Вперед ➡️', `p2p_buy_orders_page_${page + 1}`));
        }
        
        headerButtons.push(paginationButtons);
      }
      
      headerButtons.push([Markup.button.callback('🔙 Назад', 'p2p_market_orders')]);
      const headerKeyboard = Markup.inlineKeyboard(headerButtons);
      
      await ctx.reply(headerMessage, headerKeyboard);
      
      // Отправляем каждый ордер отдельным сообщением
      const reputationService = require('../services/reputationService');
      
      for (let i = 0; i < result.sellOrders.length; i++) {
        const order = result.sellOrders[i];
        const username = order.userId.username || order.userId.firstName || 'Пользователь';
        
        // Get standardized user statistics
        const stats = await reputationService.getStandardizedUserStats(order.userId._id);
        
        // Calculate limits in rubles based on price and amounts
        const minAmount = order.minTradeAmount || 1;
        const maxAmount = order.maxTradeAmount || order.remainingAmount;
        const minRubles = (minAmount * order.pricePerToken).toFixed(2);
        const maxRubles = (maxAmount * order.pricePerToken).toFixed(2);
        
        const orderMessage = `₽ ${order.pricePerToken.toFixed(2)} / CES | @${username} ${stats.rating}\n` +
                           `Количество: ${order.remainingAmount.toFixed(2)} CES\n` +
                           `Лимиты: ${minRubles} - ${maxRubles} ₽`;
        
        const orderKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🟩 Купить', `buy_details_${order.userId._id}_${order._id}`)]
        ]);
        
        await ctx.reply(orderMessage, orderKeyboard);
        
        // Небольшая пауза между сообщениями чтобы не спамить
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error('Buy orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров на покупку.');
    }
  }

  // Handle sell orders display with pagination (each order in separate message)
  async handleP2PSellOrders(ctx, page = 1) {
    try {
      const limit = 10; // Показываем по 10 ордеров на странице
      const offset = (page - 1) * limit;
      const result = await p2pService.getMarketOrders(limit, offset);
      
      if (result.buyOrders.length === 0) {
        const message = `📉 ОРДЕРА НА ПРОДАЖУ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `⚠️ Активных ордеров на продажу пока нет\n\n` +
                       `💡 Создайте первый ордер на продажу!`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'p2p_market_orders')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // Отправляем заголовок
      let headerMessage = `📉 ОРДЕРА НА ПРОДАЖУ\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖\n`;
      
      const totalPages = Math.ceil(result.buyOrdersCount / limit);
      if (totalPages > 1) {
        headerMessage += `Страница ${page} из ${totalPages}\n\n`;
      }
      
      // Пагинация в заголовке
      const headerButtons = [];
      if (totalPages > 1) {
        const paginationButtons = [];
        
        if (page > 1) {
          paginationButtons.push(Markup.button.callback('⬅️ Назад', `p2p_sell_orders_page_${page - 1}`));
        }
        
        paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'p2p_sell_orders'));
        
        if (page < totalPages) {
          paginationButtons.push(Markup.button.callback('Вперед ➡️', `p2p_sell_orders_page_${page + 1}`));
        }
        
        headerButtons.push(paginationButtons);
      }
      
      headerButtons.push([Markup.button.callback('🔙 Назад', 'p2p_market_orders')]);
      const headerKeyboard = Markup.inlineKeyboard(headerButtons);
      
      await ctx.reply(headerMessage, headerKeyboard);
      
      // Отправляем каждый ордер отдельным сообщением
      const reputationService = require('../services/reputationService');
      
      for (let i = 0; i < result.buyOrders.length; i++) {
        const order = result.buyOrders[i];
        const username = order.userId.username || order.userId.firstName || 'Пользователь';
        
        // Get standardized user statistics
        const stats = await reputationService.getStandardizedUserStats(order.userId._id);
        
        // Calculate limits in rubles based on price and amounts
        const minAmount = order.minTradeAmount || 1;
        const maxAmount = order.maxTradeAmount || order.remainingAmount;
        const minRubles = (minAmount * order.pricePerToken).toFixed(2);
        const maxRubles = (maxAmount * order.pricePerToken).toFixed(2);
        
        const orderMessage = `₽ ${order.pricePerToken.toFixed(2)} / CES @${username} ${stats.rating}\n` +
                           `Количество: ${order.remainingAmount.toFixed(2)} CES\n` +
                           `Лимиты: ${minRubles} - ${maxRubles} ₽`;
        
        const orderKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🟥 Продать', `sell_details_${order.userId._id}_${order._id}`)]
        ]);
        
        await ctx.reply(orderMessage, orderKeyboard);
        
        // Небольшая пауза между сообщениями чтобы не спамить
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error('Sell orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров на продажу.');
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

  // Get user level display for market orders (new format)
  getUserLevelDisplayNew(trustScore) {
    if (trustScore >= 1000) return { emoji: '🐋' };
    if (trustScore >= 500) return { emoji: '🐺' };
    if (trustScore >= 200) return { emoji: '🦅' };
    if (trustScore >= 50) return { emoji: '🐿️' };
    return { emoji: '🐹' }; // For 0-49 trust score
  }

  // Handle buy order details display
  async handleBuyOrderDetails(ctx, userId, orderId) {
    try {
      const reputationService = require('../services/reputationService');
      const { User } = require('../database/models');
      
      const user = await User.findById(userId);
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Get standardized user statistics
      const stats = await reputationService.getStandardizedUserStats(userId);
      
      const message = `Рейтинг: ${stats.rating}\n` +
                     `Исполненные ордера за 30 дней: ${stats.ordersLast30Days} ордера\n` +
                     `Процент исполнения за 30 дней: ${stats.completionRateLast30Days}%\n` +
                     `Среднее время перевода: ${stats.avgTransferTime} мин.`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_buy_orders')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Buy order details error:', error);
      await ctx.reply('❌ Ошибка загрузки данных.');
    }
  }

  // Handle sell order details display
  async handleSellOrderDetails(ctx, userId, orderId) {
    try {
      const reputationService = require('../services/reputationService');
      const { User } = require('../database/models');
      
      const user = await User.findById(userId);
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Get standardized user statistics
      const stats = await reputationService.getStandardizedUserStats(userId);
      
      const message = `Рейтинг: ${stats.rating}\n` +
                     `Исполненные ордера за 30 дней: ${stats.ordersLast30Days} ордера\n` +
                     `Процент исполнения за 30 дней: ${stats.completionRateLast30Days}%\n` +
                     `Среднее время оплаты: ${stats.avgPaymentTime} мин.`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_sell_orders')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Sell order details error:', error);
      await ctx.reply('❌ Ошибка загрузки данных.');
    }
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
          const userLevel = this.getUserLevelDisplayNew(trader.trustScore);
          const username = trader.username || trader.firstName || 'Пользователь';
          
          message += `${index + 1}. @${username} ${userLevel.emoji}\n` +
                    `📊 Рейтинг: ${trader.trustScore}/1000\n` +
                    `💰 Объем: ${(trader.totalTradeVolume || 0).toLocaleString('ru-RU')} ₽\n\n`;
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

  // Handle user's orders
  async handleP2PMyOrders(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const orders = await p2pService.getUserOrders(chatId, 10);
      
      let message = `📋 МОИ ОРДЕРА\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n`;
      
      const keyboardButtons = [];
      
      if (orders.length === 0) {
        message += `⚠️ У вас пока нет активных ордеров\n\n` +
                  `💡 Создайте ордер на покупку или продажу CES !`;
      } else {
        // Display orders if any exist
        orders.forEach((order, index) => {
          const orderType = order.type === 'buy' ? '📈 Покупка' : '📉 Продажа';
          const status = order.status === 'active' ? 'Активен' : 
                        order.status === 'partial' ? 'Частично исполнен' : 
                        order.status === 'completed' ? 'Исполнен' : 'Отменен';
          
          message += `${index + 1}. ${orderType}\n` +
                    `${order.amount.toFixed(2)} CES по ₽ ${order.pricePerToken.toFixed(2)}\n` +
                    `Статус: ${status}\n` +
                    `${order.createdAt.toLocaleString('ru-RU')}\n`;
          
          // Add cancel button for active and partial orders
          if (order.status === 'active' || order.status === 'partial') {
            message += `ID: ${order._id}\n`;
            keyboardButtons.push([Markup.button.callback(`❌ Отменить ордер #${order._id.toString().substr(0, 6)}`, `cancel_order_${order._id}`)]);
          }
          
          message += `\n`;
        });
      }
      
      // Add back button
      keyboardButtons.push([Markup.button.callback('🔙 Назад', 'p2p_menu')]);
      
      const keyboard = Markup.inlineKeyboard(keyboardButtons);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('My orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров.');
    }
  }

  // Process P2P order from user message
  async processP2POrder(ctx, orderData, orderType) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Parse order data (amount pricePerToken minAmount maxAmount)
      const parts = orderData.trim().split(/\s+/);
      
      if (parts.length < 2 || parts.length > 4) {
        return await ctx.reply(`⚠️ Неверный формат. \n💡 Используйте: количество цена_за_токен [мин_сумма макс_сумма]\n\nПример: 10 250.50 или 10 250.50 1 5`, {
          parse_mode: 'Markdown'
        });
      }
      
      const [amountStr, priceStr, minAmountStr, maxAmountStr] = parts;
      
      // Normalize decimal separators (replace comma with dot)
      const normalizedAmountStr = amountStr.replace(',', '.');
      const normalizedPriceStr = priceStr.replace(',', '.');
      const normalizedMinAmountStr = minAmountStr ? minAmountStr.replace(',', '.') : null;
      const normalizedMaxAmountStr = maxAmountStr ? maxAmountStr.replace(',', '.') : null;
      
      const amount = parseFloat(normalizedAmountStr);
      const pricePerToken = parseFloat(normalizedPriceStr);
      const minAmount = normalizedMinAmountStr ? parseFloat(normalizedMinAmountStr) : 1;
      const maxAmount = normalizedMaxAmountStr ? parseFloat(normalizedMaxAmountStr) : amount;
      
      if (isNaN(amount) || amount <= 0 || isNaN(pricePerToken) || pricePerToken <= 0) {
        return await ctx.reply('❌ Неверные значения. Укажите положительные числа.\n\n**Пример:** `10 250.50` или `10 250,50`', {
          parse_mode: 'Markdown'
        });
      }
      
      if (isNaN(minAmount) || minAmount <= 0 || isNaN(maxAmount) || maxAmount <= 0) {
        return await ctx.reply('❌ Неверные значения для мин/макс суммы. Укажите положительные числа.', {
          parse_mode: 'Markdown'
        });
      }
      
      if (minAmount > maxAmount) {
        return await ctx.reply('❌ Минимальная сумма не может быть больше максимальной.', {
          parse_mode: 'Markdown'
        });
      }
      
      if (amount < 1) {
        console.log(`❌ Amount too small: ${amount}`);
        return await ctx.reply('❌ Минимальное количество: 1 CES');
      }
      
      if (minAmount > amount) {
        return await ctx.reply('❌ Минимальная сумма не может быть больше общего количества.', {
          parse_mode: 'Markdown'
        });
      }
      
      const totalValue = amount * pricePerToken;
      const commission = totalValue * 0.01;
      
      console.log(`💰 Processing P2P order: ${amount} CES at ₽${pricePerToken} (total: ₽${totalValue.toFixed(2)}, commission: ₽${commission.toFixed(2)})`);
      
      // Check if this is a direct order with a specific user
      const targetUserId = this.getSessionData(chatId, 'targetUserId');
      
      // Show confirmation
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'покупку' : 'продажу';
      
      let message = `${typeEmoji} Подтверждение ордера на ${typeText}\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Количество: ${amount} CES\n` +
                   `Цена за токен: ₽${pricePerToken.toFixed(2)}\n` +
                   `Общая сумма: ₽${totalValue.toFixed(2)}\n` +
                   `Мин. сумма: ${minAmount} CES\n` +
                   `Макс. сумма: ${maxAmount} CES\n` +
                   `Комиссия: ₽${commission.toFixed(2)} (1%)\n\n` +
                   `🛡️ Безопасность:\n` +
                   `Все сделки защищены эскроу-системой\n\n` +
                   `⚠️ Подтвердить создание ордера?`;
      
      // Add target user info if this is a direct order
      if (targetUserId) {
        const targetUser = await User.findById(targetUserId);
        if (targetUser) {
          const username = targetUser.username || targetUser.firstName || 'Пользователь';
          message = `${typeEmoji} Подтверждение ордера на ${typeText} у @${username}\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Количество: ${amount} CES\n` +
                   `Цена за токен: ₽${pricePerToken.toFixed(2)}\n` +
                   `Общая сумма: ₽${totalValue.toFixed(2)}\n` +
                   `Мин. сумма: ${minAmount} CES\n` +
                   `Макс. сумма: ${maxAmount} CES\n` +
                   `Комиссия: ₽${commission.toFixed(2)} (1%)\n\n` +
                   `🛡️ Безопасность:\n` +
                   `Все сделки защищены эскроу-системой\n\n` +
                   `⚠️ Подтвердить создание ордера?`;
        }
      }
      
      // Store P2P order data in session to avoid callback data length limits
      this.setSessionData(chatId, 'pendingP2POrder', {
        orderType,
        amount,
        pricePerToken,
        minAmount,
        maxAmount,
        targetUserId,
        timestamp: Date.now()
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', 'confirm_p2p_order')],
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      console.log(`✅ Sending P2P order confirmation to user`);
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Error processing P2P order:', error);
      await ctx.reply('❌ Ошибка обработки ордера. Попробуйте снова.');
    }
  }

  // Handle P2P order confirmation
  async handleP2POrderConfirmation(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`🔄 Processing P2P order confirmation for user ${chatId}`);
      
      // Get P2P order data from session
      const pendingOrder = this.getSessionData(chatId, 'pendingP2POrder');
      
      if (!pendingOrder || !pendingOrder.orderType || !pendingOrder.amount || !pendingOrder.pricePerToken) {
        throw new Error('Данные ордера не найдены. Попробуйте снова.');
      }
      
      // Check if order data is not too old (30 minutes)
      const orderAge = Date.now() - (pendingOrder.timestamp || 0);
      if (orderAge > 30 * 60 * 1000) {
        this.setSessionData(chatId, 'pendingP2POrder', null);
        throw new Error('Данные ордера устарели. Попробуйте снова.');
      }
      
      const { orderType, amount, pricePerToken, minAmount, maxAmount, targetUserId } = pendingOrder;
      
      console.log(`📊 Order details: type=${orderType}, amount=${amount}, price=${pricePerToken}, min=${minAmount}, max=${maxAmount}, chatId=${chatId}, targetUserId=${targetUserId}`);
      
      await ctx.reply('⏳ Создание ордера... Подождите.');
      
      let result;
      if (orderType === 'buy') {
        console.log(`📈 Creating buy order...`);
        result = await p2pService.createBuyOrder(chatId, amount, pricePerToken, minAmount, maxAmount);
      } else {
        console.log(`📉 Creating sell order...`);
        result = await p2pService.createSellOrder(chatId, amount, pricePerToken, ['bank_transfer'], minAmount, maxAmount);
      }
      
      console.log(`✅ Order created successfully: ${result._id}`);
      
      // Clear pending order data
      this.setSessionData(chatId, 'pendingP2POrder', null);
      
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'покупку' : 'продажу';
      const totalValue = amount * pricePerToken;
      
      let message = `${typeEmoji} Ордер на ${typeText} создан!\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Количество: ${amount} CES\n` +
                   `Цена за токен: ₽${pricePerToken.toFixed(2)}\n` +
                   `Общая сумма: ₽${totalValue.toFixed(2)}\n` +
                   `Мин. сумма: ${minAmount} CES\n` +
                   `Макс. сумма: ${maxAmount} CES\n\n` +
                   `🛡️ Безопасность:\n` +
                   `Все сделки защищены эскроу-системой`;
      
      // Add target user info if this is a direct order
      if (targetUserId) {
        const targetUser = await User.findById(targetUserId);
        if (targetUser) {
          const username = targetUser.username || targetUser.firstName || 'Пользователь';
          message = `${typeEmoji} Ордер на ${typeText} у @${username} создан!\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Количество: ${amount} CES\n` +
                   `Цена за токен: ₽${pricePerToken.toFixed(2)}\n` +
                   `Общая сумма: ₽${totalValue.toFixed(2)}\n` +
                   `Мин. сумма: ${minAmount} CES\n` +
                   `Макс. сумма: ${maxAmount} CES\n\n` +
                   `🛡️ Безопасность:\n` +
                   `Все сделки защищены эскроу-системой`;
        }
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('P2P order confirmation error:', error);
      
      // Sanitize error message to avoid Markdown parsing issues
      const sanitizedMessage = error.message.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
      const errorMessage = `❌ Ошибка создания ордера\n\nℹ️ ${sanitizedMessage}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(errorMessage, keyboard);
    }
  }

  // Handle P2P Analytics
  async handleP2PAnalytics(ctx) {
    try {
      // In a real implementation, you would fetch actual analytics data
      // For now, we'll use placeholder data as shown in the example
      
      const message = `🧮 АНАЛИТИКА \n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `1. Статистика за 24 часа:\n` +
                     `Объем торгов: ₽ 0\n` +
                     `Завершенные сделки: 0\n` +
                     `Уровень завершения: 0%\n` +
                     `Активные трейдеры: 0\n\n` +
                     `2. Статистика за 30 дней:\n` +
                     `Объем торгов: ₽ 0\n` +
                     `Завершенные сделки: 0\n` +
                     `Уровень завершения: 0%\n` +
                     `Активные трейдеры: 0`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Analytics error:', error);
      await ctx.reply('❌ Ошибка загрузки аналитики.');
    }
  }

  // Handle user messaging
  async handleUserMessaging(ctx, targetUserId) {
    try {
      // Set session state to capture next message
      const chatId = ctx.chat.id.toString();
      this.setSessionData(chatId, 'awaitingUserMessage', true);
      this.setSessionData(chatId, 'targetUserId', targetUserId);
      
      const targetUser = await User.findById(targetUserId);
      const username = targetUser?.username || targetUser?.firstName || 'Пользователь';
      
      const message = `📝 *Отправка сообщения пользователю @${username}*\n\n` +
                     'Введите ваше сообщение ниже:\n' +
                     'ℹ️ Сообщение будет отправлено напрямую пользователю';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_market_orders')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('User messaging error:', error);
      await ctx.reply('❌ Ошибка инициализации сообщения пользователю.');
    }
  }

  // Process user message
  async processUserMessage(ctx, messageText) {
    try {
      const chatId = ctx.chat.id.toString();
      const targetUserId = this.getSessionData(chatId, 'targetUserId');
      
      // Clear session
      this.clearUserSession(chatId);
      
      if (!targetUserId) {
        return await ctx.reply('❌ Не удалось определить получателя сообщения.');
      }
      
      const senderUser = await User.findOne({ chatId });
      const targetUser = await User.findById(targetUserId);
      
      if (!senderUser || !targetUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // In a real implementation, you would send the message to the target user
      // For now, we'll just show a confirmation
      
      const senderUsername = senderUser.username || senderUser.firstName || 'Пользователь';
      const targetUsername = targetUser.username || targetUser.firstName || 'Пользователь';
      
      const confirmationMessage = `✅ *Сообщение отправлено пользователю @${targetUsername}*\n\n` +
                                `Ваше сообщение: "${messageText}"\n\n` +
                                `ℹ️ В реальной реализации сообщение было бы доставлено пользователю`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к ордерам', 'p2p_market_orders')]
      ]);
      
      await ctx.reply(confirmationMessage, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Process user message error:', error);
      await ctx.reply('❌ Ошибка отправки сообщения.');
    }
  }

  // Handle order cancellation
  async handleCancelOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Show confirmation message
      const message = `⚠️ *Подтверждение отмены ордера*\n\n` +
                     `Вы уверены, что хотите отменить ордер #${orderId.toString().substr(0, 6)}?\n\n` +
                     `ℹ️ Отмененные ордера нельзя восстановить`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, отменить', `confirm_cancel_order_${orderId}`)],
        [Markup.button.callback('❌ Нет, вернуться', 'p2p_my_orders')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Cancel order error:', error);
      await ctx.reply('❌ Ошибка при отмене ордера.');
    }
  }

  // Handle order cancellation confirmation
  async handleConfirmCancelOrder(ctx, orderId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      await ctx.reply('⏳ Отмена ордера... Подождите.');
      
      // Call the service to cancel the order
      const result = await p2pService.cancelOrder(chatId, orderId);
      
      const message = `✅ *Ордер отменен*\n\n` +
                     `Ордер #${orderId.toString().substr(0, 6)} успешно отменен\n\n` +
                     `ℹ️ Все заблокированные средства возвращены`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('🔄 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Confirm cancel order error:', error);
      
      const errorMessage = `❌ *Ошибка отмены ордера*\n\n` +
                          `ℹ️ ${error.message || 'Не удалось отменить ордер'}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('🔄 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(errorMessage, { parse_mode: 'Markdown', ...keyboard });
    }
  }

  // Handle enter amount for P2P trading
  async handleEnterAmount(ctx, targetUserId) {
    try {
      const chatId = ctx.chat.id.toString();
      const targetUser = await User.findById(targetUserId);
      
      if (!targetUser) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      const username = targetUser.username || targetUser.firstName || 'Пользователь';
      
      const message = `💸 ПОКУПКА CES у @${username}\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Введите сумму для покупки:\n\n` +
                     `📝 Отправьте сообщение в формате:\n` +
                     `Количество Цена_за_токен\n\n` +
                     `📝 Пример:\n` +
                     `10 250.50`;
      
      // Store target user ID in session for P2P trade
      this.setSessionData(chatId, 'awaitingP2POrder', true);
      this.setSessionData(chatId, 'p2pOrderType', 'buy');
      this.setSessionData(chatId, 'targetUserId', targetUserId);
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_buy_orders')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Enter amount error:', error);
      await ctx.reply('❌ Ошибка ввода суммы.');
    }
  }
}

module.exports = new MessageHandler();