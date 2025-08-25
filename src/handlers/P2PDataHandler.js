/**
 * P2P Data Handler
 * Handles P2P profile data management including editing, payment methods, and user information
 */

const { Markup } = require('telegraf');
const { User } = require('../database/models');
const sessionManager = require('./SessionManager');

class P2PDataHandler {
  // Handle edit data menu
  async handleP2PEditData(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      const message = '✏️ РЕДАКТИРОВАНИЕ ДАННЫХ\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👤 ФИО', 'p2p_edit_fullname')],
        [Markup.button.callback('💳 Способы оплаты', 'p2p_edit_payment_methods')],
        [Markup.button.callback('📞 Контакт', 'p2p_edit_contact')],
        [Markup.button.callback('⚙️ Условия мейкера', 'p2p_edit_conditions')],
        [Markup.button.callback('🔙 Назад', 'p2p_my_data')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('P2P Edit Data error:', error);
      await ctx.reply('❌ Ошибка загрузки меню редактирования.');
    }
  }

  // Handle full name editing
  async handleP2PEditFullName(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      const message = '👤 РЕДАКТИРОВАНИЕ ФИО\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n\n' +
                     '⚠️ Введите ваше ФИО так, как оно указано в банке\n\n' +
                     '💡 Пример: Иванов Иван Иванович';
      
      // Set session state for text input
      sessionManager.setSessionData(chatId, 'editingField', 'fullName');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_edit_data')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Edit full name error:', error);
      await ctx.reply('❌ Ошибка редактирования ФИО.');
    }
  }

  // Handle payment methods editing
  async handleP2PEditPaymentMethods(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      const profile = user.p2pProfile || {};
      const selectedBanks = profile.paymentMethods || [];
      
      const bankNames = {
        'sberbank': 'Сбербанк',
        'vtb': 'ВТБ',
        'gazprombank': 'Газпромбанк',
        'alfabank': 'Альфа-Банк',
        'rshb': 'Россельхозбанк (РСХБ)',
        'mkb': 'Моск. кред. банк (МКБ)',
        'sovcombank': 'Совкомбанк',
        'tbank': 'Т-банк',
        'domrf': 'ДОМ.РФ',
        'otkritie': 'Открытие',
        'raiffeisenbank': 'Райффайзенбанк',
        'rosbank': 'Росбанк'
      };
      
      let message = '💳 СПОСОБЫ ОПЛАТЫ\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n';
      
      const buttons = [];
      
      // Create buttons for each bank
      Object.keys(bankNames).forEach(bankCode => {
        const isSelected = selectedBanks.some(method => method.bank === bankCode && method.isActive);
        const emoji = isSelected ? '✅' : '❌';
        const bankName = bankNames[bankCode];
        
        buttons.push([Markup.button.callback(`${emoji} ${bankName}`, `p2p_toggle_bank_${bankCode}`)]);
      });
      
      // Add save button if at least one bank is selected
      const hasSelectedBanks = selectedBanks.some(method => method.isActive);
      if (hasSelectedBanks) {
        buttons.push([Markup.button.callback('💾 Сохранить и указать реквизиты', 'p2p_save_payment_methods')]);
      }
      
      buttons.push([Markup.button.callback('🔙 Назад', 'p2p_edit_data')]);
      
      const keyboard = Markup.inlineKeyboard(buttons);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Edit payment methods error:', error);
      await ctx.reply('❌ Ошибка редактирования способов оплаты.');
    }
  }

  // Handle bank toggle
  async handleP2PToggleBank(ctx, bankCode) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Initialize profile if not exists
      if (!user.p2pProfile) {
        user.p2pProfile = {};
      }
      
      if (!user.p2pProfile.paymentMethods) {
        user.p2pProfile.paymentMethods = [];
      }
      
      // Find existing method or create new
      let existingMethod = user.p2pProfile.paymentMethods.find(method => method.bank === bankCode);
      
      if (existingMethod) {
        // Toggle existing method
        existingMethod.isActive = !existingMethod.isActive;
      } else {
        // Add new method
        user.p2pProfile.paymentMethods.push({
          bank: bankCode,
          cardNumber: '',
          isActive: true
        });
      }
      
      await user.save();
      
      // Refresh the payment methods menu
      await this.handleP2PEditPaymentMethods(ctx);
      
    } catch (error) {
      console.error('Toggle bank error:', error);
      await ctx.reply('❌ Ошибка изменения банка.');
    }
  }

  // Handle saving payment methods and requesting card details
  async handleP2PSavePaymentMethods(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      if (!user || !user.p2pProfile || !user.p2pProfile.paymentMethods) {
        return await ctx.reply('❌ Данные не найдены.');
      }
      
      const activeMethods = user.p2pProfile.paymentMethods.filter(method => method.isActive);
      
      if (activeMethods.length === 0) {
        return await ctx.reply('❌ Выберите хотя бы один банк.');
      }
      
      const bankNames = {
        'sberbank': 'Сбербанк',
        'vtb': 'ВТБ',
        'gazprombank': 'Газпромбанк',
        'alfabank': 'Альфа-Банк',
        'rshb': 'Россельхозбанк (РСХБ)',
        'mkb': 'Моск. кред. банк (МКБ)',
        'sovcombank': 'Совкомбанк',
        'tbank': 'Т-банк',
        'domrf': 'ДОМ.РФ',
        'otkritie': 'Открытие',
        'raiffeisenbank': 'Райффайзенбанк',
        'rosbank': 'Росбанк'
      };
      
      let message = '💳 УКАЗАНИЕ РЕКВИЗИТОВ\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n' +
                   'Введите реквизиты для выбранных способов оплаты.\n\n';
      
      activeMethods.forEach(method => {
        const bankName = bankNames[method.bank];
        message += `💳 ${bankName} — укажите номер карты или счёта.\n`;
      });
      
      message += '\nФормат ввода:\n';
      message += 'Банк: номер карты\n';
      message += 'Пример:\n';
      message += 'Сбербанк: 5469 1234 5678 9012\n';
      message += 'ВТБ: 2200 5678 9012 3456';
      
      // Set session for card input
      sessionManager.setSessionData(chatId, 'editingField', 'cardNumbers');
      sessionManager.setSessionData(chatId, 'activeBanks', activeMethods.map(m => m.bank));
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_edit_payment_methods')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Save payment methods error:', error);
      await ctx.reply('❌ Ошибка сохранения способов оплаты.');
    }
  }

  // Handle contact editing
  async handleP2PEditContact(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      const message = '📞 РЕДАКТИРОВАНИЕ КОНТАКТА\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n\n' +
                     '⚠️ Укажите ваш номер телефона\n\n' +
                     '💡 Пример: +79001234567';
      
      // Set session state for text input
      sessionManager.setSessionData(chatId, 'editingField', 'contactInfo');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_edit_data')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Edit contact error:', error);
      await ctx.reply('❌ Ошибка редактирования контакта.');
    }
  }

  // Handle conditions editing
  async handleP2PEditConditions(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      const message = '⚙️ УСЛОВИЯ МЕЙКЕРА\n' +
                     '➖➖➖➖➖➖➖➖➖➖➖\n\n' +
                     '⚠️ Укажите условия, которые увидит контрагент\n\n' +
                     '💡 Пример:\n' +
                     '• Переводы только с личного счёта\n' +
                     '• Не использовать переводы от юрлиц\n' +
                     '• Быстрая оплата в течение 15 минут';
      
      // Set session state for text input
      sessionManager.setSessionData(chatId, 'editingField', 'makerConditions');
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'p2p_edit_data')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Edit conditions error:', error);
      await ctx.reply('❌ Ошибка редактирования условий.');
    }
  }

  // Handle toggle use in orders
  async handleP2PToggleUseInOrders(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      if (!user) {
        return await ctx.reply('❌ Пользователь не найден.');
      }
      
      // Initialize profile if not exists
      if (!user.p2pProfile) {
        user.p2pProfile = {};
      }
      
      // Toggle use in orders
      user.p2pProfile.useInOrders = !user.p2pProfile.useInOrders;
      await user.save();
      
      const status = user.p2pProfile.useInOrders ? 'включено' : 'отключено';
      await ctx.reply(`✅ Использование данных в ордерах ${status}.`);
      
      // Refresh my data view
      setTimeout(async () => {
        const P2PHandler = require('./P2PHandler');
        const handler = new P2PHandler();
        await handler.handleP2PMyData(ctx);
      }, 1000);
      
    } catch (error) {
      console.error('Toggle use in orders error:', error);
      await ctx.reply('❌ Ошибка изменения настройки.');
    }
  }

  // Handle buyer view
  async handleP2PBuyerView(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      if (!user || !user.p2pProfile) {
        return await ctx.reply('❌ Профиль не найден.');
      }
      
      const profile = user.p2pProfile;
      
      let message = '👀 КАК ВИДЯТ ПОКУПАТЕЛИ\n' +
                   '➖➖➖➖➖➖➖➖➖➖➖\n' +
                   `ФИО: ${profile.fullName || 'Не указано'}\n` +
                   `Контакт: ${profile.contactInfo || 'Не указано'}\n\n` +
                   '💳 Способы оплаты:\n';
      
      if (profile.paymentMethods && profile.paymentMethods.length > 0) {
        const bankNames = {
          'sberbank': 'Сбербанк',
          'vtb': 'ВТБ',
          'gazprombank': 'Газпромбанк',
          'alfabank': 'Альфа-Банк',
          'rshb': 'Россельхозбанк',
          'mkb': 'МКБ',
          'sovcombank': 'Совкомбанк',
          'tbank': 'Т-банк',
          'domrf': 'ДОМ.РФ',
          'otkritie': 'Открытие',
          'raiffeisenbank': 'Райффайзенбанк',
          'rosbank': 'Росбанк'
        };
        
        const activeMethods = profile.paymentMethods.filter(pm => pm.isActive);
        activeMethods.forEach(pm => {
          const bankName = bankNames[pm.bank];
          message += `${bankName}: ${pm.cardNumber || 'Не указано'}\n`;
        });
      } else {
        message += 'Не указано\n';
      }
      
      if (profile.makerConditions) {
        message += `\n⚙️ Условия: \n${profile.makerConditions}`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к данным', 'p2p_my_data')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Buyer view error:', error);
      await ctx.reply('❌ Ошибка отображения данных.');
    }
  }

  // Process text input based on current editing field
  async processTextInput(ctx, text) {
    try {
      // Skip processing if this is a callback query (button press)
      if (ctx.callbackQuery) {
        console.log('📝 P2PDataHandler: Skipping text processing - this is a callback query');
        return false;
      }
      
      // Skip processing if no actual text message
      if (!ctx.message || !ctx.message.text) {
        return false;
      }
      
      const chatId = ctx.chat.id.toString();
      const editingField = sessionManager.getSessionData(chatId, 'editingField');
      
      if (!editingField) {
        return false; // Not handling text input - let main handler deal with menu buttons
      }
      
      // ONLY handle main menu buttons if we're actually in an editing session
      // Check for main menu buttons - handle them instead of treating as text input
      if (text.includes('Личный кабинет') || text.includes('👤')) {
        console.log('📝 P2PDataHandler: Detected main menu button - Personal Cabinet');
        sessionManager.clearUserSession(chatId);
        const BaseCommandHandler = require('./BaseCommandHandler');
        const WalletHandler = require('./WalletHandler');
        const handler = new WalletHandler();
        return await handler.handlePersonalCabinetText(ctx);
      }
      
      if (text.includes('P2P Биржа') || text.includes('🔄 P2P')) {
        console.log('📝 P2PDataHandler: Detected main menu button - P2P Exchange');
        sessionManager.clearUserSession(chatId);
        const P2PHandler = require('./P2PHandler');
        const handler = new P2PHandler();
        return await handler.handleP2PMenu(ctx);
      }
      
      const user = await User.findOne({ chatId });
      if (!user) {
        await ctx.reply('❌ Пользователь не найден.');
        return true;
      }
      
      // Initialize profile if not exists
      if (!user.p2pProfile) {
        user.p2pProfile = {};
      }
      
      switch (editingField) {
        case 'fullName':
          user.p2pProfile.fullName = text.trim();
          await user.save();
          sessionManager.setSessionData(chatId, 'editingField', null);
          await ctx.reply('✅ ФИО сохранено!');
          // Redirect back to edit data menu
          setTimeout(() => this.handleP2PEditData(ctx), 1000);
          break;
          
        case 'contactInfo':
          user.p2pProfile.contactInfo = text.trim();
          await user.save();
          sessionManager.setSessionData(chatId, 'editingField', null);
          await ctx.reply('✅ Контакт сохранен!');
          // Redirect back to edit data menu
          setTimeout(() => this.handleP2PEditData(ctx), 1000);
          break;
          
        case 'makerConditions':
          user.p2pProfile.makerConditions = text.trim();
          await user.save();
          sessionManager.setSessionData(chatId, 'editingField', null);
          await ctx.reply('✅ Условия сохранены!');
          // Redirect back to edit data menu
          setTimeout(() => this.handleP2PEditData(ctx), 1000);
          break;
          
        case 'cardNumbers':
          await this.processCardNumbers(ctx, text);
          break;
          
        default:
          return false;
      }
      
      // Check if profile is complete
      await this.checkProfileCompletion(user);
      
      return true;
      
    } catch (error) {
      console.error('Process text input error:', error);
      await ctx.reply('❌ Ошибка обработки данных.');
      return true;
    }
  }

  // Process card numbers input
  async processCardNumbers(ctx, text) {
    try {
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      const activeBanks = sessionManager.getSessionData(chatId, 'activeBanks');
      
      if (!user || !activeBanks) {
        return await ctx.reply('❌ Данные не найдены.');
      }
      
      const bankNames = {
        'sberbank': 'Сбербанк',
        'vtb': 'ВТБ',
        'gazprombank': 'Газпромбанк',
        'alfabank': 'Альфа-Банк',
        'rshb': 'Россельхозбанк',
        'mkb': 'МКБ',
        'sovcombank': 'Совкомбанк',
        'tbank': 'Т-банк',
        'domrf': 'ДОМ.РФ',
        'otkritie': 'Открытие',
        'raiffeisenbank': 'Райффайзенбанк',
        'rosbank': 'Росбанк'
      };
      
      // Parse card numbers from text
      const lines = text.split('\n');
      let saved = 0;
      
      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length === 2) {
          const bankName = parts[0].trim();
          const cardNumber = parts[1].trim();
          
          // Find bank code by name
          const bankCode = Object.keys(bankNames).find(code => 
            bankNames[code].toLowerCase() === bankName.toLowerCase()
          );
          
          if (bankCode && activeBanks.includes(bankCode)) {
            // Update card number
            const method = user.p2pProfile.paymentMethods.find(m => m.bank === bankCode);
            if (method) {
              method.cardNumber = cardNumber;
              saved++;
            }
          }
        }
      }
      
      if (saved > 0) {
        await user.save();
        sessionManager.setSessionData(chatId, 'editingField', null);
        sessionManager.setSessionData(chatId, 'activeBanks', null);
        await ctx.reply(`✅ Сохранено реквизитов: ${saved}`);
        // Redirect back to edit data menu
        setTimeout(() => this.handleP2PEditData(ctx), 1000);
      } else {
        await ctx.reply('❌ Не удалось распознать реквизиты. Проверьте формат.');
      }
      
    } catch (error) {
      console.error('Process card numbers error:', error);
      await ctx.reply('❌ Ошибка сохранения реквизитов.');
    }
  }

  // Check if profile is complete
  async checkProfileCompletion(user) {
    try {
      const profile = user.p2pProfile || {};
      
      // Conditions field is optional per user requirement
      const isComplete = profile.fullName && 
                        profile.contactInfo && 
                        profile.paymentMethods && 
                        profile.paymentMethods.some(pm => pm.isActive && pm.cardNumber);
      
      if (isComplete !== profile.isProfileComplete) {
        user.p2pProfile.isProfileComplete = isComplete;
        await user.save();
      }
      
    } catch (error) {
      console.error('Check profile completion error:', error);
    }
  }

  // Validate if user can create orders or interact with makers
  async validateUserForP2POperations(chatId) {
    try {
      const user = await User.findOne({ chatId });
      
      if (!user) {
        return {
          valid: false,
          message: '❌ Пользователь не найден.'
        };
      }
      
      const profile = user.p2pProfile || {};
      
      // Check if profile is complete (excluding makerConditions as it's optional)
      const isComplete = profile.fullName && 
                        profile.contactInfo && 
                        profile.paymentMethods && 
                        profile.paymentMethods.some(pm => pm.isActive && pm.cardNumber);
      
      if (!isComplete) {
        return {
          valid: false,
          message: '⚠️ Для создания ордеров необходимо заполнить данные\n' +
                  '💡 Перейдите в 📑 Мои данные и заполните:\n' +
                  '• ФИО\n' +
                  '• Контактную информацию\n' +
                  '• Способы оплаты с реквизитами',
          keyboard: [
            [{ text: '📑 Заполнить данные', callback_data: 'p2p_my_data' }],
            [{ text: '🔙 Назад', callback_data: 'p2p_menu' }]
          ]
        };
      }
      
      return {
        valid: true,
        user: user
      };
      
    } catch (error) {
      console.error('P2P validation error:', error);
      return {
        valid: false,
        message: '❌ Ошибка проверки данных.'
      };
    }
  }
}

module.exports = P2PDataHandler;