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
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(2)}% • 🅥 $ ${priceService.formatNumber(priceData.volume24h)} • 🅐🅣🅗 ${athDisplay}`;
      
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
      
      if (text.includes('Личный кабинет')) {
        return await this.handlePersonalCabinetText(ctx);
      }
      
      if (text.includes('P2P')) {
        return await this.handleP2PMenuText(ctx);
      }
      
      // Check if message looks like a transfer command (address amount)
      const transferPattern = /^0x[a-fA-F0-9]{40}\s+\d+\.?\d*$/;
      if (transferPattern.test(text.trim())) {
        return await this.processTransferCommand(ctx, text, 'CES');
      }
      
      // Check if message looks like a P2P order (amount price) - but only if in P2P session
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
      
      let message = '👤 **Личный кабинет**\n\n';
      
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
        message += '❌ Кошелек не создан\n\n';
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

  // Handle P2P from text message
  async handleP2PMenuText(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`🔄 Handling P2P menu text for user ${chatId}`);
      
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        const message = 'P2P биржа\n\n' +
                       'У вас нет кошелька.\n\n' +
                       'Создайте кошелек в Личном кабинете для использования P2P функций.';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }
      
      // Get user reputation data
      const reputationService = require('../services/reputationService');
      const user = await User.findOne({ chatId });
      const reputation = await reputationService.getUserReputation(user._id);
      
      // Show P2P Exchange menu with required format
      const message = 'P2P биржа\n\n' +
                     `Рейтинг: ${reputation.trustScore}/1000\n` +
                     `Завершенные сделки: ${reputation.completionRate}%\n` +
                     `Спорные сделки: ${reputation.disputeRate}%\n` +
                     `Всего сделок: ${reputation.totalTrades}\n\n` +
                     'Выберите действие:';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Купить CES', 'p2p_buy_ces'), Markup.button.callback('📉 Продать CES', 'p2p_sell_ces')],
        [Markup.button.callback('📊 Рынок ордеров', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('📈 Аналитика', 'p2p_analytics')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P menu text error:', error);
      await ctx.reply('❌ Ошибка загрузки P2P меню. Попробуйте позже.');
    }
  }
  async handlePersonalCabinet(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo) {
        return await ctx.editMessageText('❌ Пользователь не найден. Выполните /start');
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
        
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        
      } else {
        message += '❌ Кошелек не создан\n\n';
        message += '💡 Создайте кошелек для хранения токенов CES и POL';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('➕ Создать кошелек', 'create_wallet')],
          [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
        ]);
        
        await ctx.editMessageText(message, keyboard);
      }
      
    } catch (error) {
      console.error('Error showing personal cabinet:', error);
      await ctx.editMessageText('❌ Ошибка загрузки личного кабинета. Попробуйте позже.');
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
      
      await ctx.editMessageText(
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
      await ctx.editMessageText(`❌ ${error.message}`);
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
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Wallet edit menu error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки меню. Попробуйте позже.');
    }
  }

  // Handle wallet details view
  async handleWalletDetails(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.editMessageText('❌ Кошелек не найден.');
      }
      
      const message = 'Кошелек\n\n' +
                     `\`${walletInfo.address}\``;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔑 Показать приватный ключ', 'show_private_key')],
        [Markup.button.callback('📤 Экспорт кошелька', 'export_wallet')],
        [Markup.button.callback('🗑 Удалить кошелек', 'delete_wallet')],
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Wallet details error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки данных кошелька.');
    }
  }

  // Handle transfer menu
  async handleTransferMenu(ctx) {
    try {
      const message = '💸 Перевод';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💸 Перевести CES', 'send_ces_tokens')],
        [Markup.button.callback('💎 Перевести POL', 'send_pol_tokens')],
        [Markup.button.callback('📊 История переводов', 'transaction_history')],
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
      ]);
      
      await ctx.editMessageText(message, keyboard);
      
    } catch (error) {
      console.error('Transfer menu error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки меню переводов.');
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
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Show private key error:', error);
      await ctx.editMessageText(`❌ ${error.message}`);
    }
  }

  // Handle wallet export
  async handleExportWallet(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      const privateKey = await walletService.getUserPrivateKey(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.editMessageText('❌ Кошелек не найден.');
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
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Export wallet error:', error);
      await ctx.editMessageText(`❌ ${error.message}`);
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
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Delete wallet confirmation error:', error);
      await ctx.editMessageText('❌ Ошибка подтверждения удаления.');
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
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Confirm delete wallet error:', error);
      await ctx.editMessageText(`❌ Ошибка удаления: ${error.message}`);
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
        const message = 'P2P биржа\n\n' +
                       'У вас нет кошелька.\n\n' +
                       'Создайте кошелек в Личном кабинете для использования P2P функций.';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
        ]);
        
        return await ctx.editMessageText(message, keyboard);
      }
      
      // Get user reputation data
      const reputationService = require('../services/reputationService');
      const user = await User.findOne({ chatId });
      const reputation = await reputationService.getUserReputation(user._id);
      
      // Show P2P Exchange menu with required format
      const message = 'P2P биржа\n\n' +
                     `Рейтинг: ${reputation.trustScore}/1000\n` +
                     `Завершенные сделки: ${reputation.completionRate}%\n` +
                     `Спорные сделки: ${reputation.disputeRate}%\n` +
                     `Всего сделок: ${reputation.totalTrades}\n\n` +
                     'Выберите действие:';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Купить CES', 'p2p_buy_ces'), Markup.button.callback('📉 Продать CES', 'p2p_sell_ces')],
        [Markup.button.callback('📊 Рынок ордеров', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
        [Markup.button.callback('📈 Аналитика', 'p2p_analytics')]
      ]);
      
      await ctx.editMessageText(message, keyboard);
      
    } catch (error) {
      console.error('P2P menu error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки P2P меню. Попробуйте позже.');
    }
  }

  // Handle user profile
  async handleP2PMyProfile(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      if (!user) {
        return await ctx.editMessageText('❌ Пользователь не найден.');
      }
      
      // Get reputation data
      const reputationService = require('../services/reputationService');
      const reputation = await reputationService.getUserReputation(user._id);
      
      // Get user's recent trades
      const recentTrades = await p2pService.getUserTrades(chatId, 5);
      
      const verificationText = {
        'unverified': 'Не верифицирован',
        'phone_verified': 'Верификация по телефону',
        'document_verified': 'Верификация по документам',
        'premium': 'Премиум пользователь'
      };
      
      const message = `👤 **Мой профиль P2P** 👤\n\n` +
                     `⭐ *Рейтинг и репутация:*\n` +
                     `🏆 Рейтинг: ${reputation.trustScore}/1000\n` +
                     `🏅 Верификация: ${verificationText[reputation.verificationLevel]}\n` +
                     `📊 Уровень завершения сделок: ${reputation.completionRate}%\n` +
                     `⚠️ Спорные сделки: ${reputation.disputeRate}%\n` +
                     `💰 Всего сделок: ${reputation.totalTrades}\n\n` +
                     `📈 *Последние сделки:*\n` +
                     (recentTrades.length > 0 
                       ? recentTrades.map((trade, index) => 
                           `${index + 1}. 💰 ${trade.amount.toFixed(2)} CES за ₽${trade.totalValue.toFixed(2)} (${trade.status === 'completed' ? '✅' : '❌'})`
                         ).join('\n')
                       : '📝 Нет завершенных сделок');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_my_profile')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Profile error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки профиля. Попробуйте позже.');
    }
  }

  // Handle back to main menu
  async handleBackToMenu(ctx) {
    try {
      const mainMenu = Markup.keyboard([
        ['👤 Личный кабинет', '🔄 P2P']
      ]).resize();
      
      await ctx.editMessageText('🌾 Главное меню', mainMenu);
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
        return await ctx.editMessageText('❌ У вас нет кошелька. Создайте его в Личном кабинете.');
      }
      
      if (walletInfo.cesBalance <= 0) {
        const message = '💸 **Перевод CES токенов**\n\n' +
                       '❌ Недостаточно средств для перевода.\n' +
                       `💼 Ваш баланс: **${walletInfo.cesBalance.toFixed(4)} CES**`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Обновить баланс', 'refresh_balance')],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      const message = '💸 **Перевод CES токенов**\n\n' +
                     `💼 Доступно: **${walletInfo.cesBalance.toFixed(4)} CES**\n\n` +
                     '📝 Отправьте сообщение в формате:\n' +
                     '`Адрес_кошелька Сумма`\n\n' +
                     '📝 **Пример:**\n' +
                     '`0x742d35Cc6734C0532925a3b8D4321F...89 10.5`\n\n' +
                     'ℹ️ Минимальная сумма: 0.001 CES';
      
      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingTransfer', true);
      this.setSessionData(chatId, 'transferType', 'CES');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Error initiating CES transfer:', error);
      await ctx.editMessageText('❌ Ошибка инициализации перевода. Попробуйте позже.');
    }
  }

  // Handle POL token transfer initiation
  async handleSendPOLTokens(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.editMessageText('❌ У вас нет кошелька. Создайте его в Личном кабинете.');
      }
      
      if (walletInfo.polBalance <= 0.001) {
        const message = '💎 **Перевод POL токенов**\n\n' +
                       '❌ Недостаточно средств для перевода.\n' +
                       `💎 Ваш баланс: **${walletInfo.polBalance.toFixed(4)} POL**\n\n` +
                       'ℹ️ Минимум 0.001 POL нужно оставить для комиссии';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Обновить баланс', 'refresh_balance')],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      const maxTransfer = (walletInfo.polBalance - 0.001).toFixed(4);
      const message = '💎 **Перевод POL токенов**\n\n' +
                     `💎 Доступно: **${maxTransfer} POL**\n` +
                     `💼 Всего: **${walletInfo.polBalance.toFixed(4)} POL**\n\n` +
                     '📝 Отправьте сообщение в формате:\n' +
                     '`Адрес_кошелька Сумма`\n\n' +
                     '📝 **Пример:**\n' +
                     '`0x742d35Cc6734C0532925a3b8D4321F...89 0.1`\n\n` +
                     'ℹ️ Минимальная сумма: 0.001 POL\n' +
                     '⚠️ 0.001 POL останется для комиссии';
      
      // Store state to handle next user message
      this.setSessionData(chatId, 'awaitingTransfer', true);
      this.setSessionData(chatId, 'transferType', 'POL');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Error initiating POL transfer:', error);
      await ctx.editMessageText('❌ Ошибка инициализации перевода. Попробуйте позже.');
    }
  }

  // Handle transaction history
  async handleTransactionHistory(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const transactions = await walletService.getUserTransactions(chatId, 5);
      
      let message = '📊 **История переводов**\n\n';
      
      if (transactions.length === 0) {
        message += '📝 Переводов пока не было\n\n' +
                  'Начните отправлять CES токены другим пользователям!';
      } else {
        const user = await walletService.findUserByAddress(transactions[0].fromAddress) || 
                    await walletService.findUserByAddress(transactions[0].toAddress);
        
        transactions.forEach((tx, index) => {
          const isOutgoing = tx.fromUserId && tx.fromUserId.toString() === user._id.toString();
          const direction = isOutgoing ? '🟢 Исходящий' : '🔵 Входящий';
          const statusEmoji = tx.status === 'completed' ? '✅' : 
                             tx.status === 'pending' ? '⏳' : '❌';
          
          message += `${index + 1}. ${direction}\n`;
          message += `💰 ${tx.amount} CES ${statusEmoji}\n`;
          message += `📅 ${tx.createdAt.toLocaleString('ru-RU')}\n`;
          
          if (tx.txHash) {
            const shortHash = tx.txHash.substring(0, 10) + '...';
            message += `🔗 ${shortHash}\n`;
          }
          
          message += '\n';
        });
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Error showing transaction history:', error);
      await ctx.editMessageText('❌ Ошибка загрузки истории. Попробуйте позже.');
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
      
      await ctx.editMessageText('⏳ Обработка перевода... Подождите.');
      
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
          [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
        ]);
        
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
    } catch (error) {
      console.error('Transfer confirmation error:', error);
      
      const errorMessage = '❌ **Ошибка перевода**\n\n' +
                          `ℹ️ ${error.message}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(errorMessage, { parse_mode: 'Markdown', ...keyboard });
    }
  }

  // Handle P2P Buy CES
  async handleP2PBuyCES(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `💎 **Покупка CES токенов** 💎\n\n` +
                     `🏦 *Текущая рыночная цена:*\n` +
                     `💰 ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `📊 *Рекомендованная цена:*\n` +
                     `⭐ ${priceData.suggestedPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `📝 *Введите количество и цену:*\n` +
                     `🔹 Формат: \`количество цена_за_токен\`\n` +
                     `🔸 Пример: \`10 ${priceData.suggestedPrice.toFixed(2)}\`\n\n` +
                     `ℹ️ *Информация:*\n` +
                     `🔹 Минимальная сумма: 1 CES\n` +
                     `🔸 Комиссия платформы: 1%\n` +
                     `🔹 Средства покупателя замораживаются в эскроу\n` +
                     `🔸 Продавец получает CES после подтверждения оплаты\n\n` +
                     `🛡️ *Безопасность:*\n` +
                     `🔒 Все сделки защищены эскроу-системой`;
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P buy order session for ${chatId}`);
      this.setSessionData(chatId, 'awaitingP2POrder', true);
      this.setSessionData(chatId, 'p2pOrderType', 'buy');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('P2P Buy CES error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки данных для покупки.');
    }
  }

  // Handle P2P Sell CES
  async handleP2PSellCES(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (walletInfo.cesBalance <= 0) {
        const message = `📉 **Продать CES токены**\n\n` +
                       `❌ Недостаточно CES токенов для продажи.\n` +
                       `💼 Ваш баланс: **${walletInfo.cesBalance.toFixed(4)} CES**\n\n` +
                       `💡 Пополните баланс CES для продажи.`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Обновить баланс', 'refresh_balance')],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      const priceData = await p2pService.getMarketPriceSuggestion();
      
      const message = `💎 **Продажа CES токенов** 💎\n\n` +
                     ` Bakan *Ваш баланс:*\n` +
                     `💰 ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                     `📊 *Текущая рыночная цена:*\n` +
                     `⭐ ${priceData.currentPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `📈 *Рекомндуемая цена:*\n` +
                     `🔥 ${priceData.suggestedPrice.toFixed(2)} ₽ за 1 CES\n\n` +
                     `📝 *Введите количество и цену:*\n` +
                     `🔹 Формат: \`количество цена_за_токен\`\n` +
                     `🔸 Пример: \`5 ${priceData.suggestedPrice.toFixed(2)}\`\n\n` +
                     `ℹ️ *Информация:*\n` +
                     `🔹 Минимальная сумма: 1 CES\n` +
                     `🔸 Комиссия платформы: 1%\n` +
                     `🔹 CES токены замораживаются в эскроу\n` +
                     `🔸 Получите рубли после подтверждения оплаты\n\n` +
                     `🛡️ *Безопасность:*\n` +
                     `🔒 Все сделки защищены эскроу-системой`;
      
      // Store state to handle next user message
      console.log(`🔄 Setting P2P sell order session for ${chatId}`);
      this.setSessionData(chatId, 'awaitingP2POrder', true);
      this.setSessionData(chatId, 'p2pOrderType', 'sell');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('P2P Sell CES error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки данных для продажи.');
    }
  }

  // Handle market orders display
  async handleP2PMarketOrders(ctx) {
    try {
      const orders = await p2pService.getMarketOrders(10);
      
      let message = `🌟 **Активные ордера** 🌟\n\n`;
      
      if (orders.buyOrders.length > 0) {
        message += `📈 **Заявки на покупку:**\n`;
        orders.buyOrders.slice(0, 5).forEach((order, index) => {
          const username = order.userId.username || order.userId.firstName || 'Пользователь';
          message += `${index + 1}. 💰 ${order.remainingAmount.toFixed(2)} CES по ₽${order.pricePerToken.toFixed(2)} (@${username})\n`;
        });
        message += `\n`;
      }
      
      if (orders.sellOrders.length > 0) {
        message += `.DataGridViewColumn **Заявки на продажу:**\n`;
        orders.sellOrders.slice(0, 5).forEach((order, index) => {
          const username = order.userId.username || order.userId.firstName || 'Пользователь';
          message += `${index + 1}. 💎 ${order.remainingAmount.toFixed(2)} CES по ₽${order.pricePerToken.toFixed(2)} (@${username})\n`;
        });
      }
      
      if (orders.buyOrders.length === 0 && orders.sellOrders.length === 0) {
        message += `📝 Активных ордеров пока нет\n\n💡 Создайте первый ордер на покупку или продажу!`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_market_orders')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Market orders error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки ордеров.');
    }
  }

  // Handle user's orders
  async handleP2PMyOrders(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const orders = await p2pService.getUserOrders(chatId, 10);
      
      let message = `📋 **Мои ордера** 📋\n\n`;
      
      if (orders.length === 0) {
        message += `📝 У вас пока нет активных ордеров\n\n💡 Создайте ордер на покупку или продажу CES!`;
      } else {
        orders.forEach((order, index) => {
          const typeEmoji = order.type === 'buy' ? '📈' : '📉';
          const typeText = order.type === 'buy' ? 'Покупка' : 'Продажа';
          const statusText = order.status === 'active' ? 'Активен' : 
                           order.status === 'partial' ? 'Частично исполнен' : 
                           order.status === 'completed' ? 'Завершен' : 'Отменен';
          
          message += `${index + 1}. ${typeEmoji} **${typeText}**\n`;
          message += `💰 ${order.remainingAmount.toFixed(2)}/${order.amount.toFixed(2)} CES\n`;
          message += `💵 ₽${order.pricePerToken.toFixed(2)} за токен\n`;
          message += `📊 Статус: ${statusText}\n`;
          message += `📅 ${order.createdAt.toLocaleDateString('ru-RU')}\n\n`;
        });
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_my_orders')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('My orders error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки ваших ордеров.');
    }
  }

  // Process P2P order from user message
  async processP2POrder(ctx, orderData, orderType) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Parse order data (amount pricePerToken)
      const parts = orderData.trim().split(/\s+/);
      
      if (parts.length !== 2) {
        return await ctx.reply(`❌ Неверный формат. Используйте: \`количество цена_за_токен\`\n\n**Пример:** \`10 250.50\` или \`10 250,50\``, {
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
      const typeEmoji = orderType === 'buy' ? '📈' : '.DataGridViewColumn';
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
      
      await ctx.editMessageText('⏳ Создание ордера... Подождите.');
      
      let result;
      if (orderType === 'buy') {
        console.log(`📈 Creating buy order...`);
        result = await p2pService.createBuyOrder(chatId, amount, pricePerToken);
      } else {
        console.log(`📉 Creating sell order...`);
        result = await p2pService.createSellOrder(chatId, amount, pricePerToken);
      }
      
      console.log(`✅ Order created successfully: ${result._id}`);
      
      const typeEmoji = orderType === 'buy' ? '📈' : '.DataGridViewColumn';
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
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('P2P order confirmation error:', error);
      
      const errorMessage = '❌ **Ошибка создания ордера**\n\n' +
                          `ℹ️ ${error.message}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(errorMessage, { parse_mode: 'Markdown', ...keyboard });
    }
  }

  // Handle market analytics
  async handleP2PAnalytics(ctx) {
    try {
      const analyticsService = require('../services/analyticsService');
      
      // Get market analytics
      const analytics = await analyticsService.getAIInsights();
      const marketStats = await analyticsService.getTradingStatistics('24h');
      
      const message = `📈 **Аналитика P2P Биржи** 📈\n\n` +
                     `🤖 *ИИ Рекомендации:*\n` +
                     `📊 Тренд: ${analytics.trend}\n` +
                     `🎯 Уверенность ИИ: ${(analytics.confidence * 100).toFixed(0)}%\n` +
                     `💡 Рекомендация: ${analytics.recommendation}\n\n` +
                     `📊 *Статистика за 24 часа:*\n` +
                     `💰 Объем торгов: ₽${(analytics.volume || marketStats.volume.totalRubles || 0).toLocaleString('ru-RU')}\n` +
                     `✅ Завершенные сделки: ${marketStats.trades.completed || 0}\n` +
                     `📈 Уровень завершения: ${analytics.completionRate || marketStats.trades.completionRate || 0}%\n` +
                     `👥 Активные трейдеры: ${marketStats.users.uniqueTraders || 0}\n\n` +
                     `🛡️ *Безопасность:*\n` +
                     `🔒 Все сделки защищены эскроу-системой`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'p2p_analytics')],
        [Markup.button.callback('🔙 Назад к P2P', 'p2p_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('Analytics error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки аналитики. Попробуйте позже.');
    }
  }
}

module.exports = new MessageHandler();