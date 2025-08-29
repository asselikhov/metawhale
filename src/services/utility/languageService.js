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
    
    // Text translations for all supported languages
    this.translations = {
      // Russian (default)
      'ru': {
        // Main menu
        'main_menu': '🌾 Главное меню',
        'personal_cabinet': '👤 ЛК',
        'p2p': '🔄 P2P',
        'matrix': '💠 Matrix',
        'settings': '⚙️ Настройки',
        
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
        'back': '🔙 Назад',
        
        // Personal cabinet
        'personal_cabinet_title': '👤 ЛИЧНЫЙ КАБИНЕТ',
        'wallet_not_created': '⚠️ Кошелек не создан',
        'create_wallet_instruction': '💡 Создайте кошелек для хранения токенов в разных сетях',
        'supported_networks': '🌐 Поддерживаемые сети:',
        'create_wallet': '➕ Создать кошелек',
        'back_to_menu': '🔙 Назад',
        'home_menu': '🏠 Главное меню',
        
        // Wallet
        'wallet': '💳 Кошелек',
        'transfer': '💸 Перевод',
        'refresh': '🔄 Обновить',
        'wallet_edit': '⚙️ Редактирование кошелька',
        'show_private_key': '🔑 Показать приватный ключ',
        'export_wallet': '📤 Экспорт кошелька',
        'delete_wallet': '🗑 Удалить кошелек',
        'back_to_cabinet': '🔙 Назад к кабинету',
        'wallet_details': '💳 КОШЕЛЕК',
        'wallet_address': 'Адрес:',
        'private_key': 'Приватный ключ:',
        'important': '⚠️ Важно:',
        'save_data_safely': 'Сохраните данные в безопасном месте',
        'do_not_share_key': 'Никому не передавайте приватный ключ',
        'use_for_import': 'Используйте для импорта в другие кошельки',
        'delete_wallet_confirmation': '⚠️ Подтверждение удаления',
        'delete_wallet_question': '🗑 Вы уверены, что хотите удалить кошелек?',
        'delete_warning': '❗ Это действие нельзя отменить!',
        'delete_all_data': '• Все данные кошелька будут удалены',
        'lose_access': '• Доступ к средствам будет утрачен',
        'yes_delete': '✅ Да, удалить',
        'cancel': '❌ Отмена',
        'wallet_deleted': '✅ Кошелек успешно удален',
        'all_data_deleted': '🗑 Все данные кошелька удалены',
        'create_new_wallet': '🔄 Вы можете создать новый кошелек',
        'create_new': '➕ Создать новый',
        'to_personal_cabinet': '🔙 К личному кабинету',
        
        // Network switching
        'network_selection': '🌐 ВЫБОР БЛОКЧЕЙН СЕТИ',
        'choose_network': '🔄 Выберите сеть для работы:',
        'current_network': 'Текущая сеть:',
        'network_change_warning': '⚠️ При смене сети будут показаны балансы токенов этой сети',
        'network_switched': '🌐 СЕТЬ ПЕРЕКЛЮЧЕНА',
        'active_network': 'Активная сеть:',
        'no_wallet_in_network': '⚠️ У вас нет кошелька для этой сети',
        'create_wallet_for_network': '💡 Создайте кошелек для работы с токенами в сети',
        'store_tokens': '• Хранение токенов',
        'p2p_trading': '• P2P торговля',
        'transfers': '• Переводы',
        
        // P2P
        'p2p_exchange': '🔄 P2P БИРЖА',
        'market': '📊 Рынок',
        'my_orders': '📋 Мои ордера',
        'top': '🏆 Топ',
        'analytics': '🧮 Аналитика',
        'my_data': '📑 Мои данные',
        'buy_ces': '📈 Купить CES',
        'sell_ces': '📉 Продать CES',
        'buy': '📈 Купить',
        'sell': '📉 Продать',
        'back_to_p2p': '🔙 Назад к P2P',
        
        // P2P additional
        'orders_last_30_days': 'Исполненные ордеры за 30 дней',
        'pieces': 'шт.',
        'completion_rate_30_days': 'Процент исполнения за 30 дней',
        'avg_transfer_time': 'Среднее время перевода',
        'avg_payment_time': 'Среднее время оплаты',
        'rating': 'Рейтинг',
        'which_token_trade': 'КАКУЮ МОНЕТУ ВЫ ХОТИТЕ ТОРГОВАТЬ?',
        'select_token_for_network': 'Выберите токен для торговли в сети',
        'minutes': 'мин.',
        
        // Errors
        'error_loading': '❌ Ошибка загрузки данных. Попробуйте позже.',
        'error_creating_wallet': '❌ Ошибка создания кошелька.',
        'error_loading_cabinet': '❌ Ошибка загрузки личного кабинета. Попробуйте позже.',
        'error_loading_menu': '❌ Ошибка загрузки меню. Попробуйте позже.',
        'try_again': '🔄 Повторить',
        'loading_data': '⏳ Загружаем актуальные данные...',
        'loading': '⏳ Загружаем данные...',
      },
      
      // English
      'en': {
        // Main menu
        'main_menu': '🌾 Main Menu',
        'personal_cabinet': '👤 PC',
        'p2p': '🔄 P2P',
        'matrix': '💠 Matrix',
        'settings': '⚙️ Settings',
        
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
        'back': '🔙 Back',
        
        // Personal cabinet
        'personal_cabinet_title': '👤 PERSONAL CABINET',
        'wallet_not_created': '⚠️ Wallet not created',
        'create_wallet_instruction': '💡 Create a wallet to store tokens in different networks',
        'supported_networks': '🌐 Supported networks:',
        'create_wallet': '➕ Create Wallet',
        'back_to_menu': '🔙 Back',
        'home_menu': '🏠 Main Menu',
        
        // Wallet
        'wallet': '💳 Wallet',
        'transfer': '💸 Transfer',
        'refresh': '🔄 Refresh',
        'wallet_edit': '⚙️ Wallet Editing',
        'show_private_key': '🔑 Show Private Key',
        'export_wallet': '📤 Export Wallet',
        'delete_wallet': '🗑 Delete Wallet',
        'back_to_cabinet': '🔙 Back to Cabinet',
        'wallet_details': '💳 WALLET',
        'wallet_address': 'Address:',
        'private_key': 'Private Key:',
        'important': '⚠️ Important:',
        'save_data_safely': 'Save data in a safe place',
        'do_not_share_key': 'Do not share private key with anyone',
        'use_for_import': 'Use to import into other wallets',
        'delete_wallet_confirmation': '⚠️ Delete Confirmation',
        'delete_wallet_question': '🗑 Are you sure you want to delete the wallet?',
        'delete_warning': '❗ This action cannot be undone!',
        'delete_all_data': '• All wallet data will be deleted',
        'lose_access': '• Access to funds will be lost',
        'yes_delete': '✅ Yes, Delete',
        'cancel': '❌ Cancel',
        'wallet_deleted': '✅ Wallet Successfully Deleted',
        'all_data_deleted': '🗑 All wallet data deleted',
        'create_new_wallet': '🔄 You can create a new wallet',
        'create_new': '➕ Create New',
        'to_personal_cabinet': '🔙 To Personal Cabinet',
        
        // Network switching
        'network_selection': '🌐 BLOCKCHAIN NETWORK SELECTION',
        'choose_network': '🔄 Choose network to work with:',
        'current_network': 'Current network:',
        'network_change_warning': '⚠️ When switching networks, token balances of that network will be shown',
        'network_switched': '🌐 NETWORK SWITCHED',
        'active_network': 'Active network:',
        'no_wallet_in_network': '⚠️ You don\'t have a wallet for this network',
        'create_wallet_for_network': '💡 Create a wallet to work with tokens in the network',
        'store_tokens': '• Token storage',
        'p2p_trading': '• P2P trading',
        'transfers': '• Transfers',
        
        // P2P
        'p2p_exchange': '🔄 P2P EXCHANGE',
        'market': '📊 Market',
        'my_orders': '📋 My Orders',
        'top': '🏆 Top',
        'analytics': '🧮 Analytics',
        'my_data': '📑 My Data',
        'buy_ces': '📈 Buy CES',
        'sell_ces': '📉 Sell CES',
        'buy': '📈 Buy',
        'sell': '📉 Sell',
        'back_to_p2p': '🔙 Back to P2P',
        
        // P2P additional
        'orders_last_30_days': 'Orders executed in 30 days',
        'pieces': 'pcs.',
        'completion_rate_30_days': 'Completion rate in 30 days',
        'avg_transfer_time': 'Average transfer time',
        'avg_payment_time': 'Average payment time',
        'rating': 'Rating',
        'which_token_trade': 'WHICH TOKEN DO YOU WANT TO TRADE?',
        'select_token_for_network': 'Select token for trading in network',
        'minutes': 'min.',
        
        // Errors
        'error_loading': '❌ Error loading data. Please try again later.',
        'error_creating_wallet': '❌ Error creating wallet.',
        'error_loading_cabinet': '❌ Error loading personal cabinet. Please try again later.',
        'error_loading_menu': '❌ Error loading menu. Please try again later.',
        'try_again': '🔄 Try Again',
        'loading_data': '⏳ Loading actual data...',
        'loading': '⏳ Loading data...',
      },
      
      // Chinese
      'zh': {
        // Main menu
        'main_menu': '🌾 主菜单',
        'personal_cabinet': '👤 个人中心',
        'p2p': '🔄 P2P',
        'matrix': '💠 Matrix',
        'settings': '⚙️ 设置',
        
        // Settings menu
        'settings_menu': '⚙️ 设置',
        'select_language': '🌍 选择语言',
        'language_selected': '✅ 界面语言已设置为:',
        
        // Language names
        'usa': '美国',
        'russia': '俄罗斯',
        'china': '中国',
        'india': '印度',
        'nigeria': '尼日利亚',
        'vietnam': '越南',
        'south_korea': '韩国',
        'japan': '日本',
        'brazil': '巴西',
        'israel': '以色列',
        
        // Back button
        'back': '🔙 返回',
        
        // Personal cabinet
        'personal_cabinet_title': '👤 个人中心',
        'wallet_not_created': '⚠️ 钱包未创建',
        'create_wallet_instruction': '💡 创建钱包以在不同网络中存储代币',
        'supported_networks': '🌐 支持的网络:',
        'create_wallet': '➕ 创建钱包',
        'back_to_menu': '🔙 返回',
        'home_menu': '🏠 主菜单',
        
        // Wallet
        'wallet': '💳 钱包',
        'transfer': '💸 转账',
        'refresh': '🔄 刷新',
        'wallet_edit': '⚙️ 钱包编辑',
        'show_private_key': '🔑 显示私钥',
        'export_wallet': '📤 导出钱包',
        'delete_wallet': '🗑 删除钱包',
        'back_to_cabinet': '🔙 返回个人中心',
        'wallet_details': '💳 钱包',
        'wallet_address': '地址:',
        'private_key': '私钥:',
        'important': '⚠️ 重要:',
        'save_data_safely': '将数据保存在安全的地方',
        'do_not_share_key': '不要与任何人分享私钥',
        'use_for_import': '用于导入其他钱包',
        'delete_wallet_confirmation': '⚠️ 删除确认',
        'delete_wallet_question': '🗑 您确定要删除钱包吗?',
        'delete_warning': '❗ 此操作无法撤销!',
        'delete_all_data': '• 所有钱包数据将被删除',
        'lose_access': '• 资金访问权限将丢失',
        'yes_delete': '✅ 是的，删除',
        'cancel': '❌ 取消',
        'wallet_deleted': '✅ 钱包删除成功',
        'all_data_deleted': '🗑 所有钱包数据已删除',
        'create_new_wallet': '🔄 您可以创建新钱包',
        'create_new': '➕ 创建新钱包',
        'to_personal_cabinet': '🔙 返回个人中心',
        
        // Network switching
        'network_selection': '🌐 区块链网络选择',
        'choose_network': '🔄 选择要使用的网络:',
        'current_network': '当前网络:',
        'network_change_warning': '⚠️ 切换网络时将显示该网络的代币余额',
        'network_switched': '🌐 网络已切换',
        'active_network': '活动网络:',
        'no_wallet_in_network': '⚠️ 您在此网络中没有钱包',
        'create_wallet_for_network': '💡 创建钱包以在网络中使用代币',
        'store_tokens': '• 代币存储',
        'p2p_trading': '• P2P交易',
        'transfers': '• 转账',
        
        // P2P
        'p2p_exchange': '🔄 P2P交易',
        'market': '📊 市场',
        'my_orders': '📋 我的订单',
        'top': '🏆 排行榜',
        'analytics': '🧮 分析',
        'my_data': '📑 我的数据',
        'buy_ces': '📈 购买CES',
        'sell_ces': '📉 出售CES',
        'buy': '📈 购买',
        'sell': '📉 出售',
        'back_to_p2p': '🔙 返回P2P',
        
        // P2P additional
        'orders_last_30_days': '30天内执行的订单',
        'pieces': '件',
        'completion_rate_30_days': '30天完成率',
        'avg_transfer_time': '平均转账时间',
        'avg_payment_time': '平均付款时间',
        'rating': '评分',
        'which_token_trade': '您想交易哪种代币？',
        'select_token_for_network': '选择网络中的交易代币',
        'minutes': '分钟',
        
        // Errors
        'error_loading': '❌ 加载数据时出错。请稍后再试。',
        'error_creating_wallet': '❌ 创建钱包时出错。',
        'error_loading_cabinet': '❌ 加载个人中心时出错。请稍后再试。',
        'error_loading_menu': '❌ 加载菜单时出错。请稍后再试。',
        'try_again': '🔄 重试',
        'loading_data': '⏳ 正在加载实际数据...',
        'loading': '⏳ 正在加载数据...',
      }
    };
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
  async setUserLanguage(chatId, languageCode) {
    if (this.supportedLanguages[languageCode]) {
      try {
        const { User } = require('../../database/models');
        await User.findOneAndUpdate(
          { chatId },
          { language: languageCode },
          { upsert: true, new: true }
        );
        return true;
      } catch (error) {
        console.error('Error setting user language:', error);
        return false;
      }
    }
    return false;
  }

  // Get user language preference
  async getUserLanguage(chatId) {
    try {
      const { User } = require('../../database/models');
      const user = await User.findOne({ chatId });
      return (user && user.language) ? user.language : this.defaultLanguage;
    } catch (error) {
      console.error('Error getting user language:', error);
      return this.defaultLanguage;
    }
  }
  
  // Get localized text for a key
  async getText(chatId, key) {
    const languageCode = await this.getUserLanguage(chatId);
    const languageTranslations = this.translations[languageCode];
    
    if (languageTranslations && languageTranslations[key]) {
      return languageTranslations[key];
    }
    
    // Fallback to Russian if translation not found
    const russianTranslations = this.translations['ru'];
    return russianTranslations[key] || key;
  }
  
  // Get all translations for a language
  getTranslations(languageCode) {
    return this.translations[languageCode] || this.translations[this.defaultLanguage];
  }
}

module.exports = new LanguageService();