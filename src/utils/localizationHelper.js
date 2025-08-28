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
  static getText(chatId, key) {
    return languageService.getText(chatId, key);
  }
  
  /**
   * Get user's language code
   * @param {string} chatId - Telegram chat ID
   * @returns {string} Language code
   */
  static getUserLanguage(chatId) {
    return languageService.getUserLanguage(chatId);
  }
  
  /**
   * Set user's language preference
   * @param {string} chatId - Telegram chat ID
   * @param {string} languageCode - Language code
   * @returns {boolean} Success status
   */
  static setUserLanguage(chatId, languageCode) {
    return languageService.setUserLanguage(chatId, languageCode);
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
  static getLocalizedMainMenu(chatId) {
    return [
      [
        this.getText(chatId, 'personal_cabinet'),
        this.getText(chatId, 'p2p'),
        this.getText(chatId, 'matrix'),
        this.getText(chatId, 'settings')
      ]
    ];
  }
  
  /**
   * Create localized keyboard with back button
   * @param {string} chatId - Telegram chat ID
   * @param {Array} buttons - Additional buttons to include
   * @returns {Object} Markup keyboard
   */
  static createLocalizedKeyboardWithBack(chatId, buttons = []) {
    const { Markup } = require('telegraf');
    const backButton = [Markup.button.callback(this.getText(chatId, 'back'), 'personal_cabinet')];
    return Markup.inlineKeyboard([...buttons, backButton]);
  }
}

module.exports = LocalizationHelper;