const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const cron = require('node-cron');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

// Инициализация бота с защитой от множественных запусков
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Обработка ошибок polling
bot.on('polling_error', (error) => {
  console.error('⚠️ Ошибка polling:', error.message);
  
  // Особая обработка ошибки 409 (Conflict)
  if (error.message.includes('409') || error.message.includes('Conflict')) {
    console.log('🔄 Обнаружен конфликт - перезапуск через 5 секунд...');
    
    setTimeout(() => {
      try {
        bot.stopPolling({ cancel: true }).then(() => {
          setTimeout(() => {
            bot.startPolling();
            console.log('✅ Поллинг перезапущен');
          }, 2000);
        });
      } catch (restartError) {
        console.error('⚠️ Ошибка перезапуска:', restartError.message);
      }
    }, 5000);
  }
});

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
  changeRub24h: Number
});

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Подключен к MongoDB'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  try {
    await User.findOneAndUpdate(
      { chatId: chatId.toString() },
      {
        chatId: chatId.toString(),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: true,
        subscribedAt: new Date()
      },
      { upsert: true, new: true }
    );

    const welcomeMessage = `
🚀 Добро пожаловать в CES Price Bot!

Я буду отправлять вам обновления цены токена CES дважды в день:
• 8:00 утра по московскому времени
• 20:00 вечера по московскому времени

🪙 Токен CES
Контракт: ${process.env.CES_CONTRACT_ADDRESS}
Сеть: Polygon

📋 Доступные команды:
/price - Получить текущую цену CES
/subscribe - Подписаться на ежедневные обновления
/unsubscribe - Отписаться от обновлений
/stats - Посмотреть статистику цены
/help - Показать справку
    `;

    await bot.sendMessage(chatId, welcomeMessage);
    
    // Отправляем текущую цену в качестве приветствия
    await sendPriceToUser(chatId);
  } catch (error) {
    console.error('Ошибка в команде /start:', error);
    bot.sendMessage(chatId, '❌ Извините, произошла ошибка. Попробуйте еще раз.');
  }
});

// Обработка команды /price
bot.onText(/\/price/, async (msg) => {
  const chatId = msg.chat.id;
  await sendPriceToUser(chatId);
});

// Обработка команды /subscribe
bot.onText(/\/subscribe/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    await User.findOneAndUpdate(
      { chatId: chatId.toString() },
      { isActive: true },
      { upsert: true }
    );
    
    bot.sendMessage(chatId, '✅ Вы подписались на ежедневные обновления цены CES!\n\n📅 Время отправки: 8:00 и 20:00 по Москве');
  } catch (error) {
    console.error('Ошибка в команде /subscribe:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
  }
});

// Обработка команды /unsubscribe
bot.onText(/\/unsubscribe/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    await User.findOneAndUpdate(
      { chatId: chatId.toString() },
      { isActive: false }
    );
    
    bot.sendMessage(chatId, '❌ Вы отписались от ежедневных обновлений.\n\nИспользуйте /subscribe для повторной подписки.');
  } catch (error) {
    console.error('Ошибка в команде /unsubscribe:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
  }
});

// Обработка команды /stats
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  await sendPriceStats(chatId);
});

// Обработка команды /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
📆 Справка по CES Price Bot

📋 Команды:
/price - Получить текущую цену CES
/subscribe - Подписаться на обновления (8:00 и 20:00 МСК)
/unsubscribe - Отписаться от обновлений
/stats - Посмотреть статистику за 24 часа
/help - Показать эту справку

🪙 О токене CES:
Контракт: ${process.env.CES_CONTRACT_ADDRESS}
Сеть: Polygon
Источник данных: CoinGecko API

⏰ Расписание автоматических обновлений:
• 8:00 утра по московскому времени
• 20:00 вечера по московскому времени

