/**
 * Main Application Entry Point
 * Professional modular Telegram bot for CES token price monitoring
 */

const config = require('./src/config/configuration');
const { connectDatabase, disconnectDatabase } = require('./src/database/models');
const bot = require('./src/bot/telegramBot');
const server = require('./src/server/expressServer');
const schedulerService = require('./src/services/schedulerService');
const escrowCleanupService = require('./src/services/escrowCleanupService');
const Utils = require('./src/utils/helpers');
const smartNotificationService = require('./src/services/smartNotificationService');

class Application {
  constructor() {
    this.isShuttingDown = false;
    this.setupErrorHandlers();
  }

  // Setup global error handlers
  setupErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      Utils.logError(new Error(`Unhandled Promise Rejection: ${reason}`), 'UnhandledRejection');
    });

    process.on('uncaughtException', (error) => {
      Utils.logError(error, 'UncaughtException');
      this.shutdown(1);
    });

    process.on('SIGINT', () => this.shutdown(0, 'SIGINT'));
    process.on('SIGTERM', () => this.shutdown(0, 'SIGTERM'));
  }

  // Setup notification callback for smart notifications
  setupNotificationCallback() {
    // Set up the callback for smart notifications to send messages through the bot
    smartNotificationService.setNotificationCallback(async (chatId, message, keyboard = null) => {
      try {
        const options = {};
        if (keyboard) {
          options.reply_markup = keyboard.reply_markup;
        }
        await bot.getInstance().telegram.sendMessage(chatId, message, options);
      } catch (error) {
        console.error(`Failed to send notification to ${chatId}:`, error);
      }
    });
  }

  // Initialize application
  async initialize() {
    try {
      console.log('🚀 Initializing CES Price Telegram Bot...');
      
      // 1. Connect to database
      Utils.log('info', 'Connecting to MongoDB...');
      await connectDatabase();
      
      // 2. Setup notification callback
      this.setupNotificationCallback();
      
      // 3. Initialize performance monitoring
      Utils.log('info', 'Starting performance monitoring...');
      const performanceMonitor = require('./src/services/performanceMonitorService');
      performanceMonitor.startPeriodicLogging(60); // Log every hour
      performanceMonitor.setThreshold(500); // 500ms threshold for slow callbacks
      
      // 4. Setup bot webhook
      Utils.log('info', 'Setting up bot webhook...');
      await bot.setWebhook();
      
      // 5. Setup server with webhook
      Utils.log('info', 'Starting Express server...');
      server.setupWebhook(bot.getInstance());
      await server.start();
      
      // 6. Setup scheduler
      Utils.log('info', 'Starting scheduler service...');
      schedulerService.setBot(bot.getInstance());
      schedulerService.startScheduler();
      
      // 7. 🔧 ИСПРАВЛЕНИЕ: Start escrow cleanup service
      Utils.log('info', 'Starting escrow cleanup service...');
      escrowCleanupService.startAutoCleanup();
      
      // 7. Setup self-ping (after 1 minute)
      setTimeout(() => {
        Utils.log('info', 'Starting self-ping service...');
        server.setupSelfPing();
      }, 60000);
      
      console.log('\n✅ CES Price Telegram Bot successfully started!');
      console.log('📊 Commands: /start and /price');
      console.log('🔗 Mode: Webhook (doesn\'t sleep on Render)');
      console.log('⚙️ ATH: Directly from CoinMarketCap (CMC)');
      console.log('🔄 Updates: Only on /price command (API economy)');
      console.log(`🌐 Server running on port ${config.server.port}`);
      console.log('📅 Auto price updates disabled - saving API limits\n');
      
      return true;
      
    } catch (error) {
      Utils.logError(error, 'Application initialization');
      await this.shutdown(1);
      throw error;
    }
  }

  // Graceful shutdown
  async shutdown(exitCode = 0, signal = 'manual') {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    
    try {
      console.log(`\n⛔ Shutting down application (${signal})...`);
      
      // Stop scheduler
      schedulerService.stopScheduler();
      
      // 🔧 ИСПРАВЛЕНИЕ: Stop escrow cleanup service
      escrowCleanupService.stopAutoCleanup();
      
      // Stop self-ping
      server.stopSelfPing();
      
      // Stop bot
      await bot.stop(signal);
      
      // Stop server
      await server.stop();
      
      // Disconnect database
      await disconnectDatabase();
      
      console.log('✅ Application shutdown completed');
      
    } catch (error) {
      Utils.logError(error, 'Application shutdown');
    } finally {
      process.exit(exitCode);
    }
  }

  // Start development mode (polling)
  async startDevelopment() {
    try {
      console.log('🔧 Starting in development mode (polling)...');
      
      // Connect to database
      await connectDatabase();
      
      // Setup notification callback
      this.setupNotificationCallback();
      
      // Start bot in polling mode
      await bot.startPolling();
      
      // Setup scheduler for development
      schedulerService.setBot(bot.getInstance());
      schedulerService.startScheduler();
      
    } catch (error) {
      Utils.logError(error, 'Development mode startup');
      throw error;
    }
  }
}

// Application instance
const app = new Application();

// Check environment and start appropriate mode
async function main() {
  try {
    if (process.env.NODE_ENV === 'development') {
      await app.startDevelopment();
    } else {
      await app.initialize();
    }
  } catch (error) {
    Utils.logError(error, 'Main application startup');
    process.exit(1);
  }
}

// Start application
if (require.main === module) {
  main();
}

module.exports = app;