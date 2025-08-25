/**
 * Database models and connection
 */

const mongoose = require('mongoose');
const config = require('../config/configuration');

// Configure mongoose connection with optimized settings
mongoose.set('strictQuery', false);

// Variable to track connection status
let isConnected = false;

// Connect to MongoDB with optimized settings
async function connectDatabase() {
  try {
    await mongoose.connect(config.database.mongoUri, config.database.options);
    isConnected = true;
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    isConnected = false;
    // Don't exit the process, allow the bot to run without database
    console.log('⚠️  Bot will continue running without database connection');
  }
}

// Add connection event handlers
mongoose.connection.on('connected', () => {
  console.log('💾 Mongoose connected to MongoDB');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('💾 Mongoose connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('💾 Mongoose disconnected from MongoDB');
  isConnected = false;
});

// Handle graceful shutdown
async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.connection.close();
    console.log('💾 Mongoose connection closed through app termination');
    isConnected = false;
  }
}

// Check if database is connected
function isDatabaseConnected() {
  return isConnected;
}

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
  trustScore: { type: Number, default: 0, min: 0, max: 1000 }, // Legacy trust score
  smartRating: { type: Number, default: 0, min: 0, max: 100 }, // New smart rating percentage
  completionRate: { type: Number, default: 100 }, // Percentage of completed trades
  avgReleaseTime: { type: Number, default: 0 }, // Average time to release in minutes
  tradingVolumeLast30Days: { type: Number, default: 0 },
  lastOnline: { type: Date, default: Date.now },
  lastRatingUpdate: { type: Date, default: Date.now }, // For smart rating updates
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
  },
  // P2P Profile Data
  p2pProfile: {
    fullName: String, // ФИО
    contactInfo: String, // Контакт (Telegram/телефон)
    paymentMethods: [{
      bank: {
        type: String,
        enum: ['sberbank', 'vtb', 'gazprombank', 'alfabank', 'rshb', 'mkb', 'sovcombank', 'tbank', 'domrf', 'otkritie', 'raiffeisenbank', 'rosbank']
      },
      cardNumber: String,
      isActive: { type: Boolean, default: true }
    }],
    makerConditions: String, // Условия мейкера
    isProfileComplete: { type: Boolean, default: false },
    useInOrders: { type: Boolean, default: false }
  }
});

// Add indexes for faster queries (remove duplicates)
userSchema.index({ trustScore: 1 });
userSchema.index({ lastOnline: 1 });

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
  tradeTimeLimit: { type: Number, default: () => config.escrow?.timeoutMinutes || 30 }, // Time limit in minutes
  autoReply: String, // Automatic reply message
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 days
});

// Add indexes for faster queries
p2pOrderSchema.index({ userId: 1, status: 1 });
p2pOrderSchema.index({ type: 1, status: 1 });
p2pOrderSchema.index({ pricePerToken: 1 });
p2pOrderSchema.index({ createdAt: -1 });

