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
      
      // Check if user is in transfer mode
      if (ctx.session && ctx.session.awaitingTransfer) {
        const transferType = ctx.session.transferType || 'CES';
        ctx.session.awaitingTransfer = false;
        ctx.session.transferType = null;
        return await this.processTransferCommand(ctx, text, transferType);
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
        // Get current price data for display
        const priceData = await priceService.getCESPrice();
        const cesUsdPrice = priceData ? priceData.price.toFixed(2) : '0.00';
        const cesRubPrice = priceData ? priceData.priceRub.toFixed(2) : '0.00';
        
        // For POL, we'll use a placeholder price for now (could be enhanced later)
        const polUsdPrice = '0.45'; // Placeholder POL price
        const polRubPrice = '45.00'; // Placeholder POL price in RUB
        
        message += `Баланс CES: ${walletInfo.cesBalance.toFixed(4)} • $ ${cesUsdPrice} • ₽ ${cesRubPrice}\n`;
        message += `Баланс POL: ${walletInfo.polBalance.toFixed(4)} • $ ${polUsdPrice} • ₽ ${polRubPrice}`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('💳 Кошелек', 'wallet_details')],
          [Markup.button.callback('💸 Перевод', 'transfer_menu')],
          [Markup.button.callback('🔄 Обновить', 'refresh_balance')]
        ]);
        
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        
      } else {
        message += '❌ Кошелек не создан\n\n';
        message += 'Создайте кошелек для хранения токенов CES и POL';
        
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
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.reply('❌ У вас нет кошелька. Создайте его в Личном кабинете.');
      }
      
      // Redirect to transfer menu
      const message = '💸 Перевод';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💸 Перевести CES', 'send_ces_tokens')],
        [Markup.button.callback('💎 Перевести POL', 'send_pol_tokens')],
        [Markup.button.callback('📊 История переводов', 'transaction_history')],
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
      ]);
      
      await ctx.reply(message, keyboard);
      
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
      
      let message = '👤 Личный кабинет\n\n';
      
      if (walletInfo.hasWallet) {
        // Get current price data for display
        const priceData = await priceService.getCESPrice();
        const cesUsdPrice = priceData ? priceData.price.toFixed(2) : '0.00';
        const cesRubPrice = priceData ? priceData.priceRub.toFixed(2) : '0.00';
        
        // For POL, we'll use a placeholder price for now
        const polUsdPrice = '0.45';
        const polRubPrice = '45.00';
        
        message += `Баланс CES: ${walletInfo.cesBalance.toFixed(4)} • $ ${cesUsdPrice} • ₽ ${cesRubPrice}\n`;
        message += `Баланс POL: ${walletInfo.polBalance.toFixed(4)} • $ ${polUsdPrice} • ₽ ${polRubPrice}`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('💳 Кошелек', 'wallet_details')],
          [Markup.button.callback('💸 Перевод', 'transfer_menu')],
          [Markup.button.callback('🔄 Обновить', 'refresh_balance')]
        ]);
        
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        
      } else {
        message += '❌ Кошелек не создан\n\n';
        message += 'Создайте кошелек для хранения токенов CES и POL';
        
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

  // Handle wallet details view
  async handleWalletDetails(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        return await ctx.editMessageText('❌ Кошелек не найден.');
      }
      
      const message = '💳 Кошелек\n\n' +
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

  // Handle P2P menu
  async handleP2PMenu(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const walletInfo = await walletService.getUserWallet(chatId);
      
      if (!walletInfo || !walletInfo.hasWallet) {
        const message = '💸 Перевод\n\n' +
                       '❌ У вас нет кошелька.\n\n' +
                       'Создайте кошелек в Личном кабинете для использования P2P функций.';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Главное меню', 'back_to_menu')]
        ]);
        
        return await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
      // Redirect to transfer menu
      const message = '💸 Перевод';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💸 Перевести CES', 'send_ces_tokens')],
        [Markup.button.callback('💎 Перевести POL', 'send_pol_tokens')],
        [Markup.button.callback('📊 История переводов', 'transaction_history')],
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
      ]);
      
      await ctx.editMessageText(message, keyboard);
      
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
      ctx.session = ctx.session || {};
      ctx.session.awaitingTransfer = true;
      ctx.session.transferType = 'CES';
      
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
                     '`0x742d35Cc6734C0532925a3b8D4321F...89 0.1`\n\n' +
                     'ℹ️ Минимальная сумма: 0.001 POL\n' +
                     '⚠️ 0.001 POL останется для комиссии';
      
      // Store state to handle next user message
      ctx.session = ctx.session || {};
      ctx.session.awaitingTransfer = true;
      ctx.session.transferType = 'POL';
      
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
}

module.exports = new MessageHandler();