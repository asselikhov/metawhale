/**
 * Precision Utility Service
 * Handles precise financial calculations to avoid rounding errors
 */

class PrecisionUtil {
  /**
   * Multiply two numbers with precision handling
   * @param {number} a 
   * @param {number} b 
   * @param {number} decimals - Number of decimal places (default: 8)
   * @returns {number}
   */
  static multiply(a, b, decimals = 8) {
    const factor = Math.pow(10, decimals);
    return Math.round((a * b) * factor) / factor;
  }

  /**
   * Add two numbers with precision handling
   * @param {number} a 
   * @param {number} b 
   * @param {number} decimals 
   * @returns {number}
   */
  static add(a, b, decimals = 8) {
    const factor = Math.pow(10, decimals);
    return Math.round((a + b) * factor) / factor;
  }

  /**
   * Subtract two numbers with precision handling
   * @param {number} a 
   * @param {number} b 
   * @param {number} decimals 
   * @returns {number}
   */
  static subtract(a, b, decimals = 8) {
    const factor = Math.pow(10, decimals);
    return Math.round((a - b) * factor) / factor;
  }

  /**
   * Calculate commission with precision
   * @param {number} amount 
   * @param {number} rate - Commission rate (e.g., 0.01 for 1%)
   * @param {number} decimals 
   * @returns {number}
   */
  static calculateCommission(amount, rate, decimals = 4) {
    return this.multiply(amount, rate, decimals);
  }

  /**
   * Convert CES commission to ruble equivalent
   * @param {number} cesCommission 
   * @param {number} pricePerToken 
   * @param {number} decimals 
   * @returns {number}
   */
  static cesCommissionToRubles(cesCommission, pricePerToken, decimals = 2) {
    return this.multiply(cesCommission, pricePerToken, decimals);
  }

  /**
   * Format number for display with specific decimal places
   * @param {number} value 
   * @param {number} decimals 
   * @returns {string}
   */
  static formatNumber(value, decimals = 4) {
    return parseFloat(value.toFixed(decimals));
  }

  /**
   * Check if two numbers are equal within tolerance
   * @param {number} a 
   * @param {number} b 
   * @param {number} tolerance 
   * @returns {boolean}
   */
  static isEqual(a, b, tolerance = 0.0001) {
    return Math.abs(a - b) < tolerance;
  }

  /**
   * Ensure minimum precision for financial calculations
   * @param {number} value 
   * @returns {number}
   */
  static ensureMinimumPrecision(value) {
    // Ensure at least 4 decimal places for CES amounts
    return Math.round(value * 10000) / 10000;
  }
}

module.exports = PrecisionUtil;