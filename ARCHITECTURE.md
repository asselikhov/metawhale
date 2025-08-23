# 🏗️ Modular Architecture Documentation

## 📋 Project Structure

The CES Price Telegram Bot has been completely restructured into a professional, modular architecture:

```
📦 Metawhale/
├── 📁 src/                          # Source code directory
│   ├── 📁 bot/                      # Bot initialization and configuration
│   │   └── 📄 index.js             # Bot setup, middleware, and handlers registration
│   ├── 📁 config/                   # Configuration management
│   │   └── 📄 index.js             # Environment variables and settings
│   ├── 📁 database/                 # Database models and connections
│   │   └── 📄 models.js            # MongoDB schemas (User, Wallet, Transaction, PriceHistory)
│   ├── 📁 handlers/                 # Message and callback handlers
│   │   └── 📄 messageHandler.js    # All Telegram interaction handlers
│   ├── 📁 services/                 # Business logic services
│   │   ├── 📄 priceService.js      # Price data fetching and processing
│   │   ├── 📄 walletService.js     # Wallet creation and blockchain operations
│   │   └── 📄 schedulerService.js  # Scheduled tasks and cron jobs
│   ├── 📁 server/                   # Express server and webhook management
│   │   └── 📄 index.js             # HTTP server, health checks, self-ping
│   └── 📁 utils/                    # Utility functions
│       └── 📄 index.js             # Helper functions and common utilities
├── 📄 app.js                        # Main application entry point
├── 📄 package.json                  # Dependencies and scripts (Yarn)
├── 📄 yarn.lock                     # Yarn lock file
├── 📄 render.yaml                   # Render deployment configuration
├── 📄 .env                          # Environment variables
├── 📄 .gitignore                    # Git ignore rules
├── 📄 README.md                     # Project documentation
└── 📄 index.js.backup              # Backup of old monolithic structure
```

## 🎯 Module Responsibilities

### 🤖 `/src/bot/` - Bot Core
- **Purpose**: Telegram bot initialization and configuration
- **Key Features**:
  - Bot instance creation with Telegraf
  - Middleware setup (error handling, logging)
  - Command and callback handler registration
  - Webhook configuration

### ⚙️ `/src/config/` - Configuration Management  
- **Purpose**: Centralized configuration and environment variables
- **Key Features**:
  - Environment variable validation
  - Configuration structure organization
  - Default values and constants
  - Auto-validation on startup

### 🗄️ `/src/database/` - Data Layer
- **Purpose**: Database models, schemas, and connections
- **Key Features**:
  - MongoDB connection management
  - Mongoose schemas (User, Wallet, Transaction, PriceHistory)
  - Graceful database disconnect
  - Connection error handling

### 📨 `/src/handlers/` - Message Processing
- **Purpose**: All Telegram message and callback handling
- **Key Features**:
  - Start command with main menu
  - Personal cabinet functionality
  - Price information display
  - Wallet management interfaces
  - P2P menu (placeholder)

### 🔧 `/src/services/` - Business Logic
- **PriceService**: 
  - CoinMarketCap API integration
  - ATH web scraping
  - USD/RUB currency conversion
  - Price data aggregation

- **WalletService**:
  - Ethereum/Polygon wallet creation
  - Private key encryption/decryption
  - CES balance checking
  - Wallet management operations

- **SchedulerService**:
  - Daily price message scheduling (19:00 Moscow)
  - Cron job management
  - Group message automation

### 🌐 `/src/server/` - Web Server
- **Purpose**: Express server for webhooks and health monitoring
- **Key Features**:
  - Webhook endpoint for Telegram
  - Health check endpoints
  - Self-ping mechanism for Render
  - Request logging and monitoring

### 🛠️ `/src/utils/` - Utilities
- **Purpose**: Common helper functions and utilities
- **Key Features**:
  - Number formatting
  - Date/time utilities
  - Validation functions
  - Error logging
  - Retry mechanisms

