/**
 * Configuration module
 * Manages all environment variables and configuration settings
 */

require('dotenv').config();

const config = {
  // Telegram Bot Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.WEBHOOK_URL || 'https://metawhale.onrender.com',
    webhookPath: '/webhook',
    apiCallInterval: parseInt(process.env.API_CALL_INTERVAL) || 3000
  },

  // Database Configuration
  database: {
    mongoUri: process.env.MONGODB_URI
  },

  // External APIs
  apis: {
    coinMarketCap: {
      apiKey: process.env.CMC_API_KEY,
      baseUrl: 'https://pro-api.coinmarketcap.com'
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