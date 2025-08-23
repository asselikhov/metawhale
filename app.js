/**
 * Main Application Entry Point
 * Professional modular Telegram bot for CES token price monitoring
 */

const config = require('./src/config');
const { connectDatabase, disconnectDatabase } = require('./src/database/models');
const bot = require('./src/bot');
const server = require('./src/server');
const schedulerService = require('./src/services/schedulerService');
const Utils = require('./src/utils');

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

  // Initialize application
  async initialize() {
    try {
      console.log('🚀 Initializing CES Price Telegram Bot...');
      
      // 1. Connect to database
      Utils.log('info', 'Connecting to MongoDB...');
      await connectDatabase();
      
      // 2. Setup bot webhook
      Utils.log('info', 'Setting up bot webhook...');
      await bot.setWebhook();
      
      // 3. Setup server with webhook
      Utils.log('info', 'Starting Express server...');
      server.setupWebhook(bot.getInstance());
      await server.start();
      
      // 4. Setup scheduler
      Utils.log('info', 'Starting scheduler service...');
      schedulerService.setBot(bot.getInstance());
      schedulerService.startScheduler();
      
      // 5. Setup self-ping (after 1 minute)
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