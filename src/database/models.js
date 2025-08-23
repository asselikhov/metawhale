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
  tokenType: { type: String, enum: ['CES', 'POL'], default: 'CES' },
  type: { type: String, enum: ['deposit', 'withdrawal', 'p2p'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  txHash: String,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

// P2P Order Schema (for buying/selling CES with rubles)
const p2pOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['buy', 'sell'], required: true },
  amount: { type: Number, required: true }, // Amount of CES tokens
  pricePerToken: { type: Number, required: true }, // Price per CES token in rubles
  totalValue: { type: Number, required: true }, // Total value in rubles
  status: { type: String, enum: ['active', 'partial', 'completed', 'cancelled'], default: 'active' },
  filledAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 days
});

// P2P Trade Schema (for completed trades in rubles)
const p2pTradeSchema = new mongoose.Schema({
  buyOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2POrder', required: true },
  sellOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2POrder', required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true }, // CES amount traded
  pricePerToken: { type: Number, required: true }, // Price per CES token in rubles
  totalValue: { type: Number, required: true }, // Total value in rubles
  commission: { type: Number, required: true }, // 1% commission in rubles
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  cesTransferTxHash: String, // Hash for CES token transfer
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
const P2POrder = mongoose.model('P2POrder', p2pOrderSchema);
const P2PTrade = mongoose.model('P2PTrade', p2pTradeSchema);
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
  P2POrder,
  P2PTrade,
  PriceHistory,
  connectDatabase,
  disconnectDatabase
};