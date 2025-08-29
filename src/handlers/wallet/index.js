/**
 * Wallet Handler
 * Handles all wallet-related operations including creation, management, and personal cabinet
 */

const { Markup } = require('telegraf');
const walletService = require('../../services/wallet/walletService');
const priceService = require('../../services/utility/priceService');
const multiChainWalletService = require('../../services/wallet/multiChainWalletService');
const userNetworkService = require('../../services/userNetworkService');
const multiChainService = require('../../services/multiChainService');
const { isDatabaseConnected } = require('../../database/models');
const sessionManager = require('../SessionManager');
const LocalizationHelper = require('../../utils/localizationHelper');

class WalletHandler {
  // Handle Personal Cabinet from text message
  async handlePersonalCabinetText(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      console.log(`🏠 Processing Personal Cabinet request for user ${chatId}`);
      
      let walletInfo = null;
      if (isDatabaseConnected()) {
        try {
          // Get multi-chain wallet info
          walletInfo = await multiChainWalletService.getMultiChainWalletInfo(chatId);
        } catch (dbError) {
          console.error('Database error during wallet retrieval:', dbError);
        }
      }
      
      // If database is not available or user not found, create a mock wallet info
      if (!walletInfo) {
        walletInfo = {
          hasWallet: false,
          currentNetwork: 'polygon',
          networkInfo: '🟣 Polygon'
        };
      }
      
      // Header
      let message = await LocalizationHelper.getText(chatId, 'personal_cabinet_title') + '\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n';
      
      if (walletInfo.hasWallet) {
        console.log(`💼 User ${chatId} has wallet, showing multi-chain wallet info`);
        
        // Add current network info
        message += `🌐 Текущая сеть: ${walletInfo.networkInfo}\n\n`;
        
        // Получаем выбранную валюту пользователя
        const fiatCurrencyService = require('../services/fiatCurrencyService');
        const userCurrency = await fiatCurrencyService.getUserCurrency(chatId);
        
        // Add balances for current network with user's preferred currency
        if (walletInfo.balances) {
          for (const [tokenSymbol, tokenInfo] of Object.entries(walletInfo.balances)) {
            // Конвертируем стоимость в выбранную валюту пользователя
            let displayText = tokenInfo.displayText;
            
            if (userCurrency !== 'RUB' && userCurrency !== 'USD') {
              // Если пользователь выбрал валюту, отличную от RUB и USD, показываем стоимость в этой валюте
              try {
                const usdAmount = parseFloat(tokenInfo.usdValue);
                if (usdAmount > 0) {
                  const convertedAmount = await fiatCurrencyService.convertAmount(usdAmount, 'USD', userCurrency);
                  const formattedAmount = fiatCurrencyService.formatAmount(convertedAmount, userCurrency);
                  
                  // Заменяем отображение стоимости на выбранную валюту
                  displayText = displayText.replace(
                    /• \$[\d.,]+ • ₽[\d.,]+/,
                    `• ${formattedAmount}`
                  );
                }
              } catch (convertError) {
                console.error('Error converting currency:', convertError);
                // Если конвертация не удалась, оставляем оригинальное отображение
              }
            } else if (userCurrency === 'USD') {
              // Если пользователь выбрал USD, показываем только стоимость в USD
              displayText = displayText.replace(
                /• \$[\d.,]+ • ₽[\d.,]+/,
                `• \$${tokenInfo.usdValue}`
              );
            }
            
            message += displayText + '\n';
          }
        }
        
        // Add total value if available, converted to user's preferred currency
        if (walletInfo.totalValue) {
          try {
            const totalUsd = parseFloat(walletInfo.totalValue.usd);
            if (userCurrency === 'USD') {
              message += `\n💰 Общая стоимость: \$${walletInfo.totalValue.usd}`;
            } else if (userCurrency === 'RUB') {
              message += `\n💰 Общая стоимость: \$${walletInfo.totalValue.usd} • ₽${walletInfo.totalValue.rub}`;
            } else {
              // Конвертируем в выбранную валюту пользователя
              const convertedAmount = await fiatCurrencyService.convertAmount(totalUsd, 'USD', userCurrency);
              const formattedAmount = fiatCurrencyService.formatAmount(convertedAmount, userCurrency);
              message += `\n💰 Общая стоимость: ${formattedAmount}`;
            }
          } catch (convertError) {
            console.error('Error converting total value:', convertError);
            // Если конвертация не удалась, показываем оригинальное отображение
            message += `\n💰 Общая стоимость: \$${walletInfo.totalValue.usd} • ₽${walletInfo.totalValue.rub}`;
          }
        }
      
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('💳 Кошелек', 'wallet_details')],
          [Markup.button.callback('💸 Перевод', 'transfer_menu')]
        ]);
      
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      
      } else {
        console.log(`⚠️ User ${chatId} has no wallet, showing wallet creation prompt`);
        message += '⚠️ Кошелек не создан\n\n';
        message += '💡 Создайте кошелек для хранения токенов в разных сетях\n';
        message += `🌐 Поддерживаемые сети: ${multiChainService.getNetworks().map(n => `${multiChainService.getNetworkEmoji(n.id)} ${n.name}`).join(', ')}`;
      
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('➕ Создать кошелек', 'create_wallet')],
          [Markup.button.callback('🔙 Назад', 'personal_cabinet')]
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
          [Markup.button.callback('➕ Создать кошелек', 'create_wallet')],
          [Markup.button.callback('🔙 Назад', 'personal_cabinet')]
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
      
      // Get user's currently selected network
      const selectedNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkConfig = multiChainService.getNetworkConfig(selectedNetwork);
      const networkName = multiChainService.getNetworkDisplayName(selectedNetwork);
      const networkEmoji = multiChainService.getNetworkEmoji(selectedNetwork);
      
      console.log(`🔨 Creating wallet for user ${chatId} on network: ${selectedNetwork}`);
      
      // Create wallet for the selected network
      // Note: For now, we create a universal wallet that works across EVM chains
      // For non-EVM chains like Solana or Tron, we might need different wallet generation
      const walletResult = await walletService.createUserWallet(chatId);
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
      ]);
      
      let networkInfo = '';
      if (selectedNetwork === 'tron' || selectedNetwork === 'solana') {
        networkInfo = `\n\n⚠️ Обратите внимание: Для ${networkName} может потребоваться специальный кошелек. Используйте общий кошелек для EVM-совместимых сетей.`;
      }
      
      await ctx.reply(
        `Кошелек успешно создан!\n\n` +
        `Адрес: \`${walletResult.address}\`\n` +
        `${networkEmoji} Сеть: ${networkName}\n\n` +
        `Важно: Сохраните приватный ключ в безопасном месте:\n` +
        `\`${walletResult.privateKey}\`\n\n` +
        `Предупреждение: Никому не сообщайте ваш приватный ключ!${networkInfo}`,
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

  // Refresh balance - updated for multi-chain support
  async handleRefreshBalance(ctx) {
    try {
      await ctx.answerCbQuery('🔄 Обновляем баланс...');
      await this.handlePersonalCabinetText(ctx);
    } catch (error) {
      // Handle "message not modified" error gracefully
      if (error.response && error.response.error_code === 400 && 
          error.response.description.includes('message is not modified')) {
        console.log('Ignoring "message not modified" error during refresh');
        await ctx.answerCbQuery('✅ Баланс актуален');
      } else {
        console.error('Refresh balance error:', error);
        await ctx.answerCbQuery('❌ Ошибка обновления');
      }
    }
  }

  // Handle network switching menu
  async handleSwitchNetwork(ctx) {
    try {
      await ctx.answerCbQuery('🌐 Загружаем список сетей...');
      
      const chatId = ctx.chat.id.toString();
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      
      const message = '🌐 ВЫБОР БЛОКЧЕЙН СЕТИ\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n\n' +
                     '🔄 Выберите сеть для работы:\n\n' +
                     `Текущая сеть: ${await userNetworkService.getNetworkInfo(chatId)}\n\n` +
                     '⚠️ При смене сети будут показаны балансы токенов этой сети';
      
      // Get network selector buttons
      const networkButtons = multiChainService.getNetworkSelectorButtons(currentNetwork);
      networkButtons.push([Markup.button.callback('🔙 Назад', 'personal_cabinet')]);
      
      const keyboard = Markup.inlineKeyboard(networkButtons);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
    } catch (error) {
      console.error('Switch network error:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки сетей');
    }
  }

  // Handle specific network switch
  async handleNetworkSwitch(ctx, networkId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Check if user can switch to this network
      const switchCheck = await userNetworkService.canSwitchToNetwork(chatId, networkId);
      
      if (!switchCheck.allowed) {
        await ctx.answerCbQuery(`❌ ${switchCheck.reason}`);
        return;
      }
      
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      
      // If already on this network, just go back
      if (currentNetwork === networkId) {
        await ctx.answerCbQuery('✅ Уже используется эта сеть');
        await this.handlePersonalCabinetText(ctx);
        return;
      }
      
      // Record the switch
      await userNetworkService.recordNetworkSwitch(chatId, currentNetwork, networkId);
      
      // Switch to new network
      await userNetworkService.setUserNetwork(chatId, networkId);
      
      const networkName = multiChainService.getNetworkDisplayName(networkId);
      const networkEmoji = multiChainService.getNetworkEmoji(networkId);
      
      await ctx.answerCbQuery(`${networkEmoji} Переключено на ${networkName}`);
      
      // Check if user has a wallet after switching
      const walletInfo = await multiChainWalletService.getMultiChainWalletInfo(chatId);
      
      if (!walletInfo.hasWallet) {
        // User doesn't have a wallet, suggest creating one
        const message = `🌐 СЕТЬ ПЕРЕКЛЮЧЕНА\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `${networkEmoji} Активная сеть: ${networkName}\n\n` +
                       `⚠️ У вас нет кошелька для этой сети\n\n` +
                       `💡 Создайте кошелек для работы с токенами в сети ${networkName}:\n` +
                       `• Хранение токенов\n` +
                       `• P2P торговля\n` +
                       `• Переводы`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('➕ Создать кошелек', 'create_wallet')],
          [Markup.button.callback('🔙 Назад к кабинету', 'personal_cabinet')]
        ]);
        
        await ctx.reply(message, keyboard);
      } else {
        // User has a wallet, show updated personal cabinet
        await this.handlePersonalCabinetText(ctx);
      }
      
    } catch (error) {
      console.error('Network switch error:', error);
      await ctx.answerCbQuery('❌ Ошибка переключения сети');
    }
  }
}

module.exports = WalletHandler;