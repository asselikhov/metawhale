const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const cron = require('node-cron');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Настройка webhook URL
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://metawhale.onrender.com';
const WEBHOOK_PATH = '/webhook';
const WEBHOOK_FULL_URL = WEBHOOK_URL + WEBHOOK_PATH;

console.log(`🔗 Webhook URL: ${WEBHOOK_FULL_URL}`);

// Схема пользователя MongoDB
const userSchema = new mongoose.Schema({
  chatId: { type: String, unique: true, required: true },
  username: String,
  firstName: String,
  lastName: String,
  isActive: { type: Boolean, default: true },
  subscribedAt: { type: Date, default: Date.now },
  lastNotified: Date,
  language: { type: String, default: 'ru' }
});

const User = mongoose.model('User', userSchema);

// Схема истории цен
const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  change24h: Number,
  marketCap: Number,
  volume24h: Number,
  priceRub: Number,
  changeRub24h: Number,
  ath: Number // ATH (All Time High) в USD
});

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Подключен к MongoDB');
    // Устанавливаем webhook после подключения к базе
    bot.telegram.setWebhook(WEBHOOK_FULL_URL)
      .then(() => console.log('✅ Webhook установлен:', WEBHOOK_FULL_URL))
      .catch(err => console.error('❌ Ошибка установки webhook:', err));
  })
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// Команда /start
bot.start(async (ctx) => {
  const welcomeMessage = 'Добро пожаловать в Rustling Grass 🌾 assistant !';
  await ctx.reply(welcomeMessage);
});

// Команда /price
bot.command('price', async (ctx) => {
  await sendPriceToUser(ctx);
});

// Глобальная переменная для отслеживания последнего запроса к API
let lastApiCall = 0;
const API_CALL_INTERVAL = parseInt(process.env.API_CALL_INTERVAL) || 10000; // 10 секунд между запросами

// Функция создания графиков удалена для ускорения работы бота



// Функция получения курса USD/RUB
async function getUSDToRUBRate() {
  try {
    // Используем бесплатный API для конвертации валют
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 5000
    });
    
    if (response.data && response.data.rates && response.data.rates.RUB) {
      const rate = response.data.rates.RUB;
      console.log(`💱 Курс USD/RUB: ${rate}`);
      return rate;
    }
    
    console.log('⚠️ Курс RUB не найден в ответе API');
    return 100; // Fallback курс
  } catch (error) {
    console.log('⚠️ Ошибка получения курса USD/RUB:', error.message);
    return 100; // Fallback курс ~100 рублей за доллар
  }
}

