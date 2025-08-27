/**
 * 🚨 PROFESSIONAL DISPUTE HANDLER
 * User-facing interface for dispute management
 */

const { Markup } = require('telegraf');
const { P2PTrade, User, DisputeLog } = require('../database/models');
const disputeService = require('../services/disputeService');
const sessionManager = require('./SessionManager');

class DisputeHandler {
  constructor() {
    // Категории споров с понятными описаниями
    this.DISPUTE_CATEGORIES = {
      'payment_not_received': {
        title: '💸 Платеж не получен',
        description: 'Я отправил деньги, но продавец не подтверждает получение',
        priority: 'high'
      },
      'payment_not_made': {
        title: '⏰ Покупатель не оплатил',
        description: 'Прошло время оплаты, но деньги не поступили',
        priority: 'high'
      },
      'wrong_amount': {
        title: '💰 Неверная сумма',
        description: 'Переведена неправильная сумма денег',
        priority: 'medium'
      },
      'fraud_attempt': {
        title: '🚨 Попытка мошенничества',
        description: 'Подозрительное поведение или обман',
        priority: 'urgent'
      },
      'technical_issue': {
        title: '🔧 Техническая проблема',
        description: 'Ошибка системы или технические неполадки',
        priority: 'medium'
      },
      'other': {
        title: '❓ Другая проблема',
        description: 'Иная проблема, не указанная выше',
        priority: 'medium'
      }
    };

    this.STATUS_EMOJIS = {
      'open': '🔴', 'investigating': '🔍', 'awaiting_evidence': '📄',
      'under_review': '⚖️', 'resolved': '✅', 'escalated': '📈'
    };

    this.PRIORITY_EMOJIS = {
      'urgent': '🔥', 'high': '🔴', 'medium': '🟡', 'low': '🟢'
    };
  }

