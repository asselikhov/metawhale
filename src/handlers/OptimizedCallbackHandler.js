/**
 * Optimized Callback Handler
 * Provides instant responses to button clicks with background processing
 */

const { Markup } = require('telegraf');
const backgroundService = require('../services/backgroundProcessingService');
const performanceMonitor = require('../services/performanceMonitorService');

class OptimizedCallbackHandler {
  constructor() {
    this.responseCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds cache
  }

  /**
   * Handle personal cabinet with instant response
   */
  async handlePersonalCabinetOptimized(ctx) {
    const chatId = ctx.chat.id.toString();
    const timer = performanceMonitor.startTiming('personal_cabinet', chatId);

    try {
      // Immediate response to user
      await ctx.answerCbQuery('⏳ Загружаем данные...');
      timer.end({ phase: 'instant_response' });
      console.log(`⚡ [OPTIMIZED] Instant response sent for personal_cabinet`);

      // Send loading message immediately
      const loadingTimer = performanceMonitor.startTiming('personal_cabinet_loading', chatId);
      const loadingMessage = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                           '➖➖➖➖➖➖➖➖➖➖➖\n' +
                           '⏳ Загружаем актуальные данные...';

      const sentMessage = await ctx.reply(loadingMessage);
      loadingTimer.end({ phase: 'loading_message_sent' });
      console.log(`⚡ [OPTIMIZED] Loading message sent`);

      // Process wallet data in background
      const backgroundTimer = performanceMonitor.startTiming('personal_cabinet_background', chatId);
      try {
        const walletData = await backgroundService.processWalletData(chatId);
        backgroundTimer.end({ phase: 'background_data_loaded', hasWallet: walletData.hasWallet });
        
        let finalMessage;
        let keyboard;

        if (walletData.hasWallet) {
          let cesBalanceText = `Баланс CES: ${walletData.cesBalance.toFixed(4)}`;
          if (walletData.escrowCESBalance > 0) {
            cesBalanceText += ` (в эскроу: ${walletData.escrowCESBalance.toFixed(4)})`;
          }
          cesBalanceText += ` • $ ${walletData.cesTotalUsd} • ₽ ${walletData.cesTotalRub}\n`;
          
          let polBalanceText = `Баланс POL: ${walletData.polBalance.toFixed(4)}`;
          if (walletData.escrowPOLBalance > 0) {
            polBalanceText += ` (в эскроу: ${walletData.escrowPOLBalance.toFixed(4)})`;
          }
          polBalanceText += ` • $ ${walletData.polTotalUsd} • ₽ ${walletData.polTotalRub}\n`;
          
          finalMessage = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                        '➖➖➖➖➖➖➖➖➖➖➖\n' +
                        cesBalanceText +
                        polBalanceText;

          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('💳 Кошелек', 'wallet_details')],
            [Markup.button.callback('💸 Перевод', 'transfer_menu')]
          ]);
        } else {
          finalMessage = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                        '➖➖➖➖➖➖➖➖➖➖➖\n' +
                        '⚠️ Кошелек не создан\n\n' +
                        '💡 Создайте кошелек для хранения токенов CES и POL';

          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('➕ Создать кошелек', 'create_wallet')]
          ]);
        }

        // Update the loading message with final data
        const updateTimer = performanceMonitor.startTiming('personal_cabinet_update', chatId);
        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          finalMessage,
          { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }
        );
        updateTimer.end({ phase: 'message_updated' });

        console.log(`✅ [OPTIMIZED] Personal cabinet updated`);

      } catch (backgroundError) {
        backgroundTimer.end({ phase: 'background_error', error: backgroundError.message });
        console.error('Background processing failed:', backgroundError);
        
        // Fallback message
        const errorMessage = '👤 ЛИЧНЫЙ КАБИНЕТ\n' +
                            '➖➖➖➖➖➖➖➖➖➖➖\n' +
                            '❌ Ошибка загрузки данных. Попробуйте позже.';

        const errorKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Повторить', 'personal_cabinet')]
        ]);

        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          errorMessage,
          { reply_markup: errorKeyboard.reply_markup }
        );
      }

    } catch (error) {
      timer.end({ phase: 'error', error: error.message });
      console.error('Optimized personal cabinet error:', error);
      
      try {
        await ctx.reply('❌ Ошибка загрузки личного кабинета. Попробуйте позже.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  /**
   * Handle P2P menu with instant response
   */
  async handleP2PMenuOptimized(ctx) {
    const startTime = Date.now();
    const chatId = ctx.chat.id.toString();

    try {
      // Immediate response to user
      await ctx.answerCbQuery('⏳ Загружаем P2P данные...');
      console.log(`⚡ [OPTIMIZED] Instant response sent for p2p_menu (${Date.now() - startTime}ms)`);

      // Send loading message immediately
      const loadingMessage = '🔄 P2P БИРЖА\n' +
                           '➖➖➖➖➖➖➖➖➖➖➖\n' +
                           '⏳ Загружаем данные...';

      const sentMessage = await ctx.reply(loadingMessage);
      console.log(`⚡ [OPTIMIZED] Loading message sent (${Date.now() - startTime}ms)`);

      // Process P2P data in background
      try {
        const p2pData = await backgroundService.processP2PData(chatId);
        
        const finalMessage = `🔄 P2P БИРЖА\n` +
                            `➖➖➖➖➖➖➖➖➖➖➖\n` +
                            `${p2pData.userName}\n` +
                            `Исполненные ордера за 30 дней: ${p2pData.stats.ordersLast30Days} шт.\n` +
                            `Процент исполнения за 30 дней: ${p2pData.stats.completionRateLast30Days}%\n` +
                            `Среднее время перевода: ${p2pData.stats.avgTransferTime} мин.\n` +
                            `Среднее время оплаты: ${p2pData.stats.avgPaymentTime} мин.\n` +
                            `Рейтинг: ${p2pData.stats.rating}`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📈 Купить CES', 'p2p_buy_ces'), Markup.button.callback('📉 Продать CES', 'p2p_sell_ces')],
          [Markup.button.callback('📊 Рынок', 'p2p_market_orders'), Markup.button.callback('📋 Мои ордера', 'p2p_my_orders')],
          [Markup.button.callback('🏆 Топ', 'p2p_top_traders'), Markup.button.callback('🧮 Аналитика', 'p2p_analytics')],
          [Markup.button.callback('📑 Мои данные', 'p2p_my_data')]
        ]);

        // Update the loading message with final data
        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          finalMessage,
          { reply_markup: keyboard.reply_markup }
        );

        console.log(`✅ [OPTIMIZED] P2P menu updated (${Date.now() - startTime}ms total)`);

      } catch (backgroundError) {
        console.error('Background P2P processing failed:', backgroundError);
        
        // Fallback message
        const errorMessage = '🔄 P2P БИРЖА\n' +
                            '➖➖➖➖➖➖➖➖➖➖➖\n' +
                            '❌ Ошибка загрузки данных. Попробуйте позже.';

        const errorKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Повторить', 'p2p_menu')]
        ]);

        await ctx.telegram.editMessageText(
          sentMessage.chat.id,
          sentMessage.message_id,
          null,
          errorMessage,
          { reply_markup: errorKeyboard.reply_markup }
        );
      }

    } catch (error) {
      console.error('Optimized P2P menu error:', error);
      
      try {
        await ctx.reply('❌ Ошибка загрузки P2P меню. Попробуйте позже.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  /**
   * Handle price refresh with instant response
   */
  async handlePriceRefreshOptimized(ctx, orderType) {
    const startTime = Date.now();

    try {
      // Immediate callback response
      await ctx.answerCbQuery('🔄 Обновляем цену...');
      console.log(`⚡ [OPTIMIZED] Instant price refresh response (${Date.now() - startTime}ms)`);

      // Process price data in background
      const priceTaskId = `price_${orderType}_${Date.now()}`;
      
      backgroundService.queueTask(priceTaskId, async () => {
        const priceService = require('../services/priceService');
        const walletService = require('../services/walletService');
        
        const priceData = await priceService.getMarketPriceSuggestion();
        let walletInfo = null;
        
        if (orderType === 'sell') {
          const chatId = ctx.chat.id.toString();
          walletInfo = await walletService.getUserWallet(chatId);
        }

        return { priceData, walletInfo };
      }, { priority: 2 })
      .then(async ({ priceData, walletInfo }) => {
        let message;
        
        if (orderType === 'buy') {
          message = `📈 ПОКУПКА CES ТОКЕНОВ\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Текущая рыночная цена: ₽ ${priceData.currentPrice.toFixed(2)} / CES 🟢\n\n` +
                   `⚠️ Введите [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                   `💡 Пример: 10 245 1000 2450\n\n` +
                   `Информация:\n` +
                   `• Минимальная сумма: 10 ₽\n` +
                   `• Комиссия платформы: 1% (только с мейкеров)`;
        } else {
          message = `📉 ПРОДАЖА CES ТОКЕНОВ\n` +
                   `➖➖➖➖➖➖➖➖➖➖➖\n` +
                   `Текущая рыночная цена: ₽ ${priceData.currentPrice.toFixed(2)} / CES 🟢\n` +
                   `Ваш баланс: ${walletInfo.cesBalance.toFixed(4)} CES\n\n` +
                   `⚠️ Введите  [кол-во, CES] [цена_за_токен, ₽] [мин_сумма, ₽] [макс_сумма, ₽]\n` +
                   `💡 Пример: 50 253.5 1000 12675\n\n` +
                   `Информация:\n` +
                   `• Минимальная сумма: 10 ₽\n` +
                   `• Комиссия платформы: 1% (только с мейкеров)`;
        }

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Обновить цену', `refresh_price_${orderType}`)],
          [Markup.button.callback('🔙 Назад', 'p2p_menu')]
        ]);

        try {
          await ctx.editMessageText(message, keyboard);
          console.log(`✅ [OPTIMIZED] Price refreshed (${Date.now() - startTime}ms total)`);
        } catch (editError) {
          // Handle case where message content is the same
          if (editError.response && editError.response.error_code === 400 && 
              editError.response.description.includes('message is not modified')) {
            // Price is already up to date, no need to edit
            console.log(`✅ [OPTIMIZED] Price already current (${Date.now() - startTime}ms)`);
            return;
          }
          throw editError;
        }
      })
      .catch(error => {
        console.error('Price refresh background task failed:', error);
      });

    } catch (error) {
      console.error('Optimized price refresh error:', error);
      try {
        await ctx.answerCbQuery('❌ Ошибка обновления цены');
      } catch (answerError) {
        console.error('Failed to answer callback query:', answerError);
      }
    }
  }

  /**
   * Handle any callback with instant acknowledgment
   */
  async handleInstantCallback(ctx, callbackText = '✅') {
    const chatId = ctx.chat?.id?.toString() || 'unknown';
    const timer = performanceMonitor.startTiming('instant_callback', chatId);
    
    try {
      await ctx.answerCbQuery(callbackText);
      timer.end({ callbackText, success: true });
      console.log(`⚡ [OPTIMIZED] Instant callback response`);
      return true;
    } catch (error) {
      timer.end({ callbackText, success: false, error: error.message });
      console.error('Failed to send instant callback response:', error);
      return false;
    }
  }

  /**
   * Clear response cache
   */
  clearCache() {
    this.responseCache.clear();
    console.log('🧹 [OPTIMIZED] Response cache cleared');
  }

  /**
   * Get handler statistics
   */
  getStats() {
    return {
      cacheSize: this.responseCache.size,
      backgroundStats: backgroundService.getStats(),
      performanceStats: performanceMonitor.getStats()
    };
  }
}

module.exports = new OptimizedCallbackHandler();