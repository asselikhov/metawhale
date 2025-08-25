/**
 * Transfer Handler
 * Handles all token transfer operations (CES and POL)
 */

const { Markup } = require('telegraf');
const walletService = require('../services/walletService');
const sessionManager = require('./SessionManager');

class TransferHandler {
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
      sessionManager.setTransferState(chatId, 'CES');

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
      sessionManager.setTransferState(chatId, 'POL');

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
      
      // ONLY handle main menu buttons if we're actually in a transfer session
      const sessionManager = require('./SessionManager');
      const userState = sessionManager.getUserState(chatId);
      
      if (userState === 'transfer') {
        // Check for main menu buttons - handle them instead of treating as transfer data
        if (transferData.includes('Личный кабинет') || transferData.includes('👤')) {
          console.log('📝 TransferHandler: Detected main menu button - Personal Cabinet');
          sessionManager.clearUserSession(chatId);
          const WalletHandler = require('./WalletHandler');
          const handler = new WalletHandler();
          return await handler.handlePersonalCabinetText(ctx);
        }
        
        if (transferData.includes('P2P Биржа') || transferData.includes('🔄 P2P')) {
          console.log('📝 TransferHandler: Detected main menu button - P2P Exchange');
          sessionManager.clearUserSession(chatId);
          const P2PHandler = require('./P2PHandler');
          const handler = new P2PHandler();
          return await handler.handleP2PMenu(ctx);
        }
      }
      
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
      sessionManager.setPendingTransfer(chatId, {
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
      const pendingTransfer = sessionManager.getPendingTransfer(chatId);
      
      if (!pendingTransfer || !pendingTransfer.tokenType || !pendingTransfer.toAddress || !pendingTransfer.amount) {
        throw new Error('Данные перевода не найдены. Попробуйте снова.');
      }
      
      // Check if transfer data is not too old (30 minutes)
      const transferAge = Date.now() - (pendingTransfer.timestamp || 0);
      if (transferAge > 30 * 60 * 1000) {
        sessionManager.setPendingTransfer(chatId, null);
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
      sessionManager.setPendingTransfer(chatId, null);
      
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
}

module.exports = TransferHandler;