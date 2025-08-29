/**
 * Server Manager
 * Centralized server management
 */

const express = require('express');

class Server {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.server = null;
  }

  async initialize() {
    // Setup middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Ping endpoint
    this.app.get('/ping', (req, res) => {
      res.status(200).json({ message: 'pong', timestamp: new Date().toISOString() });
    });

    console.log(`✅ Server initialized on port ${this.config.server.port}`);
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.server.port, () => {
        console.log(`🚀 Server running on port ${this.config.server.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error('❌ Server start error:', error);
        reject(error);
      });
    });
  }

  async shutdown() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          console.log('✅ Server shutdown completed');
          resolve();
        });
      });
    }
  }

  getApp() {
    return this.app;
  }

  getServer() {
    return this.server;
  }
}

module.exports = Server;