// P2P Trade Schema (for completed trades in rubles with escrow)
const p2pTradeSchema = new mongoose.Schema({
  buyOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2POrder', required: true },
  sellOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2POrder', required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Мейкер (создатель ордера на покупку)
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Тейкер (продавец CES)
  amount: { type: Number, required: true }, // CES amount traded
  pricePerToken: { type: Number, required: true }, // Price per CES token in rubles
  totalValue: { type: Number, required: true }, // Total value in rubles
  buyerCommission: { type: Number, default: 0 }, // 1% commission from buyer in CES
  sellerCommission: { type: Number, default: 0 }, // No commission from seller
  commission: { type: Number, required: true }, // Total commission in CES (for backward compatibility)
  status: { 
    type: String, 
    enum: [
      'escrow_locked',      // CES заморожены у тейкера
      'payment_pending',    // Мейкер должен оплатить
      'payment_made',       // Мейкер нажал "Платёж выполнен"
      'payment_confirmed',  // Тейкер подтвердил получение
      'completed',          // Сделка завершена, CES переданы
      'disputed',           // Спор открыт
      'cancelled',          // Отменена
      'expired'             // Истекло время
    ], 
    default: 'escrow_locked' 
  },
  escrowStatus: {
    type: String,
    enum: ['locked', 'released', 'returned', 'disputed'],
    default: 'locked'
  },
  paymentMethod: { type: String, enum: ['bank_transfer', 'sbp', 'qiwi', 'yoomoney'] },
  // Детали оплаты
  paymentDetails: {
    bankName: String,           // Название банка тейкера
    cardNumber: String,         // Номер карты тейкера
    recipientName: String,      // ФИО тейкера
    amount: Number              // Сумма к переводу
  },
  // Подтверждения
  buyerPaymentMade: { type: Boolean, default: false },      // Мейкер нажал "Платёж выполнен"
  sellerPaymentReceived: { type: Boolean, default: false }, // Тейкер подтвердил получение
  disputeReason: String,
  disputeOpenedAt: Date,
  disputeResolvedAt: Date,
  disputeResolvedBy: String,
  timeTracking: {
    createdAt: { type: Date, default: Date.now },
    escrowLockedAt: Date,
    paymentMadeAt: Date,        // Когда мейкер нажал "Платёж выполнен"
    paymentConfirmedAt: Date,   // Когда тейкер подтвердил получение
    escrowReleasedAt: Date,
    completedAt: Date,
    expiresAt: Date             // Автоотмена через 30 минут
  },
  // Связь между покупателем и продавцом
  messages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

// Add indexes for faster queries
p2pTradeSchema.index({ buyerId: 1, status: 1 });
p2pTradeSchema.index({ sellerId: 1, status: 1 });
p2pTradeSchema.index({ status: 1 });
p2pTradeSchema.index({ createdAt: -1 });

// Price History Schema
const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, required: true },
  priceRub: { type: Number, required: true },
  change24h: { type: Number, required: true },
  volume24h: { type: Number, required: true },
  ath: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Add indexes for faster queries
priceHistorySchema.index({ timestamp: -1 });

// Escrow Transaction Schema
const escrowTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2PTrade' },
  type: { type: String, enum: ['lock', 'release', 'refund'], required: true },
  tokenType: { type: String, enum: ['CES', 'POL'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  txHash: String,
  smartContractEscrowId: String, // ID эскроу в смарт-контракте
  reason: String,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

// Ruble Reserve Schema (for maker's reserved rubles)
const rubleReserveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2POrder' },
  tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'P2PTrade' },
  amount: { type: Number, required: true }, // Amount of rubles reserved
  type: { type: String, enum: ['order_reserve', 'trade_reserve'], required: true },
  status: { type: String, enum: ['reserved', 'used', 'released'], default: 'reserved' },
  reason: String,
  createdAt: { type: Date, default: Date.now },
  releasedAt: Date
});

// Add indexes for faster queries
escrowTransactionSchema.index({ userId: 1, type: 1 });
escrowTransactionSchema.index({ tradeId: 1 });
escrowTransactionSchema.index({ createdAt: -1 });

// Add indexes for ruble reserves
rubleReserveSchema.index({ userId: 1, status: 1 });
rubleReserveSchema.index({ orderId: 1 });
rubleReserveSchema.index({ tradeId: 1 });
rubleReserveSchema.index({ createdAt: -1 });

// Models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
const P2POrder = mongoose.models.P2POrder || mongoose.model('P2POrder', p2pOrderSchema);
const P2PTrade = mongoose.models.P2PTrade || mongoose.model('P2PTrade', p2pTradeSchema);
const PriceHistory = mongoose.models.PriceHistory || mongoose.model('PriceHistory', priceHistorySchema);
const EscrowTransaction = mongoose.models.EscrowTransaction || mongoose.model('EscrowTransaction', escrowTransactionSchema);
const RubleReserve = mongoose.models.RubleReserve || mongoose.model('RubleReserve', rubleReserveSchema);

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  User,
  Wallet,
  Transaction,
  P2POrder,
  P2PTrade,
  PriceHistory,
  EscrowTransaction,
  RubleReserve
};