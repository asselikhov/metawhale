/**
 * Main Application Class
 * Central coordinator for all application modules
 */

const Config = require('./Config');
const Database = require('./Database');
const Server = require('./Server');
const Logger = require('./Logger');

class Application {
  constructor() {
    this.config = new Config();
    this.database = new Database(this.config);
    this.server = new Server(this.config);
    this.logger = new Logger();
    this.isShuttingDown = false;
    this.modules = new Map();
    
    this.setupErrorHandlers();
  }

  // Setup global error handlers
  setupErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(`Unhandled Promise Rejection: ${reason}`, 'UnhandledRejection');
    });

    process.on('uncaughtException', (error) => {
      this.logger.error(error, 'UncaughtException');
      this.shutdown(1);
    });

    process.on('SIGINT', () => this.shutdown(0, 'SIGINT'));
    process.on('SIGTERM', () => this.shutdown(0, 'SIGTERM'));
  }

  // Register a module
  registerModule(name, module) {
    this.modules.set(name, module);
    this.logger.info(`Module registered: ${name}`);
  }

  // Get a registered module
  getModule(name) {
    return this.modules.get(name);
  }

  // Initialize application
  async initialize() {
    try {
      this.logger.info('Initializing application...');
      
      // 1. Connect to database
      await this.database.connect();
      
      // 2. Initialize server
      await this.server.initialize();
      
      // 3. Initialize all registered modules
      for (const [name, module] of this.modules) {
        if (typeof module.initialize === 'function') {
          await module.initialize();
          this.logger.info(`Module initialized: ${name}`);
        }
      }
      
      this.logger.info('Application successfully initialized');
      return true;
      
    } catch (error) {
      this.logger.error(error, 'Application initialization');
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
    this.logger.info(`Shutting down application (${signal})...`);
    
    try {
      // Shutdown all registered modules
      for (const [name, module] of this.modules) {
        if (typeof module.shutdown === 'function') {
          try {
            await module.shutdown();
            this.logger.info(`Module shutdown completed: ${name}`);
          } catch (error) {
            this.logger.error(error, `Error shutting down module: ${name}`);
          }
        }
      }
      
      // Shutdown server
      await this.server.shutdown();
      
      // Disconnect database
      await this.database.disconnect();
      
      this.logger.info('Application shutdown completed');
      
    } catch (error) {
      this.logger.error(error, 'Application shutdown');
    } finally {
      process.exit(exitCode);
    }
  }
}

module.exports = Application;