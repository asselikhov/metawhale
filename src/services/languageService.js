/**
 * Language Service
 * Handles multi-language support for the Telegram bot interface
 */

class LanguageService {
  constructor() {
    // Supported languages with their configurations
    this.supportedLanguages = {
      'en': {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸',
        country: 'США'
      },
      'ru': {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский',
        flag: '🇷🇺',
        country: 'Россия'
      },
      'zh': {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        flag: '🇨🇳',
        country: 'Китай'
      },
      'hi': {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिन्दी',
        flag: '🇮🇳',
        country: 'Индия'
      },
      'yo': {
        code: 'yo',
        name: 'Yoruba',
        nativeName: 'Yorùbá',
        flag: '🇳🇬',
        country: 'Нигерия'
      },
      'vi': {
        code: 'vi',
        name: 'Vietnamese',
        nativeName: 'Tiếng Việt',
        flag: '🇻🇳',
        country: 'Вьетнам'
      },
      'ko': {
        code: 'ko',
        name: 'Korean',
        nativeName: '한국어',
        flag: '🇰🇷',
        country: 'Южная Корея'
      },
      'ja': {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        flag: '🇯🇵',
        country: 'Япония'
      },
      'pt': {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        flag: '🇧🇷',
        country: 'Бразилия'
      },
      'he': {
        code: 'he',
        name: 'Hebrew',
        nativeName: 'עברית',
        flag: '🇮🇱',
        country: 'Израиль'
      }
    };
    
    // Default language
    this.defaultLanguage = 'ru';
    
    // User language preferences (in a real implementation, this would be stored in the database)
    this.userLanguages = new Map();
  }
  
  // Get all supported languages
  getSupportedLanguages() {
    return Object.values(this.supportedLanguages);
  }
  
  // Get language configuration by code
  getLanguageConfig(languageCode) {
    return this.supportedLanguages[languageCode] || this.supportedLanguages[this.defaultLanguage];
  }
  
  // Set user language preference
  setUserLanguage(chatId, languageCode) {
    if (this.supportedLanguages[languageCode]) {
      this.userLanguages.set(chatId, languageCode);
      return true;
    }
    return false;
  }
  
  // Get user language preference
  getUserLanguage(chatId) {
    return this.userLanguages.get(chatId) || this.defaultLanguage;
  }
  
  // Get localized text for a key
  getText(chatId, key) {
    const languageCode = this.getUserLanguage(chatId);
    // In a real implementation, this would return localized strings
    // For now, we'll return Russian text as default
    return this.russianTexts[key] || key;
  }
  
  // Russian text translations (in a real implementation, we would have translations for all languages)
  russianTexts = {
    // Main menu
    'main_menu': '🌾 Главное меню',
    'personal_cabinet': '👤 ЛК',
    'p2p': '🔄 P2P',
    'matrix': '💠 Matrix',
    'settings': '⚙️',
    
    // Settings menu
    'settings_menu': '⚙️ Настройки',
    'select_language': '🌍 Выберите язык',
    'language_selected': '✅ Язык интерфейса установлен:',
    
    // Language names
    'usa': 'США',
    'russia': 'Россия',
    'china': 'Китай',
    'india': 'Индия',
    'nigeria': 'Нигерия',
    'vietnam': 'Вьетнам',
    'south_korea': 'Южная Корея',
    'japan': 'Япония',
    'brazil': 'Бразилия',
    'israel': 'Израиль',
    
    // Back button
    'back': '🔙 Назад'
  }
  
  // English text translations
  englishTexts = {
    // Main menu
    'main_menu': '🌾 Main Menu',
    'personal_cabinet': '👤 PC',
    'p2p': '🔄 P2P',
    'matrix': '💠 Matrix',
    'settings': '⚙️',
    
    // Settings menu
    'settings_menu': '⚙️ Settings',
    'select_language': '🌍 Select Language',
    'language_selected': '✅ Interface language set to:',
    
    // Language names
    'usa': 'USA',
    'russia': 'Russia',
    'china': 'China',
    'india': 'India',
    'nigeria': 'Nigeria',
    'vietnam': 'Vietnam',
    'south_korea': 'South Korea',
    'japan': 'Japan',
    'brazil': 'Brazil',
    'israel': 'Israel',
    
    // Back button
    'back': '🔙 Back'
  }
}

module.exports = new LanguageService();