/**
 * Configuration module
 * Manages all environment variables and configuration settings
 */

require('dotenv').config();

const config = {
  // Telegram Bot Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.WEBHOOK_URL || 'https://your-app-name.onrender.com',
    webhookPath: '/webhook',
    apiCallInterval: parseInt(process.env.API_CALL_INTERVAL) || 2000 // Reduced from 3000 to 2000ms
  },

  // Database Configuration
  database: {
    mongoUri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    }
  },

  // External APIs
  apis: {
    coinGecko: {
      apiKey: process.env.COINGECKO_API_KEY || 'CG-BPfsJZGKQVqocFQv3EJwS3H2',
      baseUrl: 'https://api.coingecko.com/api/v3'
    },
    exchangeRate: {
      baseUrl: 'https://api.exchangerate-api.com/v4/latest'
    }
  },

  // Wallet Configuration
  wallet: {
    encryptionKey: process.env.WALLET_ENCRYPTION_KEY,
    cesContractAddress: process.env.CES_CONTRACT_ADDRESS || '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610',
    polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000
  },

  // Scheduled Messages
  schedule: {
    groupId: '-1001632981391',
    timezone: 'Europe/Moscow',
    dailyTime: '0 19 * * *' // 19:00 Moscow time
  },

  // P2P Rating Legend Configuration
  p2pRatingLegend: [
    { min: 1000, emoji: '🐋', name: 'Кит рынка', range: '1000+' },
    { min: 500, max: 999, emoji: '🐺', name: 'Волк сделки', range: '500–999' },
    { min: 200, max: 499, emoji: '🦅', name: 'Ястреб графика', range: '200–499' },
    { min: 50, max: 199, emoji: '🐿️', name: 'Белка накопитель', range: '50–199' },
    { min: 0, max: 49, emoji: '🐹', name: 'Хомяк', range: '0–49' }
  ],

  // Escrow Configuration
  escrow: {
    // Timeout settings in minutes
    timeoutMinutes: parseInt(process.env.ESCROW_TIMEOUT_MINUTES) || 30,
    disputeTimeoutMinutes: parseInt(process.env.ESCROW_DISPUTE_TIMEOUT_MINUTES) || (24 * 60),
    
    // Smart contract settings
    useSmartContract: process.env.USE_SMART_CONTRACT_ESCROW === 'true',
    contractAddress: process.env.ESCROW_CONTRACT_ADDRESS,
    
    // Display settings
    displayFormat: {
      minutes: (minutes) => {
        if (minutes < 60) {
          return `${minutes} мин.`;
        } else if (minutes < 1440) {
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          return remainingMinutes > 0 ? `${hours} ч. ${remainingMinutes} мин.` : `${hours} ч.`;
        } else {
          const days = Math.floor(minutes / 1440);
          const remainingHours = Math.floor((minutes % 1440) / 60);
          return remainingHours > 0 ? `${days} д. ${remainingHours} ч.` : `${days} д.`;
        }
      }
    }
  },

  // Constants
  constants: {
    ivLength: 16,
    selfPingInterval: 14 * 60 * 1000, // 14 minutes
    cesSymbol: 'CES',
    supportedCurrencies: ['USD', 'RUB']
  }
};

// Validation
function validateConfig() {
  const required = [
    'telegram.botToken',
    'database.mongoUri'
  ];

  const missing = [];
  
  required.forEach(path => {
    const value = path.split('.').reduce((obj, key) => obj && obj[key], config);
    if (!value) {
      missing.push(path);
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

// Auto-validate on load
try {
  validateConfig();
  console.log('✅ Configuration loaded and validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

module.exports = config;