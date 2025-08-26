const { Telegraf } = require('telegraf');
const MessageHandler = require('../handlers/messageHandler');
const optimizedHandler = require('../handlers/OptimizedCallbackHandler');
const config = require('../config/configuration');

// Create an instance of MessageHandler
const messageHandler = new MessageHandler();

class TelegramBot {
  constructor() {
    // Validate bot token before creating Telegraf instance
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
    }
    
    // Create Telegraf instance with proper webhook domain and increased timeouts
    this.bot = new Telegraf(config.telegram.botToken, {
      telegram: {
        webhookReply: true, // Включаем webhook reply для обработки callback_query
        // Увеличиваем таймауты для надежности
        timeout: 60000, // 60 секунд
        retryAfter: 2000, // 2 секунды между повторами
        // Обработка сетевых ошибок
        agent: null // Используем стандартный agent
      },
      // Обработка ошибок на уровне бота
      handlerTimeout: 90000 // 90 секунд для обработчиков
    });
    this.setupHandlers();
  }

  getInstance() {
    return this.bot;
  }

  async setWebhook() {
    // Проверяем, что webhookUrl определен
    if (!config.telegram.webhookUrl || config.telegram.webhookUrl === 'undefined') {
      console.log('⚠️ WEBHOOK_URL не определен - продолжаем без webhook');
      return; // Не выбрасываем ошибку
    }
    
    // The webhook URL should NOT include the bot token for Telegraf
    // Telegraf automatically handles the token
    const webhookUrl = `${config.telegram.webhookUrl}${config.telegram.webhookPath}`;
    
    // Retry логика для установки webhook
    const maxRetries = 3; // Уменьшаем количество попыток для быстрого старта
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔗 Попытка установки webhook (${attempt}/${maxRetries}): ${webhookUrl}`);
        
        // Увеличиваем таймаут для каждой попытки
        const timeout = 15000 + (attempt * 5000); // 15s, 20s, 25s
        
        await Promise.race([
          this.bot.telegram.setWebhook(webhookUrl),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Webhook setup timeout')), timeout)
          )
        ]);
        
        console.log(`✅ Webhook успешно установлен: ${webhookUrl}`);
        return; // Успешная установка - выходим
        
      } catch (error) {
        lastError = error;
        const errorType = error.code || error.name || 'Unknown';
        console.log(`⚠️ Webhook попытка ${attempt} неудачна (${errorType}): ${error.message}`);
        
        if (attempt < maxRetries) {
          const delay = 2000 * attempt; // 2s, 4s
          console.log(`⏳ Повторяем через ${delay/1000} секунд...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Если все попытки неудачны, планируем повторную попытку
    console.warn(`❌ Не удалось установить webhook за ${maxRetries} попыток. Последняя ошибка:`, lastError.message);
    console.log(`⚠️ Продолжаем без webhook - повторим попытку в фоновом режиме`);
    
    // Планируем повторную попытку через 2 минуты
    this.scheduleWebhookRetry(2);
    
    // Не выбрасываем ошибку, чтобы приложение могло продолжить работу
  }

  // Планировать повторную попытку установки webhook
  scheduleWebhookRetry(minutesDelay) {
    console.log(`📅 Планируем повторную попытку webhook через ${minutesDelay} минут`);
    
    setTimeout(async () => {
      console.log(`🔄 Повторная попытка установки webhook...`);
      try {
        await this.setWebhook();
        console.log(`✅ Webhook успешно установлен при повторной попытке`);
      } catch (error) {
        console.error(`❌ Повторная попытка webhook неудачна:`, error.message);
        // Планируем следующую попытку через удвоенное время
        const nextDelay = Math.min(minutesDelay * 2, 60); // Максимум 60 минут
        if (nextDelay <= 60) {
          this.scheduleWebhookRetry(nextDelay);
        } else {
          console.log(`⚠️ Переключаемся на polling режим из-за постоянных проблем с webhook`);
          this.fallbackToPolling();
        }
      }
    }, minutesDelay * 60 * 1000);
  }

  // Резервный запуск в polling режиме
  async fallbackToPolling() {
    try {
      console.log(`🔄 Запуск в polling режиме как резервный вариант...`);
      // Удаляем webhook перед запуском polling
      await this.bot.telegram.deleteWebhook();
      await this.bot.launch({ dropPendingUpdates: true });
      console.log(`✅ Бот успешно запущен в polling режиме`);
    } catch (error) {
      console.error(`❌ Ошибка запуска polling режима:`, error);
    }
  }

  async startPolling() {
    console.log('🔄 Starting bot in polling mode...');
    try {
      await this.bot.launch({ dropPendingUpdates: true });
      console.log('✅ Bot started in polling mode');
    } catch (error) {
      console.error('❌ Failed to start bot in polling mode:', error);
      throw error;
    }
  }

  async stop(signal = 'manual') {
    console.log(`⛔ Stopping bot (${signal})...`);
    try {
      await this.bot.stop(signal);
      console.log('✅ Bot stopped');
    } catch (error) {
      console.error('❌ Error stopping bot:', error);
    }
  }