// Функция получения данных ATH из CoinMarketCap
async function getCMCPrice() {
  try {
    if (!process.env.CMC_API_KEY) {
      console.log('⚠️ CMC API ключ не найден, пропускаем CoinMarketCap');
      return null;
    }

    console.log('🔍 Получаем данные CES токена с Polygon...');
    
    // Метод 1: Прямой запрос по ID 36465 (Whalebit CES на Polygon)
    try {
      const response = await axios.get(
        'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
        {
          headers: {
            'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
            'Accept': 'application/json'
          },
          params: {
            id: '36465', // ID для Whalebit (CES) на Polygon
            convert: 'USD' // Бесплатный план поддерживает только 1 валюту
          },
          timeout: 10000
        }
      );

      console.log('📊 CMC API Response status:', response.status);
      
      if (response.data && response.data.data && response.data.data['36465']) {
        const cesData = response.data.data['36465'];
        const quote = cesData.quote;
        
        if (quote.USD) {
          console.log('✅ Данные получены из CoinMarketCap (Whalebit)');
          console.log(`💰 Цена: $${quote.USD.price?.toFixed(6)}`);
          console.log(`📈 Изменение 24ч: ${quote.USD.percent_change_24h?.toFixed(2)}%`);
          
          // Получаем курс USD/RUB для конвертации
          const usdToRubRate = await getUSDToRUBRate();
          const priceRub = quote.USD.price * usdToRubRate;
          
          return {
            price: quote.USD.price,
            priceRub: priceRub,
            change24h: quote.USD.percent_change_24h,
            marketCap: quote.USD.market_cap,
            volume24h: quote.USD.volume_24h,
            ath: null, // ATH недоступен в бесплатном плане CMC
            source: 'coinmarketcap'
          };
        }
      }
    } catch (idError) {
      console.log('⚠️ Поиск по ID 36465 неудачен:', idError.message);
      
      if (idError.response) {
        console.log('❌ CMC API Error (ID):', idError.response.status, idError.response.data);
      }
    }
    
    // Метод 2: Fallback - поиск по символу с фильтрацией
    console.log('🔄 Fallback: поиск по символу CES...');
    
    try {
      const response = await axios.get(
        'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
        {
          headers: {
            'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
            'Accept': 'application/json'
          },
          params: {
            symbol: 'CES',
            convert: 'USD' // Бесплатный план поддерживает только 1 валюту
          },
          timeout: 10000
        }
      );
      
      if (response.data && response.data.data && response.data.data.CES) {
        const cesTokens = response.data.data.CES;
        console.log(`🎯 Найдено ${cesTokens.length} токен(ов) с символом CES`);
        
        // Ищем токен на Polygon сети или с нашим контрактом
        let cesData = cesTokens.find(token => 
          (token.platform && token.platform.name && token.platform.name.toLowerCase().includes('polygon')) ||
          (token.platform && token.platform.token_address && 
           token.platform.token_address.toLowerCase() === '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610')
        );
        
        // Если не найден на Polygon, берем первый
        if (!cesData && cesTokens.length > 0) {
          cesData = cesTokens[0];
          console.log('⚠️ Токен CES на Polygon не найден, используем первый результат');
        }
        
        if (cesData && cesData.quote && cesData.quote.USD) {
          const quote = cesData.quote;
          console.log('✅ Данные получены из CoinMarketCap (fallback)');
          
          // Получаем курс USD/RUB для конвертации
          const usdToRubRate = await getUSDToRUBRate();
          const priceRub = quote.USD.price * usdToRubRate;
          
          return {
            price: quote.USD.price,
            priceRub: priceRub,
            change24h: quote.USD.percent_change_24h,
            marketCap: quote.USD.market_cap,
            volume24h: quote.USD.volume_24h,
            ath: null, // ATH недоступен в бесплатном плане CMC
            source: 'coinmarketcap'
          };
        }
      }
    } catch (symbolError) {
      console.log('⚠️ Поиск по символу CES неудачен:', symbolError.message);
      
      if (symbolError.response) {
        console.log('❌ CMC API Error (Symbol):', symbolError.response.status, symbolError.response.data);
      }
    }

    console.log('⚠️ CES токен не найден в CoinMarketCap всеми методами');
    return null;
  } catch (error) {
    console.log('⚠️ Общая ошибка CoinMarketCap API:', error.message);
    if (error.response) {
      console.log('❌ HTTP Status:', error.response.status);
      console.log('❌ Response data:', error.response.data);
    }
    return null;
  }
}

