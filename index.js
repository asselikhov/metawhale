const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const cron = require('node-cron');
const axios = require('axios');
const express = require('express');
const puppeteer = require('puppeteer');
require('dotenv').config();

// Инициализация бота с webhook (не polling)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Настройка webhook URL
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://metawhale.onrender.com';
const WEBHOOK_PATH = '/webhook/' + process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_FULL_URL = WEBHOOK_URL + WEBHOOK_PATH;

console.log(`🔗 Webhook URL: ${WEBHOOK_FULL_URL}`);

// Настройка webhook
bot.setWebHook(WEBHOOK_FULL_URL).then(() => {
  console.log('✅ Webhook установлен успешно');
}).catch((error) => {
  console.error('❌ Ошибка установки webhook:', error);
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

// Обработка команды /price
bot.onText(/\/price/, async (msg) => {
  const chatId = msg.chat.id;
  await sendPriceToUser(chatId);
});

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `🚀 Добро пожаловать в CES Price Bot!

🪙 Токен CES
Контракт: ${process.env.CES_CONTRACT_ADDRESS}
Сеть: Polygon

📋 Доступные команды:
/price - Получить текущую цену CES с красивым графиком
/start - Показать это сообщение

💰 Получите актуальную цену токена CES командой /price`;
  
  await bot.sendMessage(chatId, welcomeMessage);
});

// Глобальная переменная для отслеживания последнего запроса к API
let lastApiCall = 0;
const API_CALL_INTERVAL = parseInt(process.env.API_CALL_INTERVAL) || 10000; // 10 секунд между запросами

// Функция создания красивого графика цены
async function createPriceChart(priceHistory) {
  try {
    // Получаем последние 24 точки данных
    const last24Points = priceHistory.slice(-24);
    
    if (last24Points.length < 2) {
      return null;
    }
    
    const prices = last24Points.map(item => item.price);
    const timestamps = last24Points.map(item => {
      return new Date(item.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow'
      });
    });
    
    // Определяем тренд для цвета
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const isPositive = lastPrice >= firstPrice;
    const lineColor = isPositive ? '#00D8AA' : '#FF4757';
    const gradientColor = isPositive ? 'rgba(0, 216, 170, 0.3)' : 'rgba(255, 71, 87, 0.3)';
    
    // Создаем HTML с Chart.js
    const chartHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body {
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Arial', sans-serif;
            }
            .chart-container {
                position: relative;
                width: 800px;
                height: 500px;
                background: white;
                border-radius: 15px;
                padding: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            }
            .title {
                text-align: center;
                font-size: 24px;
                font-weight: bold;
                color: #2C3E50;
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="chart-container">
            <div class="title">💰 CES Token Price Chart (24h)</div>
            <canvas id="chart" width="800" height="400"></canvas>
        </div>
        <script>
            const ctx = document.getElementById('chart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(timestamps)},
                    datasets: [{
                        label: 'CES Price (USD)',
                        data: ${JSON.stringify(prices)},
                        borderColor: '${lineColor}',
                        backgroundColor: '${gradientColor}',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '${lineColor}',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Время (МСК)',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                },
                                color: '#34495E'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            },
                            ticks: {
                                color: '#7F8C8D',
                                maxTicksLimit: 8
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Цена (USD)',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                },
                                color: '#34495E'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            },
                            ticks: {
                                color: '#7F8C8D',
                                callback: function(value) {
                                    return '$' + value.toFixed(4);
                                }
                            }
                        }
                    }
                }
            });
        </script>
    </body>
    </html>
    `;
    
    // Используем Puppeteer для создания скриншота
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 840, height: 560 });
    await page.setContent(chartHTML);
    
    // Ожидаем загрузки графика
    await page.waitForTimeout(2000);
    
    // Делаем скриншот
    const imageBuffer = await page.screenshot({ 
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 840, height: 560 }
    });
    
    await browser.close();
    
    return imageBuffer;
    
  } catch (error) {
    console.error('Ошибка создания графика:', error);
    return null;
  }
}

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
    
    // Получаем историю цен для графика
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const priceHistory = await PriceHistory.find({
      timestamp: { $gte: oneDayAgo }
    }).sort({ timestamp: 1 }).limit(24);
    
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
    
    // Отправляем текстовое сообщение с ценой
    await bot.sendMessage(chatId, message);
    
    // Создаем и отправляем красивый график как изображение
    if (priceHistory.length >= 2) {
      console.log('📋 Создание красивого графика...');
      const chartImage = await createPriceChart(priceHistory);
      
      if (chartImage) {
        // Отправляем график как фотографию
        await bot.sendPhoto(chatId, chartImage, {
          caption: `📊 Красивый график CES (24ч)\n\n🔥 Мин: $${Math.min(...priceHistory.map(p => p.price)).toFixed(4)}\n🚀 Макс: $${Math.max(...priceHistory.map(p => p.price)).toFixed(4)}`
        });
        console.log('✅ Красивый график успешно отправлен!');
      } else {
        console.log('⚠️ Не удалось создать график');
      }
    } else {
      console.log('📋 Недостаточно данных для создания графика');
    }
    
  } catch (error) {
    console.error('Ошибка отправки цены пользователю:', error);
    bot.sendMessage(chatId, '❌ Не удается получить цену CES в данный момент. Попробуйте позже.');
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
app.post(WEBHOOK_PATH, (req, res) => {
  try {
    console.log('📨 Получено сообщение от Telegram');
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Ошибка обработки webhook:', error);
    res.sendStatus(500);
  }
});

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

console.log('🚀 CES Price Telegram Bot успешно запущен!');
console.log('📊 Команды: /start и /price с красивыми графиками');
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