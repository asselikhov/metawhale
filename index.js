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



// Функция получения цены CES из CoinGecko с обработкой лимитов
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
    
    // Попытка получить данные по адресу контракта (сеть Polygon) с дополнительными параметрами
    const contractResponse = await axios.get(
      `${process.env.COINGECKO_API_URL}/simple/token_price/polygon-pos?contract_addresses=${process.env.CES_CONTRACT_ADDRESS}&vs_currencies=usd,rub&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_ath=true&include_ath_date=true`,
      {
        timeout: 8000, // Уменьшено с 10 до 8 секунд для ускорения
        headers: {
          'User-Agent': 'CES-Price-Bot/1.0'
        }
      }
    );

    const contractAddress = process.env.CES_CONTRACT_ADDRESS.toLowerCase();
    
    if (contractResponse.data[contractAddress]) {
      const data = contractResponse.data[contractAddress];
      
      // Получаем ATH из базы данных и сравниваем с API данными
      let athValue = data.usd_ath;
      
      // Если API не предоставляет ATH, ищем максимальную цену в истории
      if (!athValue) {
        const maxPriceFromDB = await PriceHistory.findOne().sort({ price: -1 }).limit(1);
        athValue = maxPriceFromDB ? maxPriceFromDB.price : data.usd;
        console.log(`📈 ATH взят из базы данных: $${athValue.toFixed(2)}`);
      }
      
      // Проверяем, не является ли текущая цена новым ATH
      const finalATH = Math.max(athValue, data.usd);
      if (data.usd > athValue) {
        console.log(`🏆 Обнаружен новый ATH! Старый: $${athValue.toFixed(2)}, Новый: $${data.usd.toFixed(2)}`);
      }
      
      return {
        price: data.usd,
        priceRub: data.rub || 0,
        change24h: data.usd_24h_change || 0,
        changeRub24h: data.rub_24h_change || 0,
        marketCap: data.usd_market_cap || 0,
        volume24h: data.usd_24h_vol || 0,
        ath: finalATH
      };
    }

    // Резервный вариант: поиск по различным возможным ID токена
    const possibleIds = ['ces', 'cerestoken', 'ceres-protocol'];
    
    for (const tokenId of possibleIds) {
      try {
        const searchResponse = await axios.get(
          `${process.env.COINGECKO_API_URL}/simple/price?ids=${tokenId}&vs_currencies=usd,rub&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_ath=true&include_ath_date=true`,
          { timeout: 5000 }
        );

        if (searchResponse.data[tokenId]) {
          const data = searchResponse.data[tokenId];
          console.log(`✅ Найден токен по ID: ${tokenId}`);
          
          let athValue = data.usd_ath;
          if (!athValue) {
            const maxPriceFromDB = await PriceHistory.findOne().sort({ price: -1 }).limit(1);
            athValue = maxPriceFromDB ? maxPriceFromDB.price : data.usd;
          }
          
          // Проверяем новый ATH
          const finalATH = Math.max(athValue, data.usd);
          if (data.usd > athValue) {
            console.log(`🏆 Новый ATH через ${tokenId}! $${data.usd.toFixed(2)}`);
          }
          
          return {
            price: data.usd,
            priceRub: data.rub || 0,
            change24h: data.usd_24h_change || 0,
            changeRub24h: data.rub_24h_change || 0,
            marketCap: data.usd_market_cap || 0,
            volume24h: data.usd_24h_vol || 0,
            ath: finalATH
          };
        }
      } catch (err) {
        console.log(`⚠️ Токен ${tokenId} не найден`);
        continue;
      }
    }

    throw new Error('Токен CES не найден во всех источниках');
  } catch (error) {
    console.error('Ошибка получения цены CES:', error.message);
    
    // Обработка ошибки 429 (Too Many Requests)
    if (error.response && error.response.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
      console.log(`⚠️ Превышен лимит запросов. Повтор через ${retryAfter} секунд`);
      
      // Возвращаем последнюю сохраненную цену из базы данных
      const lastPrice = await PriceHistory.findOne().sort({ timestamp: -1 });
      if (lastPrice) {
        console.log('⚡ Используем последнюю сохраненную цену');
        return {
          price: lastPrice.price,
          priceRub: lastPrice.priceRub || 0,
          change24h: lastPrice.change24h || 0,
          changeRub24h: lastPrice.changeRub24h || 0,
          marketCap: lastPrice.marketCap || 0,
          volume24h: lastPrice.volume24h || 0,
          ath: lastPrice.ath || lastPrice.price,
          cached: true
        };
      }
    }
    
    throw error;
  }
}

// Функция отправки цены конкретному пользователю
async function sendPriceToUser(ctx) {
  try {
    const priceData = await getCESPrice();
    
    // Сохраняем данные в базу (только для новых данных)
    if (!priceData.cached) {
      await new PriceHistory(priceData).save();
    }
    
    // Определяем эмодзи для изменения цены
    const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻'; // 🔺 для роста, 🔻 для падения
    const changeSign = priceData.change24h >= 0 ? '+' : '';
    
    // Проверяем, не является ли текущая цена ATH
    const isNewATH = priceData.price >= priceData.ath;
    const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
    
    // Новый формат сообщения
    const message = `💰 Цена токена CES: $ ${priceData.price.toFixed(2)}${priceData.priceRub > 0 ? ` | ₽ ${priceData.priceRub.toFixed(2)}` : ''}
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

// Функция автоматического обновления цен в реальном времени
function setupPriceUpdater() {
  const PRICE_UPDATE_INTERVAL = 30 * 1000; // 30 секунд для обновления цен
  
  setInterval(async () => {
    try {
      const priceData = await getCESPrice();
      if (!priceData.cached) {
        await new PriceHistory(priceData).save();
        
        // Логируем обновление с информацией о ATH
        const isNewATH = priceData.price >= priceData.ath;
        console.log(`📊 Цена обновлена: $${priceData.price.toFixed(2)} (${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%) | ATH: $${priceData.ath.toFixed(2)}${isNewATH ? ' 🏆' : ''}`);
      }
    } catch (error) {
      console.log('⚠️ Ошибка автообновления цены:', error.message);
    }
  }, PRICE_UPDATE_INTERVAL);
  
  console.log(`📊 Автообновление цен настроено: каждые ${PRICE_UPDATE_INTERVAL / 1000} секунд`);
}

// Запуск автообновления цен через 2 минуты после старта
setTimeout(setupPriceUpdater, 120000);

console.log('🚀 CES Price Telegram Bot успешно запущен!');
console.log('📊 Команды: /start и /price');
console.log('🔗 Режим: Webhook (не засыпает на Render)');

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