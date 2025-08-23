/**
 * Message Handlers
 * Handles all Telegram bot message and callback processing
 */

const { Markup } = require('telegraf');
const priceService = require('../services/priceService');
const walletService = require('../services/walletService');
const { User, PriceHistory } = require('../database/models');

class MessageHandler {
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
      
      if (text.includes('Личный кабинет')) {
        return await this.handlePersonalCabinetText(ctx);
      }
      
      if (text.includes('P2P')) {
        return await this.handleP2PMenuText(ctx);
      }
      
      // Default response for unknown text
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
        message += `🌐 **Polygon Wallet**\n`;
        message += `📍 Адрес: \`${walletInfo.address}\`\n`;
        message += `📎 Баланс CES: **${walletInfo.balance.toFixed(4)} CES**\n`;
        message += `⏰ Обновлено: ${walletInfo.lastUpdate.toLocaleString('ru-RU')}\n\n`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Редактировать', 'edit_wallet')],
          [Markup.button.callback('🔄 Обновить баланс', 'refresh_balance')],
          [Markup.button.callback('💰 Цена CES', 'get_price')]
        ]);
        
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        
      } else {
        message += '❌ Кошелек не создан\n\n';
        message += 'Создайте кошелек для хранения токенов CES';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('➕ Создать кошелек', 'create_wallet')],
          [Markup.button.callback('💰 Цена CES', 'get_price')]
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
      const message = '🔄 **P2P Обмен**\n\n' +
                     'Функциональность P2P обмена находится в разработке.\n\n' +
                     'Скоро здесь вы сможете:\n' +
                     '• 💸 Отправлять CES токены\n' +
                     '• 📥 Получать переводы\n' +
                     '• 📊 Просматривать историю транзакций\n' +
                     '• 🔁 Обменивать токены';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💰 Цена CES', 'get_price')]
      ]);
      
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('P2P menu error:', error);
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
      
      let message = '👤 **Личный кабинет**\n\n';
      
      if (walletInfo.hasWallet) {
        message += `🌐 **Polygon Wallet**\n`;
        message += `📍 Адрес: \`${walletInfo.address}\`\n`;
        message += `💎 Баланс CES: **${walletInfo.balance.toFixed(4)} CES**\n`;
        message += `⏰ Обновлено: ${walletInfo.lastUpdate.toLocaleString('ru-RU')}\n\n`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Редактировать', 'edit_wallet')],
          [Markup.button.callback('🔄 Обновить баланс', 'refresh_balance')],
          [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
        ]);
        
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        
      } else {
        message += '❌ Кошелек не создан\n\n';
        message += 'Создайте кошелек для хранения токенов CES';
        
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
        `✅ Кошелек успешно создан!\n\n` +
        `📍 Адрес: \`${walletResult.address}\`\n` +
        `🌐 Сеть: Polygon\n\n` +
        `⚠️ Сохраните приватный ключ в безопасном месте:\n` +
        `🔐 \`${walletResult.privateKey}\`\n\n` +
        `🚨 Никому не сообщайте ваш приватный ключ!`,
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

  // Handle P2P menu
  async handleP2PMenu(ctx) {
    try {
      const message = '🔄 **P2P Обмен**\n\n' +
                     'Функциональность P2P обмена находится в разработке.\n\n' +
                     'Скоро здесь вы сможете:\n' +
                     '• 💸 Отправлять CES токены\n' +
                     '• 📥 Получать переводы\n' +
                     '• 📊 Просматривать историю транзакций\n' +
                     '• 🔁 Обменивать токены';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
      ]);
      
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      
    } catch (error) {
      console.error('P2P menu error:', error);
      await ctx.editMessageText('❌ Ошибка загрузки P2P меню. Попробуйте позже.');
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
    await this.handlePersonalCabinet(ctx);
  }
}

module.exports = new MessageHandler();