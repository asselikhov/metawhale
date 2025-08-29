/**
 * ⚖️ ADMIN DISPUTE HANDLER
 * Professional moderator interface for dispute management
 */

const { Markup } = require('telegraf');
const { P2PTrade, User, DisputeLog, Moderator } = require('../database/models');
const disputeService = require('../services/dispute/disputeServiceInstance');
const sessionManager = require('./SessionManager');

class AdminDisputeHandler {
  constructor() {
    // Статусы для фильтрации
    this.FILTER_OPTIONS = {
      'all': '📊 Все споры',
      'open': '🔴 Новые споры',
      'investigating': '🔍 В работе',
      'awaiting_evidence': '📄 Ожидание доказательств',
      'under_review': '⚖️ На рассмотрении',
      'urgent': '🔥 Срочные'
    };

    // Типы решений
    this.RESOLUTION_TYPES = {
      'buyer_wins': '👨‍💼 Покупатель прав',
      'seller_wins': '👨‍💻 Продавец прав', 
      'compromise': '🤝 Компромисс',
      'no_fault': '❌ Вины нет',
      'insufficient_evidence': '📄 Недостаточно доказательств'
    };

    // Эмодзи для статусов
    this.STATUS_EMOJIS = {
      'open': '🔴', 'investigating': '🔍', 'awaiting_evidence': '📄',
      'under_review': '⚖️', 'resolved': '✅', 'escalated': '📈'
    };

    this.PRIORITY_EMOJIS = {
      'urgent': '🔥', 'high': '🔴', 'medium': '🟡', 'low': '🟢'
    };
  }

