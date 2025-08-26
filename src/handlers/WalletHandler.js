/**
 * Wallet Handler
 * Handles all wallet-related operations including creation, management, and personal cabinet
 */

const { Markup } = require('telegraf');
const walletService = require('../services/walletService');
const priceService = require('../services/priceService');
const { isDatabaseConnected } = require('../database/models');
const sessionManager = require('./SessionManager');

class WalletHandler {
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
      
        // Format as requested with escrow information
        let cesBalanceText = `Баланс CES: ${walletInfo.cesBalance.toFixed(4)}`;
        if (walletInfo.escrowCESBalance > 0) {
          cesBalanceText += ` (в эскроу: ${walletInfo.escrowCESBalance.toFixed(4)})`;
        }
        cesBalanceText += ` • $ ${cesTotalUsd} • ₽ ${cesTotalRub}\n`;
        
        let polBalanceText = `Баланс POL: ${walletInfo.polBalance.toFixed(4)}`;
        if (walletInfo.escrowPOLBalance > 0) {
          polBalanceText += ` (в эскроу: ${walletInfo.escrowPOLBalance.toFixed(4)})`;
        }
        polBalanceText += ` • $ ${polTotalUsd} • ₽ ${polTotalRub}\n`;
        
        message += cesBalanceText + polBalanceText;
      
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
      // Immediate callback response
      await ctx.answerCbQuery('🔨 Создаем кошелек...');
      
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
      // Immediate callback response
      await ctx.answerCbQuery('⚙️ Загружаем меню...');
      
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
      // Immediate callback response
      await ctx.answerCbQuery('💳 Загружаем данные кошелька...');
      
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

  // Refresh balance
  async handleRefreshBalance(ctx) {
    try {
      await this.handleUserProfile(ctx);
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
}

module.exports = WalletHandler;