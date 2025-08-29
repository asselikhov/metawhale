/**
 * Localization Helper
 * Utility functions for working with localized texts in the Telegram bot
 */

const languageService = require('../services/languageService');

class LocalizationHelper {
  /**
   * Get localized text for a user
   * @param {string} chatId - Telegram chat ID
   * @param {string} key - Translation key
   * @returns {string} Localized text
   */
  static async getText(chatId, key) {
    return languageService.getText(chatId, key);
  }
  
  /**
   * Get user's language code
   * @param {string} chatId - Telegram chat ID
   * @returns {string} Language code
   */
  static async getUserLanguage(chatId) {
    return await languageService.getUserLanguage(chatId);
  }
  
  /**
   * Set user's language preference
   * @param {string} chatId - Telegram chat ID
   * @param {string} languageCode - Language code
   * @returns {boolean} Success status
   */
  static async setUserLanguage(chatId, languageCode) {
    return await languageService.setUserLanguage(chatId, languageCode);
  }
  
  /**
   * Get all supported languages
   * @returns {Array} Array of supported languages
   */
  static getSupportedLanguages() {
    return languageService.getSupportedLanguages();
  }
  
  /**
   * Get language configuration
   * @param {string} languageCode - Language code
   * @returns {Object} Language configuration
   */
  static getLanguageConfig(languageCode) {
    return languageService.getLanguageConfig(languageCode);
  }
  
  /**
   * Localize main menu buttons
   * @param {string} chatId - Telegram chat ID
   * @returns {Array} Localized main menu buttons
   */
  static async getLocalizedMainMenu(chatId) {
    // Ensure we always return the correct main menu structure
    const personalCabinet = await this.getText(chatId, 'personal_cabinet');
    const p2p = await this.getText(chatId, 'p2p');
    const matrix = await this.getText(chatId, 'matrix');
    const settings = await this.getText(chatId, 'settings');
    
    return [
      [personalCabinet, p2p, matrix, settings]
    ];
  }
  
  /**
   * Create localized keyboard with back button
   * @param {string} chatId - Telegram chat ID
   * @param {Array} buttons - Additional buttons to include
   * @returns {Object} Markup keyboard
   */
  static async createLocalizedKeyboardWithBack(chatId, buttons = []) {
    const { Markup } = require('telegraf');
    const backButton = [Markup.button.callback(await this.getText(chatId, 'back'), 'personal_cabinet')];
    return Markup.inlineKeyboard([...buttons, backButton]);
  }
}

module.exports = LocalizationHelper;