  /**
   * 📋 ГЛАВНОЕ МЕНЮ МОДЕРАТОРА
   */
  async showModeratorDashboard(ctx) {
    try {
      const chatId = ctx.chat.id.toString();
      
      // Проверяем права модератора
      const moderator = await this.validateModeratorAccess(chatId);
      if (!moderator) {
        return await ctx.reply('❌ У вас нет прав модератора.');
      }

      // Получаем статистику
      const stats = await this.getModeratorStats(moderator.userId._id);
      
      const message = `⚖️ ПАНЕЛЬ МОДЕРАТОРА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `👨‍⚖️ Модератор: ${moderator.userId.username || 'N/A'}\n` +
                     `📊 Активные споры: ${stats.activeDisputes}\n` +
                     `✅ Решено сегодня: ${stats.resolvedToday}\n` +
                     `📈 Средний рейтинг: ${stats.averageRating || 'N/A'}\n\n` +
                     `🎯 Быстрые действия:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Очередь споров', 'admin_dispute_queue')],
        [Markup.button.callback('🔥 Срочные споры', 'admin_urgent_disputes')],
        [Markup.button.callback('📊 Статистика', 'admin_dispute_stats')],
        [Markup.button.callback('⚙️ Настройки', 'admin_moderator_settings')],
        [Markup.button.callback('🔙 Главное меню', 'main_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Moderator dashboard error:', error);
      await ctx.reply('❌ Ошибка загрузки панели модератора.');
    }
  }

  /**
   * 📋 ОЧЕРЕДЬ СПОРОВ
   */
  async showDisputeQueue(ctx, filter = 'all', page = 0) {
    try {
      const chatId = ctx.chat.id.toString();
      const moderator = await this.validateModeratorAccess(chatId);
      
      if (!moderator) {
        return await ctx.reply('❌ Доступ запрещен.');
      }

      // Строим запрос в зависимости от фильтра
      let query = { status: 'disputed' };
      
      if (filter === 'urgent') {
        query.disputePriority = 'urgent';
      } else if (filter !== 'all') {
        query.disputeStatus = filter;
      }

      // Только споры, назначенные этому модератору или не назначенные
      if (filter !== 'all') {
        query.$or = [
          { moderatorId: moderator.userId._id },
          { moderatorId: { $exists: false } }
        ];
      }

      const disputes = await P2PTrade.find(query)
        .populate('buyerId', 'username chatId')
        .populate('sellerId', 'username chatId')
        .populate('moderatorId', 'username')
        .sort({ 'disputeTracking.openedAt': -1 })
        .skip(page * 5)
        .limit(5);

      if (disputes.length === 0) {
        const message = `📋 ОЧЕРЕДЬ СПОРОВ\n` +
                       `➖➖➖➖➖➖➖➖➖➖➖\n` +
                       `Фильтр: ${this.FILTER_OPTIONS[filter]}\n\n` +
                       `🎉 Нет споров для обработки!`;

        const keyboard = this.buildQueueNavigationKeyboard(filter, page, false);
        return await ctx.reply(message, keyboard);
      }

      let message = `📋 ОЧЕРЕДЬ СПОРОВ (${page + 1})\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Фильтр: ${this.FILTER_OPTIONS[filter]}\n\n`;

      disputes.forEach((dispute, index) => {
        const orderNumber = `CES${dispute.buyOrderId.toString().slice(-8)}`;
        const priority = this.PRIORITY_EMOJIS[dispute.disputePriority];
        const status = this.STATUS_EMOJIS[dispute.disputeStatus];
        
        const openedAt = new Date(dispute.disputeTracking.openedAt);
        const hoursAgo = Math.floor((Date.now() - openedAt.getTime()) / (1000 * 60 * 60));
        
        message += `${status} ${priority} ${orderNumber}\n`;
        message += `💰 ${dispute.totalValue.toFixed(0)} ₽ | ⏰ ${hoursAgo}ч\n`;
        message += `👨‍💼 ${dispute.buyerId.username || 'User'} ↔️ ${dispute.sellerId.username || 'User'}\n`;
        message += `🔗 /dispute_${dispute._id}\n\n`;
      });

      const keyboard = this.buildQueueNavigationKeyboard(filter, page, disputes.length === 5);
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Dispute queue error:', error);
      await ctx.reply('❌ Ошибка загрузки очереди споров.');
    }
  }

  /**
   * 🔍 ДЕТАЛЬНЫЙ ПРОСМОТР СПОРА
   */
  async showDisputeDetails(ctx, disputeId) {
    try {
      const chatId = ctx.chat.id.toString();
      const moderator = await this.validateModeratorAccess(chatId);
      
      if (!moderator) {
        return await ctx.reply('❌ Доступ запрещен.');
      }

      const dispute = await P2PTrade.findById(disputeId)
        .populate('buyerId', 'username chatId created_at')
        .populate('sellerId', 'username chatId created_at')
        .populate('moderatorId', 'username')
        .populate('disputeInitiatorId', 'username');

      if (!dispute || dispute.status !== 'disputed') {
        return await ctx.reply('❌ Спор не найден.');
      }

      const orderNumber = `CES${dispute.buyOrderId.toString().slice(-8)}`;
      
      let message = `🔍 ДЕТАЛИ СПОРА\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `ID: ${dispute._id}\n` +
                   `Ордер: ${orderNumber}\n` +
                   `Сумма: ${dispute.totalValue.toFixed(2)} ₽\n` +
                   `Количество: ${dispute.amount} CES\n\n` +
                   `📊 Информация:\n` +
                   `${this.STATUS_EMOJIS[dispute.disputeStatus]} Статус: ${this.formatStatus(dispute.disputeStatus)}\n` +
                   `${this.PRIORITY_EMOJIS[dispute.disputePriority]} Приоритет: ${dispute.disputePriority.toUpperCase()}\n` +
                   `📋 Категория: ${this.formatCategory(dispute.disputeCategory)}\n`;

      if (dispute.moderatorId) {
        message += `👨‍⚖️ Модератор: ${dispute.moderatorId.username}\n`;
      } else {
        message += `⏳ Модератор: не назначен\n`;
      }

      // Информация об участниках
      message += `\n👥 Участники:\n`;
      message += `🟦 Покупатель: ${dispute.buyerId.username || 'User'}\n`;
      message += `🟨 Продавец: ${dispute.sellerId.username || 'User'}\n`;
      message += `🚨 Инициатор: ${dispute.disputeInitiatorId.username || 'User'}\n`;

      // Временные метки
      if (dispute.disputeTracking) {
        const openedAt = new Date(dispute.disputeTracking.openedAt);
        const hoursAgo = Math.floor((Date.now() - openedAt.getTime()) / (1000 * 60 * 60));
        message += `\n⏰ Открыт: ${hoursAgo} ч. назад\n`;
        
        if (dispute.disputeTracking.escalatedAt) {
          const escalatedAt = new Date(dispute.disputeTracking.escalatedAt);
          const escalatedHours = Math.floor((Date.now() - escalatedAt.getTime()) / (1000 * 60 * 60));
          message += `📈 Эскалирован: ${escalatedHours} ч. назад\n`;
        }
      }

      // Краткое описание причины
      if (dispute.disputeReason) {
        message += `\n📝 Причина:\n"${dispute.disputeReason.substring(0, 100)}${dispute.disputeReason.length > 100 ? '...' : ''}"\n`;
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Доказательства', `admin_evidence_${disputeId}`)],
        [Markup.button.callback('⚖️ Решить спор', `admin_resolve_${disputeId}`)],
        [
          Markup.button.callback('👤 Связаться', `admin_contact_${disputeId}`),
          Markup.button.callback('📝 Заметки', `admin_notes_${disputeId}`)
        ],
        [Markup.button.callback('🔙 К очереди', 'admin_dispute_queue')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Dispute details error:', error);
      await ctx.reply('❌ Ошибка загрузки деталей спора.');
    }
  }

  // ========================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ========================

  /**
   * Проверка прав модератора
   */
  async validateModeratorAccess(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) return null;

      const moderator = await Moderator.findOne({ 
        userId: user._id, 
        isActive: true 
      }).populate('userId');
      
      return moderator;
    } catch (error) {
      console.error('Moderator validation error:', error);
      return null;
    }
  }

  /**
   * Построение клавиатуры навигации очереди
   */
  buildQueueNavigationKeyboard(filter, page, hasMore) {
    const buttons = [];
    
    // Фильтры
    const filterButtons = [
      Markup.button.callback('📊 Все', `admin_queue_all_0`),
      Markup.button.callback('🔴 Новые', `admin_queue_open_0`),
      Markup.button.callback('🔥 Срочные', `admin_queue_urgent_0`)
    ];
    buttons.push(filterButtons);
    
    // Навигация
    const navButtons = [];
    if (page > 0) {
      navButtons.push(Markup.button.callback('⬅️', `admin_queue_${filter}_${page - 1}`));
    }
    if (hasMore) {
      navButtons.push(Markup.button.callback('➡️', `admin_queue_${filter}_${page + 1}`));
    }
    if (navButtons.length > 0) {
      buttons.push(navButtons);
    }
    
    buttons.push([Markup.button.callback('🔙 Панель модератора', 'admin_moderator_dashboard')]);
    
    return Markup.inlineKeyboard(buttons);
  }

  /**
   * Форматирование статуса спора
   */
  formatStatus(status) {
    const statusNames = {
      'open': 'Открыт',
      'investigating': 'Расследование', 
      'awaiting_evidence': 'Ожидание доказательств',
      'under_review': 'На рассмотрении',
      'resolved': 'Решен',
      'escalated': 'Эскалирован'
    };
    return statusNames[status] || status;
  }

  /**
   * Форматирование категории спора
   */
  formatCategory(category) {
    const categories = {
      'payment_not_received': 'Платеж не получен',
      'payment_not_made': 'Покупатель не оплатил',
      'wrong_amount': 'Неверная сумма',
      'fraud_attempt': 'Попытка мошенничества',
      'technical_issue': 'Техническая проблема',
      'other': 'Другая проблема'
    };
    return categories[category] || category;
  }

  /**
   * Получение статистики модератора
   */
  async getModeratorStats(userId) {
    try {
      const activeDisputes = await P2PTrade.countDocuments({
        status: 'disputed',
        moderatorId: userId
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const resolvedToday = await P2PTrade.countDocuments({
        disputeStatus: 'resolved',
        moderatorId: userId,
        'disputeTracking.resolvedAt': { $gte: today }
      });

      const moderator = await Moderator.findOne({ userId });
      
      return {
        activeDisputes,
        resolvedToday,
        averageRating: moderator?.statistics?.successRate || 0
      };
    } catch (error) {
      console.error('Get moderator stats error:', error);
      return { activeDisputes: 0, resolvedToday: 0, averageRating: 0 };
    }
  }

  /**
   * 📄 ПРОСМОТР ДОКАЗАТЕЛЬСТВ
   */
  async showDisputeEvidence(ctx, disputeId) {
    try {
      const dispute = await P2PTrade.findById(disputeId);
      
      if (!dispute || !dispute.disputeEvidence) {
        return await ctx.reply('❌ Доказательства не найдены.');
      }

      const orderNumber = `CES${dispute.buyOrderId.toString().slice(-8)}`;
      
      let message = `📄 ДОКАЗАТЕЛЬСТВА\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Спор: ${orderNumber}\n\n`;

      // Доказательства покупателя
      if (dispute.disputeEvidence.buyerEvidence && dispute.disputeEvidence.buyerEvidence.length > 0) {
        message += `🟦 ПОКУПАТЕЛЬ (${dispute.disputeEvidence.buyerEvidence.length}):\n`;
        dispute.disputeEvidence.buyerEvidence.forEach((evidence, index) => {
          const submittedAt = new Date(evidence.submittedAt);
          message += `${index + 1}. [${evidence.type.toUpperCase()}] ${submittedAt.toLocaleString('ru')}\n`;
          if (evidence.description) {
            message += `   📝 ${evidence.description}\n`;
          }
          if (evidence.type === 'text' && evidence.content) {
            const preview = evidence.content.substring(0, 80);
            message += `   💬 "${preview}${evidence.content.length > 80 ? '...' : ''}"\n`;
          }
          message += `\n`;
        });
      }

      // Доказательства продавца
      if (dispute.disputeEvidence.sellerEvidence && dispute.disputeEvidence.sellerEvidence.length > 0) {
        message += `🟨 ПРОДАВЕЦ (${dispute.disputeEvidence.sellerEvidence.length}):\n`;
        dispute.disputeEvidence.sellerEvidence.forEach((evidence, index) => {
          const submittedAt = new Date(evidence.submittedAt);
          message += `${index + 1}. [${evidence.type.toUpperCase()}] ${submittedAt.toLocaleString('ru')}\n`;
          if (evidence.description) {
            message += `   📝 ${evidence.description}\n`;
          }
          if (evidence.type === 'text' && evidence.content) {
            const preview = evidence.content.substring(0, 80);
            message += `   💬 "${preview}${evidence.content.length > 80 ? '...' : ''}"\n`;
          }
          message += `\n`;
        });
      }

      if (!dispute.disputeEvidence.buyerEvidence?.length && !dispute.disputeEvidence.sellerEvidence?.length) {
        message += `📭 Доказательства еще не предоставлены.\n`;
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📝 Запросить доказательства', `admin_request_evidence_${disputeId}`)],
        [Markup.button.callback('⚖️ Решить спор', `admin_resolve_${disputeId}`)],
        [Markup.button.callback('🔙 К деталям', `admin_dispute_${disputeId}`)]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Evidence view error:', error);
      await ctx.reply('❌ Ошибка просмотра доказательств.');
    }
  }

  /**
   * ⚖️ ИНТЕРФЕЙС РАЗРЕШЕНИЯ СПОРА
   */
  async showResolutionInterface(ctx, disputeId) {
    try {
      const dispute = await P2PTrade.findById(disputeId)
        .populate('buyerId', 'username')
        .populate('sellerId', 'username');
      
      if (!dispute) {
        return await ctx.reply('❌ Спор не найден.');
      }

      const orderNumber = `CES${dispute.buyOrderId.toString().slice(-8)}`;
      
      const message = `⚖️ РАЗРЕШЕНИЕ СПОРА\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Спор: ${orderNumber}\n` +
                     `Сумма: ${dispute.totalValue.toFixed(2)} ₽\n` +
                     `Токены: ${dispute.amount} CES\n\n` +
                     `👥 Участники:\n` +
                     `🟦 ${dispute.buyerId.username || 'Покупатель'}\n` +
                     `🟨 ${dispute.sellerId.username || 'Продавец'}\n\n` +
                     `⚖️ Выберите решение:`;

      const buttons = Object.entries(this.RESOLUTION_TYPES).map(([key, title]) => [
        Markup.button.callback(title, `admin_resolution_${key}_${disputeId}`)
      ]);
      
      buttons.push([Markup.button.callback('🔙 К деталям', `admin_dispute_${disputeId}`)]);
      
      const keyboard = Markup.inlineKeyboard(buttons);
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Resolution interface error:', error);
      await ctx.reply('❌ Ошибка интерфейса разрешения.');
    }
  }

  /**
   * 📝 ПОДТВЕРЖДЕНИЕ РЕШЕНИЯ
   */
  async confirmResolution(ctx, resolution, disputeId) {
    try {
      const dispute = await P2PTrade.findById(disputeId)
        .populate('buyerId', 'username')
        .populate('sellerId', 'username');
      
      if (!dispute) {
        return await ctx.reply('❌ Спор не найден.');
      }

      const orderNumber = `CES${dispute.buyOrderId.toString().slice(-8)}`;
      const resolutionTitle = this.RESOLUTION_TYPES[resolution];
      
      let message = `📋 ПОДТВЕРЖДЕНИЕ РЕШЕНИЯ\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Спор: ${orderNumber}\n` +
                   `Решение: ${resolutionTitle}\n\n`;

      // Описываем последствия решения
      switch (resolution) {
        case 'buyer_wins':
          message += `✅ Результат:\n`;
          message += `• Покупатель получает токены\n`;
          message += `• Продавец не получает оплату\n`;
          break;
        case 'seller_wins':
          message += `✅ Результат:\n`;
          message += `• Токены возвращаются продавцу\n`;
          message += `• Покупатель не получает возврат\n`;
          break;
        case 'compromise':
          message += `⚖️ Необходимо указать сумму компенсации\n`;
          break;
        case 'no_fault':
          message += `✅ Результат:\n`;
          message += `• Токены возвращаются продавцу\n`;
          message += `• Вины сторон не установлено\n`;
          break;
        case 'insufficient_evidence':
          message += `✅ Результат:\n`;
          message += `• Токены возвращаются продавцу\n`;
          message += `• Недостаточно доказательств\n`;
          break;
      }

      message += `\n💡 Напишите заметки для решения (необязательно):`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', `admin_execute_${resolution}_${disputeId}`)],
        [Markup.button.callback('✏️ Изменить решение', `admin_resolve_${disputeId}`)],
        [Markup.button.callback('❌ Отмена', `admin_dispute_${disputeId}`)]
      ]);
      
      sessionManager.setSessionData(ctx.chat.id.toString(), 'awaitingResolutionNotes', true);
      sessionManager.setSessionData(ctx.chat.id.toString(), 'pendingResolution', { resolution, disputeId });
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Resolution confirmation error:', error);
      await ctx.reply('❌ Ошибка подтверждения решения.');
    }
  }

  /**
   * 💾 ВЫПОЛНЕНИЕ РЕШЕНИЯ СПОРА
   */
  async executeResolution(ctx, resolution, disputeId, notes = '') {
    try {
      const chatId = ctx.chat.id.toString();
      const moderator = await this.validateModeratorAccess(chatId);
      
      if (!moderator) {
        return await ctx.reply('❌ Доступ запрещен.');
      }

      const result = await disputeService.resolveDispute(
        disputeId, 
        chatId, 
        resolution, 
        null, // compensationAmount - можно расширить позже
        notes
      );

      if (!result.success) {
        return await ctx.reply(`❌ Ошибка разрешения спора: ${result.error}`);
      }

      // Очищаем данные сессии
      sessionManager.clearSessionData(chatId, 'awaitingResolutionNotes');
      sessionManager.clearSessionData(chatId, 'pendingResolution');

      const dispute = await P2PTrade.findById(disputeId);
      const orderNumber = `CES${dispute.buyOrderId.toString().slice(-8)}`;
      
      const message = `✅ СПОР РАЗРЕШЕН\n` +
                     `➖➖➖➖➖➖➖➖➖➖➖\n` +
                     `Спор: ${orderNumber}\n` +
                     `Решение: ${this.RESOLUTION_TYPES[resolution]}\n` +
                     `Модератор: ${moderator.userId.username}\n\n` +
                     `📤 Уведомления отправлены участникам\n` +
                     `📊 Статистика обновлена`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 К очереди споров', 'admin_dispute_queue')],
        [Markup.button.callback('📊 Статистика', 'admin_dispute_stats')],
        [Markup.button.callback('🏠 Главная', 'main_menu')]
      ]);
      
      await ctx.reply(message, keyboard);
      
    } catch (error) {
      console.error('Execute resolution error:', error);
      await ctx.reply('❌ Ошибка выполнения решения спора.');
    }
  }

  /**
   * 📝 ОБРАБОТКА ТЕКСТОВЫХ ЗАМЕТОК
   */
  async processTextInput(ctx, text) {
    try {
      const chatId = ctx.chat.id.toString();
      
      if (sessionManager.getSessionData(chatId, 'awaitingResolutionNotes')) {
        const pendingResolution = sessionManager.getSessionData(chatId, 'pendingResolution');
        if (pendingResolution) {
          await this.executeResolution(ctx, pendingResolution.resolution, pendingResolution.disputeId, text);
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('Admin dispute text input error:', error);
      return false;
    }
  }
}

module.exports = AdminDisputeHandler;