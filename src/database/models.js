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
  lastBalanceUpdate: { type: Date },
  // Escrow balances for P2P trading
  escrowCESBalance: { type: Number, default: 0 },
  escrowPOLBalance: { type: Number, default: 0 },
  // P2P trading statistics
  p2pTradingEnabled: { type: Boolean, default: true },
  successfulTrades: { type: Number, default: 0 },
  totalTradeVolume: { type: Number, default: 0 },
  p2pRating: { type: Number, default: 5.0, min: 1, max: 5 },
  disputeCount: { type: Number, default: 0 },
  // Enhanced verification system
  verificationLevel: { 
    type: String, 
    enum: ['unverified', 'phone_verified', 'document_verified', 'premium'], 
    default: 'unverified' 
  },
  phoneNumber: String,
  phoneVerified: { type: Boolean, default: false },
  documentsVerified: { type: Boolean, default: false },
  isPremiumTrader: { type: Boolean, default: false },
  // Trust and reputation system
  trustScore: { type: Number, default: 0, min: 0, max: 1000 },
  completionRate: { type: Number, default: 100 }, // Percentage of completed trades
  avgReleaseTime: { type: Number, default: 0 }, // Average time to release in minutes
  tradingVolumeLast30Days: { type: Number, default: 0 },
  lastOnline: { type: Date, default: Date.now },
  // Security settings
  twoFactorEnabled: { type: Boolean, default: false },
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String
  }],
  // Trading preferences
  preferredPaymentMethods: [{ type: String, enum: ['bank_transfer', 'sbp', 'qiwi', 'yoomoney'] }],
  tradingLimits: {
    dailyLimit: { type: Number, default: 50000 }, // in rubles
    monthlyLimit: { type: Number, default: 1000000 }, // in rubles
    maxSingleTrade: { type: Number, default: 100000 } // in rubles
  },
  // Blocked/restricted users
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  restrictedUntil: Date,
  // Advanced analytics
  tradeAnalytics: {
    totalTrades: { type: Number, default: 0 },
    successfulTrades: { type: Number, default: 0 },
    failedTrades: { type: Number, default: 0 },
    disputedTrades: { type: Number, default: 0 },
    avgTradeSize: { type: Number, default: 0 },
    favoritePaymentMethods: [{ 
      method: String, 
      count: { type: Number, default: 0 } 
    }]
  },
  // AI Fraud Detection Profile
  behaviorProfile: {
    typicalTradeHours: [Number], // 0-23
    typicalTradeAmounts: [{
      min: Number,
      max: Number,
      frequency: Number
    }],
    riskFlags: [{
      type: String,
      timestamp: { type: Date, default: Date.now },
      resolved: { type: Boolean, default: false }
    }]
  }
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
  status: { type: String, enum: ['active', 'partial', 'completed', 'cancelled', 'locked'], default: 'active' },
  filledAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, required: true },
  escrowLocked: { type: Boolean, default: false }, // Whether tokens are locked in escrow
  escrowAmount: { type: Number, default: 0 }, // Amount locked in escrow
  minTradeAmount: { type: Number, default: 1 }, // Minimum trade amount per transaction
  maxTradeAmount: { type: Number }, // Maximum trade amount per transaction
  paymentMethods: [{ type: String, enum: ['bank_transfer', 'sbp', 'qiwi', 'yoomoney'], default: ['bank_transfer'] }],
  tradeTimeLimit: { type: Number, default: 30 }, // Time limit in minutes
  autoReply: String, // Automatic reply message
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 days
});

// P2P Trade Schema (for completed trades in rubles with escrow)
const p2pTradeSchema = new mongoose.Schema({
  buyOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2POrder', required: true },
  sellOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2POrder', required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true }, // CES amount traded
  pricePerToken: { type: Number, required: true }, // Price per CES token in rubles
  totalValue: { type: Number, required: true }, // Total value in rubles
  commission: { type: Number, required: true }, // 1% commission in rubles
  status: { 
    type: String, 
    enum: ['pending', 'escrow_locked', 'payment_pending', 'payment_confirmed', 'completed', 'disputed', 'cancelled', 'failed'], 
    default: 'pending' 
  },
  escrowStatus: {
    type: String,
    enum: ['none', 'locked', 'released', 'refunded'],
    default: 'none'
  },
  paymentMethod: { type: String, enum: ['bank_transfer', 'sbp', 'qiwi', 'yoomoney'], required: true },
  paymentDetails: {
    sellerInstructions: String, // Seller's payment instructions
    buyerProof: String, // Buyer's payment proof
    transactionId: String // Payment transaction ID
  },
  timeTracking: {
    createdAt: { type: Date, default: Date.now },
    escrowLockedAt: Date,
    paymentMadeAt: Date,
    paymentConfirmedAt: Date,
    completedAt: Date,
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 60 * 1000) } // 30 minutes default
  },
  cesTransferTxHash: String, // Hash for CES token transfer
  disputeReason: String,
  disputeMessages: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    timestamp: { type: Date, default: Date.now },
    attachments: [String] // File URLs for evidence
  }],
  moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

// Escrow Transaction Schema
const escrowTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2PTrade' },
  type: { type: String, enum: ['lock', 'release', 'refund'], required: true },
  tokenType: { type: String, enum: ['CES', 'POL'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  txHash: String,
  reason: String, // Reason for the transaction
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
const EscrowTransaction = mongoose.model('EscrowTransaction', escrowTransactionSchema);
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
  EscrowTransaction,
  PriceHistory,
  connectDatabase,
  disconnectDatabase
};