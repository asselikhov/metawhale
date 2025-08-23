/**
 * Message Handlers
 * Handles all Telegram bot message and callback processing
 */

const { Markup } = require('telegraf');
const priceService = require('../services/priceService');
const walletService = require('../services/walletService');
const p2pService = require('../services/p2pService');
const { User, PriceHistory } = require('../database/models');

// Simple session storage for user states
const userSessions = new Map();

class MessageHandler {
  // Get or create user session
  getUserSession(chatId) {
    if (!userSessions.has(chatId)) {
      userSessions.set(chatId, {});
    }
    return userSessions.get(chatId);
  }

  // Clear user session
  clearUserSession(chatId) {
    userSessions.delete(chatId);
  }

  // Set session data
  setSessionData(chatId, key, value) {
    const session = this.getUserSession(chatId);
    session[key] = value;
  }

  // Get session data
  getSessionData(chatId, key) {
    const session = this.getUserSession(chatId);
    return session[key];
  }
  // Handle /start command
  async handleStart(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Register or update user in database
      const user = await User.findOneAndUpdate(
        { chatId },
        {
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          isActive: true
        },
        { upsert: true, new: true }
      );
      
      const welcomeMessage = 'Добро пожаловать в Rustling Grass 🌾 assistant !';
      
      // Main menu with regular keyboard buttons (only 2 buttons as requested)
      const mainMenu = Markup.keyboard([
        ['👤 Личный кабинет', '🔄 P2P']
      ]).resize();
      
      await ctx.reply(welcomeMessage, mainMenu);
      
    } catch (error) {
      console.error('Start command error:', error);
      await ctx.reply('Произошла ошибка при запуске. Попробуйте еще раз.');
    }
  }

  // Handle price command and button
  async handlePrice(ctx) {
    try {
      const priceData = await priceService.getCESPrice();
      
      // Save data to database (only when calling /price)
      if (!priceData.cached) {
        await new PriceHistory(priceData).save();
        console.log(`💾 Price data saved: $${priceData.price.toFixed(2)} | ATH: $${priceData.ath.toFixed(2)}`);
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
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(1)}% • 🅥 $ ${priceService.formatNumber(priceData.volume24h).replace(/(\d+\.\d)0*K/, '$1K')} • 🅐��� ${athDisplay}`;
      
      // Send text message for maximum speed
      await ctx.reply(message);
      
    } catch (error) {
      console.error('Error sending price to user:', error);
      await ctx.reply('❌ Не удается получить цену CES в данный момент. Попробуйте позже.');
    }
  }

  // Handle text messages from regular keyboard buttons
  async handleTextMessage(ctx) {
    try {
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
        return await this.handlePersonalCabinetText(ctx);
      }
      
      if (text.includes('P2P')) {
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
      await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
    }
  }

  // Handle Personal Cabinet from text message
  async handlePersonalCabinetText(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo) {
        return await ctx.reply('❌ Пользователь не найден. Выполните /start');
      }
      
      // Header as requested
      let message = '👤 ЛИЧНЫЙ КАБИНЕТ\n\n';
      
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
        message += '⚠️ Кошелек не создан\n\n';
        message += '💡 Создайте кошелек для хранения токенов CES и POL';
      
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

  // Handle user profile
  async handleUserProfile(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo) {
        return await ctx.reply('❌ Пользователь не найден. Выполните /start');
      }
      
      let message = 'Личный кабинет\n\n';
      
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
        message += `Баланс POL: ${walletInfo.polBalance.toFixed(4)} • $ ${polTotalUsd} • ₽ ${polTotalRub}`;
        
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
      const message = '💳 КОШЕЛЕК\n\n' +
                     `Адрес: \n\`${walletInfo.address}\`\n\n` +
                     `Приватный ключ: \`${privateKey}\`\n\n` +
                     `⚠️ Важно:\n` +
                     `Сохраните эту информацию в безопасном месте\n` +
                     `Никому не передавайте приватный ключ\n` +
                     `Используйте для импорта в другие кошельки`;
      
      // Simplified keyboard with only back button
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'personal_cabinet')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Wallet details error:', error);
      await ctx.reply('❌ Ошибка загрузки данных кошелька.');
    }
  }

  // Handle transfer menu
  async handleTransferMenu(ctx) {
    try {
      const message = '💸 ПЕРЕВОД';
      
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
        const message = '⚠️У вас нет кошелька.\n\n' +
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
      
      // Prepare message text
      const message = `Рейтинг: ${reputation.trustScore}/1000 ${userLevel.emoji}\n` +
                     `Объем сделок: ${(profileDetails.totalTradeVolume || 0).toLocaleString('ru-RU')} ₽\n` +
                     `Завершенные сделки: ${reputation.completionRate}%\n` +
                     `Спорные сделки: ${reputation.disputeRate}%\n` +
                     `Всего сделок: ${reputation.totalTrades}`;
      
      // Keyboard with buttons
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Купить CES', 'p2p_buy_ces'), Markup.button.callback('📉 Продать CES', 'p2p_sell_ces')],
        [Markup.button.callback('📊 Рынок ордеров', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
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
        [Markup.button.callback('🔄 Обновить', 'p2p_my_profile')],
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
      // Fallback: send new message if editing fails
      try {
        const mainMenu = Markup.keyboard([
          ['👤 Личный кабинет', '🔄 P2P']
        ]).resize();
        
        await ctx.reply('🌾 Главное меню', mainMenu);
      } catch (fallbackError) {
        console.error('Fallback menu error:', fallbackError);
        await ctx.reply('❌ Ошибка загрузки главного меню');
      }
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
        const message = 'ПЕРЕВОД CES\n\n' +
                       '⚠️ Недостаточно средств для перевода.\n' +
                       `Ваш баланс: **${walletInfo.cesBalance.toFixed(4)} CES**`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'transfer_menu')]
        ]);
        
        return await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      const message = 'ПЕРЕВОД CES\n\n' +
                     `Доступно: **${walletInfo.cesBalance.toFixed(4)} CES**\n\n` +
                     '📝 Отправьте сообщение в формате:\n' +
                     '`Адрес_кошелька Сумма`\n\n' +
                     '📝 **Пример:**\n' +
                     '`0x742d35Cc6734C0532925a3b8D4321F...89 10.5`\n\n' +
                     'ℹ️ Минимальная сумма: 0.001 CES';
      
      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingTransfer', true);
      this.setSessionData(chatId, 'transferType', 'CES');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'transfer_menu')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
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
        const message = 'ПЕРЕВОД POL\n\n' +
                       '⚠️ Недостаточно средств для перевода.\n' +
                       `Ваш баланс: **${walletInfo.polBalance.toFixed(4)} POL**\n\n` +
                       '💡 Минимум 0.001 POL нужно оставить для комиссии';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'transfer_menu')]
        ]);
        
        return await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      const maxTransfer = (walletInfo.polBalance - 0.001).toFixed(4);
      const message = 'ПЕРЕВОД POL\n\n' +
                     `Доступно: **${maxTransfer} POL**\n` +
                     `Всего: **${walletInfo.polBalance.toFixed(4)} POL**\n\n` +
                     '📝 Отправьте сообщениеение в формате:\n' +
                     '`Адрес_кошелька Сумма`\n\n' +
                     '📝 **Пример:**\n' +
                     '`0x742d35Cc6734C0532925a3b8D4321F...89 0.1`\n\n' +
                     '💡 Минимальная сумма: 0.001 POL\n' +
                     '⚠️ 0.001 POL останется для комиссии';
      
      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingTransfer', true);
      this.setSessionData(chatId, 'transferType', 'POL');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'transfer_menu')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
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
      
      let message = '📊 **ИСТОРИЯ**\n\n';
      
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
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
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
      
      const tokenEmoji = tokenType === 'POL' ? '💎' : '💰';
      const message = `${tokenEmoji} **Подтверждение перевода**\n\n` +
                     `${tokenEmoji} Сумма: **${amount} ${tokenType}**\n` +
                     `📫 Кому: \`${toAddress}\`\n` +
                     `${recipientInfo}\n\n` +
                     '❗ Перевод нельзя отменить!';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', `confirm_transfer_${tokenType}_${toAddress}_${amount}`)],
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Error processing transfer command:', error);
      await ctx.reply('❌ Ошибка обработки команды перевода.');
    }
  }

  // Handle transfer confirmation
  async handleTransferConfirmation(ctx, transferParams) {
    try {
      const parts = transferParams.split('_');
      if (parts.length < 4) {
        throw new Error('Invalid transfer parameters');
      }
      
      const [, , tokenType, toAddress, amountStr] = parts;
      const amount = parseFloat(amountStr);
      const chatId = ctx.chat.id.toString();
      
      await ctx.reply('⏳ Обработка перевода... Подождите.');
      
      let result;
      if (tokenType === 'POL') {
        result = await walletService.sendPOLTokens(chatId, toAddress, amount);
      } else {
        result = await walletService.sendCESTokens(chatId, toAddress, amount);
      }
      
      if (result.success) {
        const tokenEmoji = tokenType === 'POL' ? '💎' : '💰';
        const message = `✅ **Перевод успешен!**\n\n` +
                       `${tokenEmoji} Отправлено: **${amount} ${tokenType}**\n` +
                       `📫 Кому: \`${toAddress}\`\n` +
                       `🔗 Hash: \`${result.txHash}\`\n\n` +
                       '🔍 Транзакция подтверждена в блокчейне!';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback(`💸 Перевести еще ${tokenType}`, tokenType === 'POL' ? 'send_pol_tokens' : 'send_ces_tokens')],
          [Markup.button.callback('🔙 Назад', 'transfer_menu')]
        ]);
        
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
    } catch (error) {
      console.error('Transfer confirmation error:', error);
      
      const errorMessage = '❌ **Ошибка перевода**\n\n' +
                          `ℹ️ ${error.message}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'transfer_menu')]
      ]);
      
      await ctx.reply(errorMessage, { parse_mode: 'Markdown', ...keyboard });
    }
  }

  // Handle P2P Buy CES
  async handleP2PBuyCES(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `📈 ПОКУПКА CES ТОКЕНОВ\n\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество и цену:\n` +
                     `➤ Формат: кол-во цена_за_токен\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)}\n\n` +
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
      
      if (walletInfo.cesBalance <= 0) {
        const message = `📉 ПРОДАЖА CES ТОКЕНОВ\n\n` +
                       `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n` +
                       `❌ Недостаточно CES для продажи\n\n` +
                       `💡Пополните баланс CES`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Обновить баланс', 'refresh_balance')],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `.DataGridViewColumn ПРОДАЖА CES ТОКЕНОВ\n\n` +
                     `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                     `Текущая рыночная цена:\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `Введите количество и цену:\n` +
                     `➤ Формат: кол-во цена_за_токен\n` +
                     `➤ Пример: 10 ${priceData.suggestedPrice.toFixed(2)}\n\n` +
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

  // Handle market orders display
  async handleP2PMarketOrders(ctx) {
    try {
      const orders = await p2pService.getMarketOrders(10);
      
      let message = `📊 РЫНОК ОРДЕРОВ\n\n`;
      
      if (orders.buyOrders.length > 0) {
        message += `📈 Заявки на покупку:\n`;
        orders.buyOrders.slice(0, 5).forEach((order, index) => {
          const username = order.userId.username || order.userId.firstName || 'Пользователь';
          const trustScore = order.userId.trustScore || 0;
          const userLevel = this.getUserLevelDisplayNew(trustScore);
          
          message += `${index + 1}. ${order.remainingAmount.toFixed(2)} CES по ₽${order.pricePerToken.toFixed(2)} (@${username}) ${userLevel.emoji}\n`;
        });
        message += `\n`;
      }
      
      if (orders.sellOrders.length > 0) {
        message += `📉 Заявки на продажу:\n`;
        orders.sellOrders.slice(0, 5).forEach((order, index) => {
          const username = order.userId.username || order.userId.firstName || 'Пользователь';
          const trustScore = order.userId.trustScore || 0;
          const userLevel = this.getUserLevelDisplayNew(trustScore);
          
          message += `${index + 1}. ${order.remainingAmount.toFixed(2)} CES по ₽${order.pricePerToken.toFixed(2)} (@${username}) ${userLevel.emoji}\n`;
        });
      }
      
      if (orders.buyOrders.length === 0 && orders.sellOrders.length === 0) {
        message += `📝 Активных ордеров пока нет\n\n💡 Создайте первый ордер на покупку или продажу!`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_market_orders')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Market orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ордеров.');
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

  // Handle top traders display
  async handleP2PTopTraders(ctx) {
    try {
      const reputationService = require('../services/reputationService');
      const topTraders = await reputationService.getTopRatedUsers(10);
      
      let message = `🏆 ТОП ТРЕЙДЕРОВ\n\n`;
      
      if (topTraders.length > 0) {
        topTraders.forEach((trader, index) => {
          const positionEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          
          message += `${positionEmoji} @${trader.username}\n`;
          message += `   Рейтинг: ${trader.trustScore}/1000\n`;
          message += `   Успешных сделок: ${trader.completionRate}%\n\n`;
        });
      } else {
        message += `📝 Пока нет трейдеров с высоким рейтингом\n\n`;
        message += `💡 Активно торгуйте, чтобы попасть в топ !`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_top_traders')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
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
      
      let message = `📋 МОИ ОРДЕРА\n\n`;
      
      if (orders.length === 0) {
        message += `📝 У вас пока нет активных ордеров\n\n💡 Создайте ордер на покупку или продажу CES!`;
      } else {
        orders.forEach((order, index) => {
          const typeEmoji = order.type === 'buy' ? '📈' : '📉';
          const typeText = order.type === 'buy' ? 'Покупка' : 'Продажа';
          const statusText = order.status === 'active' ? 'Активен' : 
                           order.status === 'partial' ? 'Частично исполнен' : 
                           order.status === 'completed' ? 'Завершен' : 'Отменен';
          
          message += `${index + 1}. ${typeEmoji} ${typeText}\n`;
          message += `Кол-во: ${order.remainingAmount.toFixed(3)} CES\n`;
          message += `Цена: ${order.pricePerToken.toFixed(2)} ₽ за 1 CES\n`;
          message += `Сумма: ${(order.remainingAmount * order.pricePerToken).toFixed(2)} ₽\n`;
          message += `Статус: ${statusText} ${order.createdAt.toLocaleDateString('ru-RU')}\n\n`;
        });
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_my_orders')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('My orders error:', error);
      await ctx.reply('❌ Ошибка загрузки ваших ордеров.');
    }
  }

  // Process P2P order from user message
  async processP2POrder(ctx, orderData, orderType) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Parse order data (amount pricePerToken)
      const parts = orderData.trim().split(/\s+/);
      
      if (parts.length !== 2) {
        return await ctx.reply(`⚠️ Неверный формат. \nИспользуйте: количество цена_за_токен\n\nПример: 10 250.50 или 10 250,50`, {
          parse_mode: 'Markdown'
        });
      }
      
      const [amountStr, priceStr] = parts;
      
      // Normalize decimal separators (replace comma with dot)
      const normalizedAmountStr = amountStr.replace(',', '.');
      const normalizedPriceStr = priceStr.replace(',', '.');
      
      const amount = parseFloat(normalizedAmountStr);
      const pricePerToken = parseFloat(normalizedPriceStr);
      
      if (isNaN(amount) || amount <= 0 || isNaN(pricePerToken) || pricePerToken <= 0) {
        return await ctx.reply('❌ Неверные значения. Укажите положительные числа.\n\n**Пример:** `10 250.50` или `10 250,50`', {
          parse_mode: 'Markdown'
        });
      }
      
      if (amount < 1) {
        console.log(`❌ Amount too small: ${amount}`);
        return await ctx.reply('❌ Минимальное количество: 1 CES');
      }
      
      const totalValue = amount * pricePerToken;
      const commission = totalValue * 0.01;
      
      console.log(`💰 Processing P2P order: ${amount} CES at ₽${pricePerToken} (total: ₽${totalValue.toFixed(2)}, commission: ₽${commission.toFixed(2)})`);
      
      // Show confirmation
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'покупку' : 'продажу';
      
      const message = `💎 **Подтверждение ордера на ${typeText}** 💎\n\n` +
                     `💰 Количество: **${amount} CES**\n` +
                     `💵 Цена за токен: **₽${pricePerToken.toFixed(2)}**\n` +
                     `💸 Общая сумма: **₽${totalValue.toFixed(2)}**\n` +
                     ` Bakan Комиссия: **₽${commission.toFixed(2)} (1%)**\n\n` +
                     `🛡️ *Безопасность:*\n` +
                     `🔒 Все сделки защищены эскроу-системой\n\n` +
                     `❗ Подтвердить создание ордера?`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', `confirm_p2p_order_${orderType}_${amount}_${pricePerToken}`)],
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
  async handleP2POrderConfirmation(ctx, orderParams) {
    try {
      console.log(`🔄 Processing P2P order confirmation: ${orderParams}`);
      
      const parts = orderParams.split('_');
      if (parts.length < 5) {
        console.log(`❌ Invalid order parameters: ${orderParams}`);
        throw new Error('Invalid order parameters');
      }
      
      const [, , , orderType, amountStr, priceStr] = parts;
      const amount = parseFloat(amountStr);
      const pricePerToken = parseFloat(priceStr);
      const chatId = ctx.chat.id.toString();
      
      console.log(`📊 Order details: type=${orderType}, amount=${amount}, price=${pricePerToken}, chatId=${chatId}`);
      
      await ctx.reply('⏳ Создание ордера... Подождите.');
      
      let result;
      if (orderType === 'buy') {
        console.log(`📈 Creating buy order...`);
        result = await p2pService.createBuyOrder(chatId, amount, pricePerToken);
      } else {
        console.log(`📉 Creating sell order...`);
        result = await p2pService.createSellOrder(chatId, amount, pricePerToken);
      }
      
      console.log(`✅ Order created successfully: ${result._id}`);
      
      const typeEmoji = orderType === 'buy' ? '📈' : '📉';
      const typeText = orderType === 'buy' ? 'покупку' : 'продажу';
      const totalValue = amount * pricePerToken;
      
      const message = `🎉 **Ордер на ${typeText} создан!** 🎉\n\n` +
                     `💎 Количество: **${amount} CES**\n` +
                     `💵 Цена: **₽${pricePerToken.toFixed(2)} за токен**\n` +
                     `💸 Общая сумма: **₽${totalValue.toFixed(2)}**\n\n` +
                     `🔍 *Что дальше:*\n` +
                     `✅ Ордер автоматически исполнится при появлении подходящего предложения!\n` +
                     `📊 Следите за статусом в разделе "Мои ордера"\n\n` +
                     `🛡️ *Безопасность:*\n` +
                     `🔒 Все сделки защищены эскроу-системой`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('P2P order confirmation error:', error);
      
      const errorMessage = '❌ **Ошибка создания ордера**\n\n' +
                          `ℹ️ ${error.message}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(errorMessage, { parse_mode: 'Markdown', ...keyboard });
    }
  }

  // Handle market analytics
  async handleP2PAnalytics(ctx) {
    try {
      const analyticsService = require('../services/analyticsService');
      
      // Get market analytics for 24h and 30d
      const marketStats24h = await analyticsService.getTradingStatistics('24h');
      const marketStats30d = await analyticsService.getTradingStatistics('30d');
      
      const message = `🧮 АНАЛИТИКА P2P БИРЖИ\n\n` +
                     `1. Статистика за 24 часа:\n` +
                     `Объем торгов: ₽ ${(marketStats24h.volume.totalRubles || marketStats24h.volume.rubles || 0).toLocaleString('ru-RU')}\n` +
                     `Завершенные сделки: ${marketStats24h.trades.completed || 0}\n` +
                     `Уровень завершения: ${marketStats24h.trades.completionRate || 0}%\n` +
                     `Активные трейдеры: ${marketStats24h.users.uniqueTraders || 0}\n\n` +
                     `2. Статистика за 30 дней:\n` +
                     `Объем торгов: ₽ ${(marketStats30d.volume.totalRubles || marketStats30d.volume.rubles || 0).toLocaleString('ru-RU')}\n` +
                     `Завершенные сделки: ${marketStats30d.trades.completed || 0}\n` +
                     `Уровень завершения: ${marketStats30d.trades.completionRate || 0}%\n` +
                     `Активные трейдеры: ${marketStats30d.users.uniqueTraders || 0}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_analytics')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Analytics error:', error);
      await ctx.reply('❌ Ошибка загрузки аналитики. Попробуйте позже.');
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
                     'Введите ваше сообщение ниже:\n\n' +
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
}

module.exports = new MessageHandler();