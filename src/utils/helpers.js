/**
 * Utility Functions
 * Common helper functions used across the application
 */

class Utils {
  // Format numbers for display
  static formatNumber(num) {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  // Format date for Russian locale
  static formatDate(date) {
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Validate Ethereum address
  static isValidEthereumAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Generate secure random string
  static generateSecureId(length = 32) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  // Delay execution
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Safe JSON parse
  static safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      return defaultValue;
    }
  }

  // Truncate string
  static truncateString(str, maxLength = 100) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  // Validate required environment variables
  static validateEnvVars(requiredVars) {
    const missing = [];
    
    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  // Calculate percentage change
  static calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  // Retry function with exponential backoff
  static async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await this.delay(delay);
      }
    }
  }

  // Clean and validate chat ID
  static validateChatId(chatId) {
    const cleaned = chatId.toString().trim();
    if (!/^-?\d+$/.test(cleaned)) {
      throw new Error('Invalid chat ID format');
    }
    return cleaned;
  }

  // Format price message components
  static formatPriceMessage(priceData) {
    const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
    const changeSign = priceData.change24h >= 0 ? '+' : '';
    const isNewATH = priceData.price >= priceData.ath;
    const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
    
    return {
      changeEmoji,
      changeSign,
      athDisplay,
      isNewATH
    };
  }

  // Log with timestamp
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    console.log(logMessage);
    
    if (data) {
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  }

  // Error logging
  static logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` (${context})` : '';
    
    console.error(`[${timestamp}] ERROR${contextStr}:`, error.message);
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error('Stack trace:', error.stack);
    }
  }
}

module.exports = Utils;