  /**
   * 🚨 ИНИЦИАЦИЯ СПОРА - Главное меню
   */
  async handleInitiateDispute(ctx, tradeId = null) {
    try {
      const chatId = ctx.chat.id.toString();
      
      if (!tradeId) {
        tradeId = sessionManager.getSessionData(chatId, 'tradeId');
      }
      
      if (!tradeId) {
        return await ctx.reply('❌ Сделка не найдена. Попробуйте еще раз.');
      }

      const trade = await P2PTrade.findById(tradeId).populate('buyerId').populate('sellerId');
      if (!trade) {
        return await ctx.reply('❌ Сделка не найдена.');
      }

      const user = await User.findOne({ chatId });
      const canInitiate = await disputeService.validateDisputeRights(trade, user._id);
      
      if (!canInitiate.allowed) {
        const message = `🚫 СПОР НЕДОСТУПЕН\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `${canInitiate.reason}\n\n` +
                       `💡 Обратитесь в поддержку, если считаете это ошибкой.`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📞 Связаться с поддержкой', 'contact_support')],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);
        
        return await ctx.reply(message, keyboard);
      }

      await this.showDisputeCategorySelection(ctx, trade);
      
    } catch (error) {
      console.error('Dispute initiation error:', error);
      await ctx.reply('❌ Ошибка инициации спора.');
    }
  }

  /**
   * 📋 ВЫБОР КАТЕГОРИИ СПОРА
   */
  async showDisputeCategorySelection(ctx, trade) {
    try {
      const orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
      
      const message = `🚨 ОТКРЫТИЕ СПОРА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ордер: ${orderNumber}\n` +
                     `Сумма: ${trade.totalValue.toFixed(2)} ₽\n` +
                     `Количество: ${trade.amount} CES\n\n` +
                     `📋 Выберите категорию проблемы:\n\n` +
                     `⚠️ Убедитесь, что выбрали правильную категорию.`;

      const buttons = [];
      
      Object.entries(this.DISPUTE_CATEGORIES).forEach(([key, category]) => {
        const emoji = this.PRIORITY_EMOJIS[category.priority];
        buttons.push([Markup.button.callback(
          `${emoji} ${category.title}`, 
          `dispute_category_${key}_${trade._id}`
        )]);
      });
      
      buttons.push([Markup.button.callback('🔙 Отмена', 'p2p_menu')]);
      
      const keyboard = Markup.inlineKeyboard(buttons);
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Show category selection error:', error);
      await ctx.reply('❌ Ошибка отображения категорий.');
    }
  }

  /**
   * 📝 ОБРАБОТКА ВЫБОРА КАТЕГОРИИ
   */
  async handleCategorySelection(ctx, category, tradeId) {
    try {
      const chatId = ctx.chat.id.toString();
      
      sessionManager.setSessionData(chatId, 'disputeCategory', category);
      sessionManager.setSessionData(chatId, 'disputeTradeId', tradeId);
      
      const categoryInfo = this.DISPUTE_CATEGORIES[category];
      
      const message = `📝 ОПИСАНИЕ ПРОБЛЕМЫ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Категория: ${categoryInfo.title}\n\n` +
                     `📄 Опишите проблему подробно:\n` +
                     `• Что именно произошло?\n` +
                     `• Какие действия вы предпринимали?\n` +
                     `• Есть ли у вас доказательства?\n\n` +
                     `✍️ Напишите ваше сообщение:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Изменить категорию', `dispute_categories_${tradeId}`)],
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      sessionManager.setSessionData(chatId, 'awaitingDisputeDescription', true);
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Category selection error:', error);
      await ctx.reply('❌ Ошибка обработки категории.');
    }
  }

  /**
   * 📄 ОБРАБОТКА ОПИСАНИЯ СПОРА
   */
  async handleDisputeDescription(ctx, description) {
    try {
      const chatId = ctx.chat.id.toString();
      
      const category = sessionManager.getSessionData(chatId, 'disputeCategory');
      const tradeId = sessionManager.getSessionData(chatId, 'disputeTradeId');
      
      if (!category || !tradeId) {
        return await ctx.reply('❌ Данные спора не найдены. Начните заново.');
      }

      sessionManager.setSessionData(chatId, 'awaitingDisputeDescription', false);
      await this.showDisputeConfirmation(ctx, tradeId, category, description);
      
    } catch (error) {
      console.error('Dispute description error:', error);
      await ctx.reply('❌ Ошибка обработки описания.');
    }
  }

  /**
   * ✅ ПОДТВЕРЖДЕНИЕ СПОРА
   */
  async showDisputeConfirmation(ctx, tradeId, category, description) {
    try {
      const trade = await P2PTrade.findById(tradeId);
      const categoryInfo = this.DISPUTE_CATEGORIES[category];
      const orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
      
      const message = `✅ ПОДТВЕРЖДЕНИЕ СПОРА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ордер: ${orderNumber}\n` +
                     `Категория: ${categoryInfo.title}\n` +
                     `Приоритет: ${this.PRIORITY_EMOJIS[categoryInfo.priority]} ${categoryInfo.priority.toUpperCase()}\n\n` +
                     `📝 Ваше описание:\n` +
                     `"${description}"\n\n` +
                     `⏰ Ожидаемое время: ${this.getEstimatedTime(categoryInfo.priority)}\n\n` +
                     `📤 Отправить спор?`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Подтвердить и отправить', `confirm_dispute_${tradeId}_${category}`)],
        [Markup.button.callback('✏️ Изменить описание', `edit_description_${tradeId}_${category}`)],
        [Markup.button.callback('❌ Отмена', 'p2p_menu')]
      ]);
      
      const chatId = ctx.chat.id.toString();
      sessionManager.setSessionData(chatId, 'disputeDescription', description);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Dispute confirmation error:', error);
      await ctx.reply('❌ Ошибка подтверждения спора.');
    }
  }

  /**
   * 📝 ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ
   */
  async processTextInput(ctx, text) {
    try {
      const chatId = ctx.chat.id.toString();
      
      if (sessionManager.getSessionData(chatId, 'awaitingDisputeDescription')) {
        await this.handleDisputeDescription(ctx, text);
        return true;
      }
      
      if (sessionManager.getSessionData(chatId, 'awaitingEvidenceText')) {
        await this.handleTextEvidence(ctx, text);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Dispute text input error:', error);
      return false;
    }
  }

  // Вспомогательные методы
  getEstimatedTime(priority) {
    const times = {
      'urgent': '2-4 часа', 'high': '4-12 часов',
      'medium': '12-24 часа', 'low': '24-48 часов'
    };
    return times[priority] || '24-48 часов';
  }

  formatStatus(status) {
    const statusNames = {
      'open': 'Открыт', 'investigating': 'Расследование',
      'awaiting_evidence': 'Ожидание доказательств',
      'under_review': 'На рассмотрении', 'resolved': 'Решен', 'escalated': 'Эскалирован'
    };
    return statusNames[status] || status;
  }

  /**
   * 🚀 ФИНАЛЬНАЯ ОТПРАВКА СПОРА
   */
  async confirmDispute(ctx, tradeId, category) {
    try {
      const chatId = ctx.chat.id.toString();
      const description = sessionManager.getSessionData(chatId, 'disputeDescription');
      
      if (!description) {
        return await ctx.reply('❌ Описание спора не найдено.');
      }

      const result = await disputeService.initiateDispute(
        tradeId, chatId, category, description, this.DISPUTE_CATEGORIES[category].priority
      );

      if (!result.success) {
        return await ctx.reply(`❌ Ошибка создания спора: ${result.error}`);
      }

      // Очищаем данные сессии
      sessionManager.clearSessionData(chatId, 'disputeCategory');
      sessionManager.clearSessionData(chatId, 'disputeTradeId');
      sessionManager.clearSessionData(chatId, 'disputeDescription');

      const trade = await P2PTrade.findById(tradeId);
      const orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
      
      const message = `✅ СПОР ОТКРЫТ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Спор ID: ${result.disputeId}\n` +
                     `Ордер: ${orderNumber}\n` +
                     `Приоритет: ${this.PRIORITY_EMOJIS[result.priority]} ${result.priority.toUpperCase()}\n\n` +
                     `📋 Что происходит дальше:\n` +
                     `${result.moderatorAssigned ? '✅' : '⏳'} Модератор ${result.moderatorAssigned ? 'назначен' : 'будет назначен'}\n` +
                     `⏰ Ожидаемое время: ${result.estimatedResolutionTime}\n` +
                     `📱 Уведомления будут приходить в бот`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Добавить доказательства', `add_evidence_${tradeId}`)],
        [Markup.button.callback('📊 Статус спора', `dispute_status_${tradeId}`)],
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      await this.notifyOtherParticipants(trade, chatId);
      
    } catch (error) {
      console.error('Confirm dispute error:', error);
      await ctx.reply('❌ Ошибка создания спора. Попробуйте позже.');
    }
  }

  /**
   * 📄 ДОБАВЛЕНИЕ ДОКАЗАТЕЛЬСТВ
   */
  async handleAddEvidence(ctx, tradeId) {
    try {
      const trade = await P2PTrade.findById(tradeId);
      
      if (!trade || trade.status !== 'disputed') {
        return await ctx.reply('❌ Спор не найден или неактивен.');
      }

      const orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
      
      const message = `📄 ДОБАВЛЕНИЕ ДОКАЗАТЕЛЬСТВ\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Спор: ${orderNumber}\n` +
                     `Статус: ${this.STATUS_EMOJIS[trade.disputeStatus]} ${this.formatStatus(trade.disputeStatus)}\n\n` +
                     `📎 Типы доказательств:\n` +
                     `• 💬 Текстовое описание\n` +
                     `• 📸 Скриншоты\n\n` +
                     `Выберите тип доказательства:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💬 Текст', `evidence_text_${tradeId}`)],
        [Markup.button.callback('📸 Изображение', `evidence_image_${tradeId}`)],
        [Markup.button.callback('📊 Статус спора', `dispute_status_${tradeId}`)],
        [Markup.button.callback('🔙 Назад', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Add evidence error:', error);
      await ctx.reply('❌ Ошибка добавления доказательств.');
    }
  }

  /**
   * 📊 ОТОБРАЖЕНИЕ СТАТУСА СПОРА
   */
  async handleDisputeStatus(ctx, tradeId) {
    try {
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId').populate('sellerId').populate('moderatorId');
        
      if (!trade || trade.status !== 'disputed') {
        return await ctx.reply('❌ Спор не найден или неактивен.');
      }

      const orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
      const chatId = ctx.chat.id.toString();
      const user = await User.findOne({ chatId });
      
      const userRole = trade.buyerId._id.toString() === user._id.toString() ? 'покупатель' : 'продавец';
      
      const recentLogs = await DisputeLog.find({ tradeId })
        .sort({ timestamp: -1 }).limit(5);

      let message = `📊 СТАТУС СПОРА\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Спор ID: ${tradeId}\n` +
                   `Ордер: ${orderNumber}\n` +
                   `Ваша роль: ${userRole}\n\n` +
                   `🔍 Статус: ${this.STATUS_EMOJIS[trade.disputeStatus]} ${this.formatStatus(trade.disputeStatus)}\n` +
                   `📈 Приоритет: ${this.PRIORITY_EMOJIS[trade.disputePriority]} ${trade.disputePriority.toUpperCase()}\n`;

      if (trade.moderatorId) {
        message += `👨‍⚖️ Модератор: назначен\n`;
      } else {
        message += `⏳ Модератор: ожидание назначения\n`;
      }

      if (trade.disputeTracking) {
        const openedAt = new Date(trade.disputeTracking.openedAt);
        const hoursElapsed = Math.floor((Date.now() - openedAt.getTime()) / (1000 * 60 * 60));
        message += `⏰ Время с открытия: ${hoursElapsed} ч.\n`;
      }

      if (trade.disputeEvidence) {
        const buyerEvidenceCount = trade.disputeEvidence.buyerEvidence?.length || 0;
        const sellerEvidenceCount = trade.disputeEvidence.sellerEvidence?.length || 0;
        message += `\n📄 Доказательства:\n`;
        message += `  • Покупатель: ${buyerEvidenceCount} шт.\n`;
        message += `  • Продавец: ${sellerEvidenceCount} шт.\n`;
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Добавить доказательства', `add_evidence_${trade._id}`)],
        [Markup.button.callback('🔄 Обновить статус', `dispute_status_${trade._id}`)],
        [Markup.button.callback('📞 Связаться с поддержкой', 'contact_support')],
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Dispute status error:', error);
      await ctx.reply('❌ Ошибка получения статуса спора.');
    }
  }

  /**
   * Обработка текстовых доказательств
   */
  async handleTextEvidence(ctx, text) {
    try {
      const chatId = ctx.chat.id.toString();
      const tradeId = sessionManager.getSessionData(chatId, 'evidenceTradeId');
      
      if (!tradeId) {
        return await ctx.reply('❌ Данные спора не найдены.');
      }

      await disputeService.submitEvidence(tradeId, chatId, 'text', text, 'Текстовое доказательство');
      
      sessionManager.setSessionData(chatId, 'awaitingEvidenceText', false);
      sessionManager.clearSessionData(chatId, 'evidenceTradeId');
      
      const message = `✅ ДОКАЗАТЕЛЬСТВО ДОБАВЛЕНО\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Ваше текстовое доказательство успешно добавлено к спору.\n\n` +
                     `📋 Модератор рассмотрит предоставленную информацию.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Добавить еще', `add_evidence_${tradeId}`)],
        [Markup.button.callback('📊 Статус спора', `dispute_status_${tradeId}`)],
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Text evidence error:', error);
      await ctx.reply('❌ Ошибка добавления доказательства.');
    }
  }

  /**
   * Уведомление других участников о споре
   */
  async notifyOtherParticipants(trade, initiatorChatId) {
    try {
      const orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
      const bot = require('../bot/telegramBot').getInstance();
      
      const participants = [trade.buyerId.chatId, trade.sellerId.chatId]
        .filter(chatId => chatId !== initiatorChatId);
      
      for (const chatId of participants) {
        const message = `🚨 ОТКРЫТ СПОР\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `Ордер: ${orderNumber}\n` +
                       `Сумма: ${trade.totalValue.toFixed(2)} ₽\n\n` +
                       `По данной сделке второй участник открыл спор.\n` +
                       `Сделка временно заморожена до разрешения.`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📊 Статус спора', `dispute_status_${trade._id}`)],
          [Markup.button.callback('📄 Добавить доказательства', `add_evidence_${trade._id}`)],
          [Markup.button.callback('📞 Поддержка', 'contact_support')]
        ]);

        try {
          await bot.telegram.sendMessage(chatId, message, {
            reply_markup: keyboard.reply_markup
          });
        } catch (notifyError) {
          console.error(`Failed to notify participant ${chatId}:`, notifyError);
        }
      }
      
    } catch (error) {
      console.error('Error notifying participants:', error);
    }
  }
}

module.exports = DisputeHandler;