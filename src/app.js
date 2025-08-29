/**
 * Main Application Entry Point
 * Professional modular Telegram bot for CES token price monitoring
 */

const { Application } = require('./modules/core');
const { TelegramBot } = require('./modules/bot');

class MainApplication extends Application {
  constructor() {
    super();
    
    // Register modules
    this.registerModule('telegram', new TelegramBot(this.config));
  }

  async initialize() {
    try {
      // Initialize core application
      await super.initialize();
      
      // Setup bot webhook
      const telegramModule = this.getModule('telegram');
      if (telegramModule) {
        await telegramModule.setWebhook();
      }
      
      // Setup server webhook for bot
      const server = this.server.getApp();
      if (telegramModule) {
        server.use(this.config.telegram.webhookPath, (req, res) => {
          telegramModule.getInstance().handleUpdate(req.body, res);
        });
      }
      
      // Start server
      await this.server.start();
      
      console.log('\n✅ CES Price Telegram Bot successfully started!');
      console.log('📊 Commands: /start and /ces');
      console.log('🔗 Mode: Webhook (doesn\'t sleep on Render)');
      console.log(`🌐 Server running on port ${this.config.server.port}`);
      
      return true;
      
    } catch (error) {
      this.logger.error(error, 'Main application initialization');
      await this.shutdown(1);
      throw error;
    }
  }
}

// Application instance
const app = new MainApplication();

// Check environment and start appropriate mode
async function main() {
  try {
    if (process.env.NODE_ENV === 'development') {
      // For development, we would start in polling mode
      console.log('🔧 Starting in development mode...');
      const telegramModule = app.getModule('telegram');
      if (telegramModule) {
        await telegramModule.startPolling();
      }
    } else {
      await app.initialize();
    }
  } catch (error) {
    console.error('❌ Main application startup error:', error);
    process.exit(1);
  }
}

// Start application
if (require.main === module) {
  main();
}

module.exports = app;