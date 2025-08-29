/**
 * Database Manager
 * Centralized database connection and management
 */

const mongoose = require('mongoose');

class Database {
  constructor(config) {
    this.config = config;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) {
        console.log('Database already connected');
        return;
      }

      await mongoose.connect(this.config.database.mongoUri, this.config.database.options);
      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('✅ MongoDB disconnected successfully');
      }
    } catch (error) {
      console.error('❌ MongoDB disconnection error:', error);
      throw error;
    }
  }

  isConnected() {
    return this.isConnected;
  }
}

module.exports = Database;