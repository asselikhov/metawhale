/**
 * Database models and connection
 */

const mongoose = require('mongoose');
const config = require('../config/configuration');

// User Schema
const userSchema = new mongoose.Schema({
  chatId: { type: String, unique: true, required: true },
  username: String,
  firstName: String,
  lastName: String,
  isActive: { type: Boolean, default: true },
  subscribedAt: { type: Date, default: Date.now },
  lastNotified: Date,
  language: { type: String, default: 'ru' },
  // Wallet functionality
  walletAddress: { type: String, unique: true, sparse: true },
  walletCreatedAt: { type: Date },
  cesBalance: { type: Number, default: 0 },
  polBalance: { type: Number, default: 0 },
  lastBalanceUpdate: { type: Date }
});

// Wallet Schema
const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String, required: true, unique: true },
  encryptedPrivateKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fromAddress: { type: String, required: true },
  toAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  tokenType: { type: String, default: 'CES' },
  txHash: String,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  type: { type: String, enum: ['deposit', 'withdrawal', 'p2p'], required: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

// Price History Schema
const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  change24h: Number,
  marketCap: Number,
  volume24h: Number,
  priceRub: Number,
  changeRub24h: Number,
  ath: Number
});

// Create Models
const User = mongoose.model('User', userSchema);
const Wallet = mongoose.model('Wallet', walletSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

// Database connection
async function connectDatabase() {
  try {
    await mongoose.connect(config.database.mongoUri);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Graceful shutdown
async function disconnectDatabase() {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
}

module.exports = {
  User,
  Wallet,
  Transaction,
  PriceHistory,
  connectDatabase,
  disconnectDatabase
};