// Функция получения цены CES через CoinMarketCap
async function getCESPrice() {
  try {
    // Проверяем интервал между запросами
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    
    if (timeSinceLastCall < API_CALL_INTERVAL) {
      const waitTime = API_CALL_INTERVAL - timeSinceLastCall;
      console.log(`⏳ Ожидание ${waitTime}мс перед следующим запросом к API`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastApiCall = Date.now();
    
    // Получаем данные из CoinMarketCap
    const cmcData = await getCMCPrice();
    if (cmcData) {
      // Получаем ATH из базы данных, так как CMC бесплатный план не предоставляет ATH
      console.log('🔍 Получаем ATH из базы данных...');
      const maxPriceRecord = await PriceHistory.findOne().sort({ price: -1 });
      const databaseATH = maxPriceRecord ? maxPriceRecord.price : cmcData.price;
      
      // Определяем окончательный ATH (максимум из базы или текущая цена)
      const finalATH = Math.max(databaseATH, cmcData.price);
      
      if (cmcData.price >= finalATH) {
        console.log(`🏆 Новый ATH обнаружен! $${cmcData.price.toFixed(2)}`);
      }
      
      console.log(`📊 ATH из базы данных: $${databaseATH.toFixed(2)}`);
      console.log(`📊 Финальный ATH: $${finalATH.toFixed(2)}`);
      
      return {
        price: cmcData.price,
        priceRub: cmcData.priceRub,
        change24h: cmcData.change24h,
        changeRub24h: 0, // CMC не предоставляет данных в рублях
        marketCap: cmcData.marketCap,
        volume24h: cmcData.volume24h,
        ath: finalATH, // ATH из базы данных с учетом текущей цены
        source: 'coinmarketcap'
      };
    }

    throw new Error('Не удалось получить данные CES из CoinMarketCap');
  } catch (error) {
    console.error('Ошибка получения цены CES:', error.message);
    
    // Возвращаем последнюю сохраненную цену из базы данных
    const lastPrice = await PriceHistory.findOne().sort({ timestamp: -1 });
    if (lastPrice) {
      console.log('⚡ Используем последнюю сохраненную цену из базы данных');
      
      // Если нужно, конвертируем в рубли
      let priceRub = lastPrice.priceRub || 0;
      if (!priceRub && lastPrice.price) {
        const usdToRubRate = await getUSDToRUBRate();
        priceRub = lastPrice.price * usdToRubRate;
      }
      
      return {
        price: lastPrice.price,
        priceRub: priceRub,
        change24h: lastPrice.change24h || 0,
        changeRub24h: lastPrice.changeRub24h || 0,
        marketCap: lastPrice.marketCap || 0,
        volume24h: lastPrice.volume24h || 0,
        ath: lastPrice.ath || lastPrice.price,
        source: 'database',
        cached: true
      };
    }
    
    throw error;
  }
}

// Функция отправки цены конкретному пользователю
async function sendPriceToUser(ctx) {
  try {
    const priceData = await getCESPrice();
    
    // Сохраняем данные в базу (только при вызове /price)
    if (!priceData.cached) {
      await new PriceHistory(priceData).save();
      console.log(`💾 Данные о цене сохранены: $${priceData.price.toFixed(2)} | ATH: $${priceData.ath.toFixed(2)}`);
    }
    
    // Определяем эмодзи для изменения цены
    const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻'; // 🔺 для роста, 🔻 для падения
    const changeSign = priceData.change24h >= 0 ? '+' : '';
    
    // Проверяем, не является ли текущая цена ATH
    const isNewATH = priceData.price >= priceData.ath;
    const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
    
    // Индикатор источника данных
    const sourceEmoji = priceData.source === 'database' ? '🗄️' : '🄲🄼🄲';
    
    // Новый формат сообщения согласно требованиям
    const message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $ ${priceData.price.toFixed(2)}${priceData.priceRub > 0 ? ` | ₽ ${priceData.priceRub.toFixed(2)}` : ' | ₽ 0.00'} ${sourceEmoji}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(2)}% • 🅥 $ ${formatNumber(priceData.volume24h)} • 🅐🅣🅗 ${athDisplay}`;
    
    // Отправляем только текстовое сообщение для максимальной скорости
    await ctx.reply(message);
    
  } catch (error) {
    console.error('Ошибка отправки цены пользователю:', error);
    await ctx.reply('❌ Не удается получить цену CES в данный момент. Попробуйте позже.');
  }
}

// Утилита для форматирования больших чисел
function formatNumber(num) {
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

// Express сервер для webhook и проверки здоровья
const app = express();

// Middleware для парсинга JSON
app.use(express.json());

// Webhook endpoint для Telegram
app.use(bot.webhookCallback(WEBHOOK_PATH));

// Keep-alive endpoint для предотвращения засыпания на Render
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    message: 'Бот активен и работает'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CES Price Telegram Bot работает',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    const userCount = await User.countDocuments({ isActive: true });
    const lastPrice = await PriceHistory.findOne().sort({ timestamp: -1 });
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeUsers: userCount,
      lastPriceUpdate: lastPrice ? lastPrice.timestamp : null,
      lastPrice: lastPrice ? lastPrice.price : null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Сервер проверки здоровья запущен на порту ${PORT}`);
});

// Функция самопинга для предотвращения засыпания на Render
function setupSelfPing() {
  const SELF_PING_INTERVAL = 14 * 60 * 1000; // 14 минут
  const selfPingUrl = `${WEBHOOK_URL}/ping`;
  
  setInterval(async () => {
    try {
      const response = await axios.get(selfPingUrl, { timeout: 10000 });
      console.log('🏓 Самопинг успешен:', response.data.timestamp);
    } catch (error) {
      console.log('⚠️ Ошибка самопинга:', error.message);
    }
  }, SELF_PING_INTERVAL);
  
  console.log(`🏓 Самопинг настроен: каждые ${SELF_PING_INTERVAL / 60000} минут`);
}

// Запуск самопинга через 1 минуту после старта
setTimeout(setupSelfPing, 60000);

// Автообновление цен отключено для экономии API лимитов
// Обновление цен происходит только по команде /price
console.log('📊 Автообновление цен отключено - экономим API лимиты');

console.log('🚀 CES Price Telegram Bot успешно запущен!');
console.log('📊 Команды: /start и /price');
console.log('🔗 Режим: Webhook (не засыпает на Render)');
console.log('⚙️ ATH: Напрямую из CoinMarketCap (CMC)');
console.log('🔄 Обновление: Только по команде /price (экономия API)');

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('⛔ Завершение работы бота...');
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('⛔ Получен SIGTERM, корректное завершение...');
  mongoose.connection.close();
  process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанная ошибка Promise:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});