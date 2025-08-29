/**
 * Configuration Manager
 * Centralized configuration management
 */

require('dotenv').config();

class Config {
  constructor() {
    this.validateAndLoad();
  }

  // Telegram Bot Configuration
  get telegram() {
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      webhookUrl: process.env.WEBHOOK_URL || 'https://your-app-name.onrender.com',
      webhookPath: '/webhook',
      apiCallInterval: parseInt(process.env.API_CALL_INTERVAL) || 2000
    };
  }

  // Database Configuration
  get database() {
    return {
      mongoUri: process.env.MONGODB_URI,
      options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      }
    };
  }

  // External APIs
  get apis() {
    return {
      coinGecko: {
        apiKey: process.env.COINGECKO_API_KEY || 'CG-BPfsJZGKQVqocFQv3EJwS3H2',
        baseUrl: 'https://api.coingecko.com/api/v3'
      },
      exchangeRate: {
        baseUrl: 'https://api.exchangerate-api.com/v4/latest'
      }
    };
  }

  // Wallet Configuration
  get wallet() {
    return {
      encryptionKey: process.env.WALLET_ENCRYPTION_KEY,
      cesContractAddress: process.env.CES_CONTRACT_ADDRESS || '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610',
      polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      alternativeRpcUrls: [
        'https://rpc.ankr.com/polygon',
        'https://polygon-mainnet.g.alchemy.com/v2/demo',
        'https://rpc-mainnet.matic.network',
        'https://matic-mainnet.chainstacklabs.com',
        'https://polygon-rpc.com'
      ]
    };
  }

  // Server Configuration
  get server() {
    return {
      port: process.env.PORT || 3000
    };
  }

  // Scheduled Messages
  get schedule() {
    return {
      groupId: '-1001632981391',
      timezone: 'Europe/Moscow',
      dailyTime: '0 19 * * *'
    };
  }

  // P2P Rating Legend Configuration
  get p2pRatingLegend() {
    return [
      { min: 1000, emoji: '🐋', name: 'Кит рынка', range: '1000+' },
      { min: 500, max: 999, emoji: '🐺', name: 'Волк сделки', range: '500–999' },
      { min: 200, max: 499, emoji: '🦅', name: 'Ястреб графика', range: '200–499' },
      { min: 50, max: 199, emoji: '🐿️', name: 'Белка накопитель', range: '50–199' },
      { min: 0, max: 49, emoji: '🐹', name: 'Хомяк', range: '0–49' }
    ];
  }

  // Escrow Configuration
  get escrow() {
    return {
      timeoutMinutes: parseInt(process.env.ESCROW_TIMEOUT_MINUTES) || 30,
      disputeTimeoutMinutes: parseInt(process.env.ESCROW_DISPUTE_TIMEOUT_MINUTES) || (24 * 60),
      useSmartContract: process.env.USE_SMART_CONTRACT_ESCROW === 'true',
      contractAddress: process.env.ESCROW_CONTRACT_ADDRESS,
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
    };
  }

  // Constants
  get constants() {
    return {
      ivLength: 16,
      selfPingInterval: 14 * 60 * 1000,
      cesSymbol: 'CES',
      supportedCurrencies: ['USD', 'RUB']
    };
  }

  // Validation
  validateAndLoad() {
    const required = [
      'telegram.botToken',
      'database.mongoUri'
    ];

    const missing = [];
    
    required.forEach(path => {
      const value = path.split('.').reduce((obj, key) => obj && obj[key], this);
      if (!value) {
        missing.push(path);
      }
    });

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }
}

module.exports = Config;