// Setup command and callback handlers
  setupHandlers() {
    console.log('🛠️ Настраиваем обработчики Telegraf...');
    
    // Общий обработчик всех update для диагностики (должен быть ПЕРВЫМ!)
    this.bot.use((ctx, next) => {
      console.log('🔄 Telegraf получил update:', {
        updateType: ctx.updateType,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        username: ctx.from?.username
      });
      return next();
    });
    
    // Commands
    this.bot.start((ctx) => {
      console.log('📥 Received /start command from user:', ctx.from.username);
      return messageHandler.handleStart(ctx);
    });
    
    this.bot.command('ces', (ctx) => {
      console.log('📥 Received /ces command from user:', ctx.from.username);
      return messageHandler.handlePrice(ctx);
    });
    
    this.bot.command('fees', (ctx) => {
      console.log('📥 Received /fees command from user:', ctx.from.username);
      return messageHandler.handleFees(ctx);
    });
    
    this.bot.command('stat', (ctx) => {
      console.log('📥 Received /stat command from user:', ctx.from.username);
      return messageHandler.handleStat(ctx);
    });

    // Text messages (for regular keyboard buttons)
    this.bot.on('text', (ctx) => {
      console.log('📥 Received text message from user:', ctx.from.username, 'text:', ctx.message.text);
      return messageHandler.handleTextMessage(ctx);
    });

    // Общий обработчик всех callback_query для диагностики
    this.bot.on('callback_query', (ctx, next) => {
      console.log('🔘 CALLBACK_QUERY received from user:', ctx.callbackQuery.from.username, 'data:', ctx.callbackQuery.data);
      return next(); // Передаем управление следующему обработчику
    });

    // Callback handlers
    this.bot.action('personal_cabinet', (ctx) => {
      console.log('📥 Received personal_cabinet callback');
      return optimizedHandler.handlePersonalCabinetOptimized(ctx);
    });
    
    this.bot.action('p2p_menu', (ctx) => {
      console.log('📥 Received p2p_menu callback');
      return optimizedHandler.handleP2PMenuOptimized(ctx);
    });
    
    this.bot.action('get_price', async (ctx) => {
      console.log('Received get_price callback');
      await optimizedHandler.handleInstantCallback(ctx, '📊 Получаем цену...');
      return messageHandler.handlePrice(ctx);
    });
    
    this.bot.action('create_wallet', async (ctx) => {
      console.log('Received create_wallet callback');
      return messageHandler.handleCreateWallet(ctx);
    });
    
    this.bot.action('edit_wallet', async (ctx) => {
      console.log('Received edit_wallet callback');
      return messageHandler.handleWalletEdit(ctx);
    });
    
    this.bot.action('wallet_details', async (ctx) => {
      console.log('Received wallet_details callback');
      return messageHandler.handleWalletDetails(ctx);
    });
    
    this.bot.action('transfer_menu', async (ctx) => {
      console.log('Received transfer_menu callback');
      await optimizedHandler.handleInstantCallback(ctx, '💸 Загружаем меню переводов...');
      return messageHandler.handleTransferMenu(ctx);
    });
    
    this.bot.action('show_private_key', (ctx) => {
      console.log('Received show_private_key callback');
      return messageHandler.handleShowPrivateKey(ctx);
    });
    
    this.bot.action('export_wallet', (ctx) => {
      console.log('Received export_wallet callback');
      return messageHandler.handleExportWallet(ctx);
    });
    
    this.bot.action('delete_wallet', (ctx) => {
      console.log('Received delete_wallet callback');
      return messageHandler.handleDeleteWallet(ctx);
    });
    
    this.bot.action('confirm_delete_wallet', (ctx) => {
      console.log('Received confirm_delete_wallet callback');
      return messageHandler.handleConfirmDeleteWallet(ctx);
    });
    
    this.bot.action('refresh_balance', (ctx) => {
      console.log('Received refresh_balance callback');
      return messageHandler.handleRefreshBalance(ctx);
    });
    
    this.bot.action('back_to_menu', (ctx) => {
      console.log('Received back_to_menu callback');
      return messageHandler.handleBackToMenu(ctx);
    });
    
    // Token transfer handlers
    this.bot.action('send_ces_tokens', (ctx) => {
      console.log('Received send_ces_tokens callback');
      return messageHandler.handleSendCESTokens(ctx);
    });
    
    this.bot.action('send_pol_tokens', (ctx) => {
      console.log('Received send_pol_tokens callback');
      return messageHandler.handleSendPOLTokens(ctx);
    });
    
    this.bot.action('transaction_history', (ctx) => {
      console.log('Received transaction_history callback');
      return messageHandler.handleTransactionHistory(ctx);
    });
    
    // P2P Exchange handlers
    this.bot.action('p2p_buy_ces', (ctx) => {
      console.log('Received p2p_buy_ces callback');
      return messageHandler.handleP2PBuyCES(ctx);
    });
    
    this.bot.action('p2p_sell_ces', (ctx) => {
      console.log('Received p2p_sell_ces callback');
      return messageHandler.handleP2PSellCES(ctx);
    });
    
    this.bot.action('p2p_market_orders', (ctx) => {
      console.log('Received p2p_market_orders callback');
      return messageHandler.handleP2PMarketOrders(ctx);
    });
    
    this.bot.action('p2p_buy_orders', (ctx) => {
      console.log('Received p2p_buy_orders callback');
      return messageHandler.handleP2PBuyOrders(ctx);
    });
    
    this.bot.action('p2p_sell_orders', (ctx) => {
      console.log('Received p2p_sell_orders callback');
      return messageHandler.handleP2PSellOrders(ctx);
    });
    
    this.bot.action('p2p_my_orders', (ctx) => {
      console.log('Received p2p_my_orders callback');
      return messageHandler.handleP2PMyOrders(ctx);
    });
    
    this.bot.action('p2p_analytics', (ctx) => {
      console.log('Received p2p_analytics callback');
      return messageHandler.handleP2PAnalytics(ctx);
    });
    
    this.bot.action('p2p_my_profile', (ctx) => {
      console.log('Received p2p_my_profile callback');
      return messageHandler.handleP2PMyProfile(ctx);
    });
    
    this.bot.action('p2p_top_traders', (ctx) => {
      console.log('Received p2p_top_traders callback');
      return messageHandler.handleP2PTopTraders(ctx);
    });

    // P2P Data Management handlers
    this.bot.action('p2p_my_data', (ctx) => {
      console.log('Received p2p_my_data callback');
      return messageHandler.handleP2PMyData(ctx);
    });

    this.bot.action('p2p_edit_data', (ctx) => {
      console.log('Received p2p_edit_data callback');
      return messageHandler.handleP2PEditData(ctx);
    });

    this.bot.action('p2p_edit_fullname', (ctx) => {
      console.log('Received p2p_edit_fullname callback');
      return messageHandler.handleP2PEditFullName(ctx);
    });

    this.bot.action('p2p_edit_payment_methods', (ctx) => {
      console.log('Received p2p_edit_payment_methods callback');
      return messageHandler.handleP2PEditPaymentMethods(ctx);
    });

    this.bot.action('p2p_save_payment_methods', (ctx) => {
      console.log('Received p2p_save_payment_methods callback');
      return messageHandler.handleP2PSavePaymentMethods(ctx);
    });

    this.bot.action('p2p_edit_contact', (ctx) => {
      console.log('Received p2p_edit_contact callback');
      return messageHandler.handleP2PEditContact(ctx);
    });

    this.bot.action('p2p_edit_conditions', (ctx) => {
      console.log('Received p2p_edit_conditions callback');
      return messageHandler.handleP2PEditConditions(ctx);
    });

    this.bot.action('p2p_toggle_use_in_orders', (ctx) => {
      console.log('Received p2p_toggle_use_in_orders callback');
      return messageHandler.handleP2PToggleUseInOrders(ctx);
    });

    this.bot.action('p2p_buyer_view', (ctx) => {
      console.log('Received p2p_buyer_view callback');
      return messageHandler.handleP2PBuyerView(ctx);
    });

    // Handle bank toggles (dynamic callbacks)
    this.bot.action(/^p2p_toggle_bank_(.+)$/, (ctx) => {
      const bankCode = ctx.match[1];
      console.log('Received p2p_toggle_bank callback:', bankCode);
      return messageHandler.handleP2PToggleBank(ctx, bankCode);
    });
    
    // Handle transfer confirmations
    this.bot.action('confirm_transfer', (ctx) => {
      console.log('Received confirm_transfer callback');
      return messageHandler.handleTransferConfirmation(ctx);
    });
    
    // Handle transaction status checks (dynamic callbacks)
    this.bot.action(/^check_tx_(.+)$/, (ctx) => {
      const txHashPart = ctx.match[1];
      console.log('Received check_tx callback:', txHashPart);
      // We need to reconstruct or find the full transaction hash
      // For now, we'll delegate to the transfer handler which can handle this
      return messageHandler.handleTransactionStatusCheck(ctx, txHashPart);
    });
    
    // Handle P2P order confirmations
    this.bot.action('confirm_p2p_order', (ctx) => {
      console.log('Received confirm_p2p_order callback');
      return messageHandler.handleP2POrderConfirmation(ctx);
    });
    
    // Handle smart contract approval and order creation
    this.bot.action('approve_and_create_order', (ctx) => {
      console.log('Received approve_and_create_order callback');
      return messageHandler.handleApproveAndCreateOrder(ctx);
    });
    
    // Handle user messaging (dynamic callbacks)
    this.bot.action(/^message_user_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[2];
      console.log('Received message_user callback:', userId);
      return messageHandler.handleUserMessaging(ctx, userId);
    });
    
    // Handle order creation with user (dynamic callbacks)
    this.bot.action(/^create_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[3];
      console.log('Received create_order_with callback:', userId);
      return messageHandler.handleCreateOrderWithUser(ctx, userId);
    });
    
    // Handle create buy order with user (dynamic callbacks)
    this.bot.action(/^create_buy_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[4];
      console.log('Received create_buy_order_with callback:', userId);
      return messageHandler.handleCreateBuyOrderWithUser(ctx, userId);
    });
    
    // Handle create sell order with user (dynamic callbacks)
    this.bot.action(/^create_sell_order_with_/, (ctx) => {
      const userId = ctx.callbackQuery.data.split('_')[4];
      console.log('Received create_sell_order_with callback:', userId);
      return messageHandler.handleCreateSellOrderWithUser(ctx, userId);
    });
    
    // Handle cancel order (dynamic callbacks)
    this.bot.action(/^cancel_order_/, (ctx) => {
      const orderId = ctx.callbackQuery.data.split('_')[2];
      console.log('Received cancel_order callback:', orderId);
      return messageHandler.handleCancelOrder(ctx, orderId);
    });
    
    // Handle confirm cancel order (dynamic callbacks)
    this.bot.action(/^confirm_cancel_order_/, (ctx) => {
      const orderId = ctx.callbackQuery.data.split('_')[3];
      console.log('Received confirm_cancel_order callback:', orderId);
      return messageHandler.handleConfirmCancelOrder(ctx, orderId);
    });
    
    // Handle pagination for buy orders
    this.bot.action(/^p2p_buy_orders_page_(\d+)$/, (ctx) => {
      const page = parseInt(ctx.match[1]);
      console.log('Received p2p_buy_orders_page callback:', page);
      return messageHandler.handleP2PBuyOrders(ctx, page);
    });
    
    // Handle pagination for sell orders
    this.bot.action(/^p2p_sell_orders_page_(\d+)$/, (ctx) => {
      const page = parseInt(ctx.match[1]);
      console.log('Received p2p_sell_orders_page callback:', page);
      return messageHandler.handleP2PSellOrders(ctx, page);
    });
    
    // Handle pagination for my orders
    this.bot.action(/^p2p_my_orders_page_(\d+)$/, (ctx) => {
      const page = parseInt(ctx.match[1]);
      console.log('Received p2p_my_orders_page callback:', page);
      return messageHandler.handleP2PMyOrders(ctx, page);
    });
    
    // Handle no_action callbacks (for non-clickable buttons)
    this.bot.action('no_action', (ctx) => {
      // Silently acknowledge the callback without any action
      console.log('Received no_action callback (non-clickable button clicked)');
      return ctx.answerCbQuery();
    });
    
    // Handle user profile view for buy orders
    this.bot.action(/^buy_order_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      console.log('Received buy_order callback:', userId);
      return messageHandler.handleP2PUserProfile(ctx, userId);
    });
    
    // Handle user profile view for sell orders
    this.bot.action(/^sell_order_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      console.log('Received sell_order callback:', userId);
      return messageHandler.handleP2PUserProfile(ctx, userId);
    });
    
    // Handle enter amount for P2P trading (dynamic callbacks)
    this.bot.action(/^enter_amount_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      console.log('Received enter_amount callback:', userId);
      return messageHandler.handleEnterAmount(ctx, userId);
    });
    
    // Handle buy order details (dynamic callbacks)
    this.bot.action(/^buy_details_(.+)_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      const orderId = ctx.match[2];
      console.log('Received buy_details callback:', userId, orderId);
      return messageHandler.handleBuyOrderDetails(ctx, userId, orderId);
    });
    
    // Handle sell order details (dynamic callbacks)
    this.bot.action(/^sell_details_(.+)_(.+)$/, (ctx) => {
      const userId = ctx.match[1];
      const orderId = ctx.match[2];
      console.log('Received sell_details callback:', userId, orderId);
      return messageHandler.handleSellOrderDetails(ctx, userId, orderId);
    });
    
    // New handlers for sell CES flow
    this.bot.action('continue_sell_order', (ctx) => {
      console.log('Received continue_sell_order callback');
      return messageHandler.handleContinueSellOrder(ctx);
    });

    this.bot.action('continue_buy_order', (ctx) => {
      console.log('Received continue_buy_order callback');
      return messageHandler.handleContinueBuyOrder(ctx);
    });
    
    this.bot.action('confirm_sell_amount', (ctx) => {
      console.log('Received confirm_sell_amount callback');
      return messageHandler.handleConfirmSellAmount(ctx);
    });
    
    this.bot.action('back_to_amount_input', (ctx) => {
      console.log('Received back_to_amount_input callback');
      return messageHandler.handleBackToAmountInput(ctx);
    });
    
    this.bot.action('continue_with_payment', (ctx) => {
      console.log('Received continue_with_payment callback');
      return messageHandler.handleContinueWithPayment(ctx);
    });
    
    this.bot.action(/^select_payment_(.+)$/, (ctx) => {
      const bankCode = ctx.match[1];
      console.log('Received select_payment callback:', bankCode);
      return messageHandler.handleSelectPayment(ctx, bankCode);
    });
    
    this.bot.action('back_to_payment_selection', (ctx) => {
      console.log('Received back_to_payment_selection callback');
      return messageHandler.handleBackToPaymentSelection(ctx);
    });
    
    this.bot.action('back_to_amount_confirmation', (ctx) => {
      console.log('Received back_to_amount_confirmation callback');
      return messageHandler.handleBackToAmountConfirmation(ctx);
    });
    
    this.bot.action('make_payment', (ctx) => {
      console.log('Received make_payment callback');
      return messageHandler.handleMakePayment(ctx);
    });
    
    this.bot.action('cancel_trade', (ctx) => {
      console.log('Received cancel_trade callback');
      return messageHandler.handleCancelTrade(ctx);
    });
    
    this.bot.action('payment_completed', async (ctx) => {
      console.log('Received payment_completed callback');
      await optimizedHandler.handleInstantCallback(ctx, '✅ Обрабатываем...');
      return messageHandler.handlePaymentCompleted(ctx);
    });
    
    this.bot.action('payment_received', async (ctx) => {
      console.log('Received payment_received callback');
      await optimizedHandler.handleInstantCallback(ctx, '✅ Подтверждаем...');
      return messageHandler.handlePaymentReceived(ctx);
    });
    
    this.bot.action('cancel_payment', async (ctx) => {
      console.log('Received cancel_payment callback');
      await optimizedHandler.handleInstantCallback(ctx, '❌ Отменяем...');
      return messageHandler.handleCancelPayment(ctx);
    });
    
    this.bot.action('contact_support', async (ctx) => {
      console.log('Received contact_support callback');
      await optimizedHandler.handleInstantCallback(ctx, '📞 Обращаемся...');
      return messageHandler.handleContactSupport(ctx);
    });
    
    // Handle real-time price refresh for buy orders
    this.bot.action('refresh_price_buy', (ctx) => {
      console.log('Received refresh_price_buy callback');
      return optimizedHandler.handlePriceRefreshOptimized(ctx, 'buy');
    });
    
    // Handle real-time price refresh for sell orders
    this.bot.action('refresh_price_sell', (ctx) => {
      console.log('Received refresh_price_sell callback');
      return optimizedHandler.handlePriceRefreshOptimized(ctx, 'sell');
    });
    
    // Error handling for the bot
    this.bot.catch((err, ctx) => {
      console.error(`❌ Telegram bot error for ${ctx.updateType}:`, err);
      try {
        ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    });
  }
}

module.exports = new TelegramBot();