💡 Бот показывает цену в долларах США, изменение за 24 часа и объем торгов.
  `;
  
  bot.sendMessage(chatId, helpMessage);
});

// Глобальная переменная для отслеживания последнего запроса к API
let lastApiCall = 0;
const API_CALL_INTERVAL = parseInt(process.env.API_CALL_INTERVAL) || 10000; // 10 секунд между запросами

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
    
    // Попытка получить данные по адресу контракта (сеть Polygon)
    const contractResponse = await axios.get(
      `${process.env.COINGECKO_API_URL}/simple/token_price/polygon-pos?contract_addresses=${process.env.CES_CONTRACT_ADDRESS}&vs_currencies=usd,rub&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'CES-Price-Bot/1.0'
        }
      }
    );

    const contractAddress = process.env.CES_CONTRACT_ADDRESS.toLowerCase();
    
    if (contractResponse.data[contractAddress]) {
      const data = contractResponse.data[contractAddress];
      return {
        price: data.usd,
        priceRub: data.rub || 0,
        change24h: data.usd_24h_change || 0,
        changeRub24h: data.rub_24h_change || 0,
        marketCap: data.usd_market_cap || 0,
        volume24h: data.usd_24h_vol || 0
      };
    }

    // Резервный вариант: поиск CES по имени
    const searchResponse = await axios.get(
      `${process.env.COINGECKO_API_URL}/simple/price?ids=ces&vs_currencies=usd,rub&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );

    if (searchResponse.data.ces) {
      const data = searchResponse.data.ces;
      return {
        price: data.usd,
        priceRub: data.rub || 0,
        change24h: data.usd_24h_change || 0,
        changeRub24h: data.rub_24h_change || 0,
        marketCap: data.usd_market_cap || 0,
        volume24h: data.usd_24h_vol || 0
      };
    }

    throw new Error('Токен CES не найден');
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
          cached: true
        };
      }
    }
    
    throw error;
  }
}

// Функция отправки цены конкретному пользователю
async function sendPriceToUser(chatId) {
  try {
    const priceData = await getCESPrice();
    
    // Сохранение цены в базу данных (только для новых данных)
    if (!priceData.cached) {
      await new PriceHistory(priceData).save();
    }
    
    const changeEmoji = priceData.change24h >= 0 ? '📈' : '📉';
    const changeSign = priceData.change24h >= 0 ? '+' : '';
    const cacheIndicator = priceData.cached ? ' 🟠 (кеш)' : '';
    
    const message = `
➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $${priceData.price.toFixed(2)}${priceData.priceRub > 0 ? ` | ₽${priceData.priceRub.toFixed(2)}` : ''}${cacheIndicator}
➖➖➖➖➖➖➖➖➖➖➖➖➖
Изменение за 24ч: ${changeSign}${priceData.change24h.toFixed(2)}%
Объем за 24ч: $${formatNumber(priceData.volume24h)}
    `;
    
    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Ошибка отправки цены пользователю:', error);
    bot.sendMessage(chatId, '❌ Не удается получить цену CES в данный момент. Попробуйте позже.');
  }
}

// Функция отправки статистики цены
async function sendPriceStats(chatId) {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const prices = await PriceHistory.find({
      timestamp: { $gte: oneDayAgo }
    }).sort({ timestamp: 1 });

    if (prices.length === 0) {
      bot.sendMessage(chatId, '📊 Данные о ценах пока недоступны. Попробуйте позже.');
      return;
    }

    const currentPrice = prices[prices.length - 1].price;
    const oldestPrice = prices[0].price;
    const highestPrice = Math.max(...prices.map(p => p.price));
    const lowestPrice = Math.min(...prices.map(p => p.price));
    
    const priceChange = ((currentPrice - oldestPrice) / oldestPrice) * 100;
    const changeEmoji = priceChange >= 0 ? '📈' : '📉';
    const changeSign = priceChange >= 0 ? '+' : '';

    const message = `
📊 Статистика CES за 24 часа

💰 Текущая цена: $${currentPrice.toFixed(2)}
📈 Максимум: $${highestPrice.toFixed(2)}
📉 Минимум: $${lowestPrice.toFixed(2)}
${changeEmoji} Общее изменение: ${changeSign}${priceChange.toFixed(2)}%

📋 Точек данных: ${prices.length}
⏰ Обновлено: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)
    `;

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Ошибка отправки статистики:', error);
    bot.sendMessage(chatId, '❌ Не удается получить статистику. Попробуйте позже.');
  }
}

// Функция массовой рассылки цены всем активным пользователям
async function broadcastPrice() {
  try {
    const users = await User.find({ isActive: true });
    console.log(`📢 Отправка цены ${users.length} пользователям`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        await sendPriceToUser(user.chatId);
        await User.findByIdAndUpdate(user._id, { lastNotified: new Date() });
        successCount++;
        
        // Задержка для избежания лимитов Telegram
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Ошибка отправки пользователю ${user.chatId}:`, error);
        errorCount++;
        
        // Если пользователь заблокировал бота, деактивируем его
        if (error.code === 403) {
          await User.findByIdAndUpdate(user._id, { isActive: false });
          console.log(`Пользователь ${user.chatId} заблокировал бота, деактивирован`);
        }
      }
    }
    
    console.log(`✅ Рассылка завершена: успешно ${successCount}, ошибок ${errorCount}`);
  } catch (error) {
    console.error('Ошибка массовой рассылки:', error);
  }
}

// Планировщик рассылки цен (Московское время)
// 8:00 утра по Москве
cron.schedule('0 8 * * *', () => {
  console.log('🌅 Запуск утренней рассылки цен (8:00 МСК)');
  broadcastPrice();
}, {
  timezone: 'Europe/Moscow'
});

// 20:00 вечера по Москве  
cron.schedule('0 20 * * *', () => {
  console.log('🌆 Запуск вечерней рассылки цен (20:00 МСК)');
  broadcastPrice();
}, {
  timezone: 'Europe/Moscow'
});

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

// Express сервер для проверки здоровья (необходим для Render)
const app = express();

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

console.log('🚀 CES Price Telegram Bot успешно запущен!');
console.log('📅 Запланированные рассылки: 8:00 и 20:00 по московскому времени');

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('⛔ Завершение работы бота...');
  bot.stopPolling();
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('⛔ Получен SIGTERM, корректное завершение...');
  bot.stopPolling();
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