## 🚀 Application Lifecycle

### Initialization Sequence:
1. **Configuration Loading** - Environment validation
2. **Database Connection** - MongoDB connection establishment  
3. **Bot Webhook Setup** - Telegram webhook configuration
4. **Express Server Start** - HTTP server initialization
5. **Scheduler Start** - Cron jobs activation
6. **Self-Ping Setup** - Keep-alive mechanism (after 1 minute)

### Graceful Shutdown:
1. **Signal Detection** - SIGINT/SIGTERM handling
2. **Scheduler Stop** - All cron jobs termination
3. **Self-Ping Stop** - Keep-alive mechanism termination
4. **Bot Stop** - Telegram bot shutdown
5. **Server Stop** - Express server shutdown
6. **Database Disconnect** - MongoDB connection closure

## 📦 Package Management

### Yarn Configuration:
- **Primary Package Manager**: Yarn 1.22.22
- **Lock File**: yarn.lock (committed to repository)
- **Scripts**:
  - `yarn start` - Production mode
  - `yarn dev` - Development mode (Linux/macOS)
  - `yarn dev:win` - Development mode (Windows)

### Development vs Production:
- **Development**: Uses polling mode for local testing
- **Production**: Uses webhook mode for Render deployment

## 🔄 Migration Benefits

### From Monolithic (38.9KB index.js) to Modular:

#### ✅ **Improved Maintainability**:
- **Separation of Concerns**: Each module has a single responsibility
- **Code Organization**: Related functionality grouped together  
- **Easier Debugging**: Issues isolated to specific modules
- **Scalability**: Easy to add new features without affecting existing code

#### ✅ **Enhanced Developer Experience**:
- **Clearer Structure**: Easy navigation and understanding
- **Reusable Components**: Services can be reused across handlers
- **Better Testing**: Individual modules can be unit tested
- **Version Control**: Cleaner diffs and merge conflicts resolution

#### ✅ **Professional Standards**:
- **Industry Best Practices**: Follows Node.js/Express conventions
- **Configuration Management**: Centralized and validated settings
- **Error Handling**: Consistent error handling across modules
- **Logging**: Structured logging with timestamps and context

#### ✅ **Operational Improvements**:
- **Graceful Shutdown**: Proper cleanup of resources
- **Health Monitoring**: Comprehensive health check endpoints
- **Environment Flexibility**: Easy switching between dev/prod modes
- **Dependency Management**: Yarn for faster, more reliable installs

## 🎯 Key Features Maintained:

- ✅ **Wallet System**: Complete Polygon wallet functionality
- ✅ **Price Monitoring**: Real-time CES token price tracking
- ✅ **Scheduled Messages**: Daily group price updates (19:00 Moscow)
- ✅ **Main Menu**: Interactive buttons for navigation
- ✅ **Personal Cabinet**: Wallet management and balance display
- ✅ **Security**: Encrypted private key storage
- ✅ **Multi-API Integration**: CoinMarketCap + ExchangeRate APIs
- ✅ **Web Scraping**: ATH data extraction fallback
- ✅ **Database Storage**: MongoDB with comprehensive schemas

## 📈 Performance & Reliability:

- **Memory Optimization**: Modular loading reduces memory footprint
- **Error Isolation**: Module failures don't crash entire application
- **Restart Capability**: Individual services can be restarted
- **Monitoring**: Better observability and debugging capabilities
- **Resource Management**: Proper cleanup and resource disposal

## 🔧 Development Workflow:

### Local Development:
```bash
yarn dev          # Linux/macOS
yarn dev:win      # Windows
```

### Production Deployment:
```bash
yarn install      # Install dependencies
yarn start        # Start in production mode
```

### Environment Variables:
All configuration centralized in `/src/config/index.js` with validation.

This modular architecture provides a solid foundation for future enhancements while maintaining all existing functionality with improved reliability and maintainability.