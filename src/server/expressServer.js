/**
 * Server Module
 * Express server for webhooks, health checks, and keep-alive functionality
 */

const express = require('express');
const axios = require('axios');
const config = require('../config/configuration');
const { User, PriceHistory } = require('../database/models');

class Server {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.selfPingInterval = null;
  }

  // Setup Express middleware
  setupMiddleware() {
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      // Log request body for webhook requests (but avoid circular references)
      if (req.path.includes('/webhook') && req.body) {
        console.log(`Webhook request body keys:`, Object.keys(req.body));
      }
      next();
    });
  }

  // Setup routes
  setupRoutes() {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        status: 'ok',
        message: 'CES Price Telegram Bot is running',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const userCount = await User.countDocuments({ isActive: true });
        const lastPrice = await PriceHistory.findOne().sort({ timestamp: -1 });
        
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          activeUsers: userCount,
          lastPriceUpdate: lastPrice ? lastPrice.timestamp : null,
          lastPrice: lastPrice ? lastPrice.price : null
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message
        });
      }
    });

    // Keep-alive endpoint for Render
    this.app.get('/ping', (req, res) => {
      res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        message: 'Bot is active and working'
      });
    });

    // Test endpoint for scheduled message (for debugging)
    this.app.get('/test-schedule', async (req, res) => {
      try {
        const schedulerService = require('../services/schedulerService');
        const cooldownStatus = schedulerService.getCooldownStatus();
        
        if (req.query.force === 'true') {
          schedulerService.resetMessageCooldown();
        }
        
        await schedulerService.sendPriceToGroup();
        
        res.json({
          status: 'success',
          message: 'Scheduled message sent',
          timestamp: new Date().toISOString(),
          cooldownStatus
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Scheduler status endpoint
    this.app.get('/scheduler-status', (req, res) => {
      try {
        const schedulerService = require('../services/schedulerService');
        const tasks = schedulerService.getActiveTasks();
        const cooldownStatus = schedulerService.getCooldownStatus();
        
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          activeTasks: tasks,
          cooldownStatus
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message
        });
      }
    });
  }

  // Setup webhook for bot
  setupWebhook(bot) {
    console.log(`🛠️ Настраиваем webhook для бота:`, typeof bot, bot.constructor.name);
    
    // Add logging middleware for webhook requests
    this.app.use(config.telegram.webhookPath, (req, res, next) => {
      console.log(`📥 Webhook request received at ${new Date().toISOString()}`);
      console.log(`Method: ${req.method}, Path: ${req.path}`);
      if (req.body) {
        console.log(`Body:`, JSON.stringify(req.body, null, 2));
        // Логируем тип update для диагностики
        if (req.body.message) {
          console.log(`🔵 Update type: MESSAGE`);
        } else if (req.body.callback_query) {
          console.log(`🟡 Update type: CALLBACK_QUERY (button click)`);
        } else {
          console.log(`🔴 Update type: OTHER`);
        }
      }
      console.log(`🔵 Передаем управление webhook обработчику...`);
      next();
    });
    
    // Простая и надежная настройка webhook обработчика
    const webhookHandler = bot.webhookCallback(config.telegram.webhookPath);
    console.log(`🔗 Создан webhook handler:`, typeof webhookHandler);
    
    this.app.use(config.telegram.webhookPath, (req, res, next) => {
      console.log(`🟢 Webhook handler вызывается...`);
      try {
        return webhookHandler(req, res, next);
      } catch (error) {
        console.error(`❌ Ошибка в webhook handler:`, error);
        res.status(200).json({ ok: true });
      }
    });
    
    console.log(`🔗 Webhook настроен на ${config.telegram.webhookPath}`);
  }

  // Start server
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(config.server.port, () => {
          console.log(`🌐 Server started on port ${config.server.port}`);
          resolve(this.server);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop server
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Setup self-ping to prevent Render sleep
  setupSelfPing() {
    if (this.selfPingInterval) {
      clearInterval(this.selfPingInterval);
    }

    const pingUrl = `${config.telegram.webhookUrl}/ping`;
    
    this.selfPingInterval = setInterval(async () => {
      try {
        const response = await axios.get(pingUrl, { timeout: 10000 });
        console.log('🏓 Self-ping successful:', response.data.timestamp);
      } catch (error) {
        console.log('⚠️ Self-ping error:', error.message);
      }
    }, config.constants.selfPingInterval);
    
    console.log(`🏓 Self-ping configured: every ${config.constants.selfPingInterval / 60000} minutes`);
  }

  // Stop self-ping
  stopSelfPing() {
    if (this.selfPingInterval) {
      clearInterval(this.selfPingInterval);
      this.selfPingInterval = null;
      console.log('⛔ Self-ping stopped');
    }
  }

  // Get Express app
  getApp() {
    return this.app;
  }
}

module.exports = new Server();