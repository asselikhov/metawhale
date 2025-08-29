/**
 * Logger Manager
 * Centralized logging functionality
 */

class Logger {
  constructor() {
    this.levels = {
      ERROR: 'error',
      WARN: 'warn',
      INFO: 'info',
      DEBUG: 'debug'
    };
  }

  error(message, context = '') {
    console.error(`[ERROR] ${context ? `[${context}] ` : ''}${message}`);
  }

  warn(message, context = '') {
    console.warn(`[WARN] ${context ? `[${context}] ` : ''}${message}`);
  }

  info(message, context = '') {
    console.log(`[INFO] ${context ? `[${context}] ` : ''}${message}`);
  }

  debug(message, context = '') {
    console.debug(`[DEBUG] ${context ? `[${context}] ` : ''}${message}`);
  }

  log(level, message, context = '') {
    switch (level) {
      case this.levels.ERROR:
        this.error(message, context);
        break;
      case this.levels.WARN:
        this.warn(message, context);
        break;
      case this.levels.INFO:
        this.info(message, context);
        break;
      case this.levels.DEBUG:
        this.debug(message, context);
        break;
      default:
        this.info(message, context);
    }
  }
}

module.exports = Logger;