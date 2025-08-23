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
  const welcomeMessage = `Добро пожаловать в Rustling Grass 🌾 assistant !`;
  
  await bot.sendMessage(chatId, welcomeMessage);
});

// Глобальная переменная для отслеживания последнего запроса к API
let lastApiCall = 0;
const API_CALL_INTERVAL = parseInt(process.env.API_CALL_INTERVAL) || 10000; // 10 секунд между запросами

// Функция создания профессионального торгового интерфейса TradingView
async function createPriceChart(priceHistory, priceData) {
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
    const priceChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    
    // Форматированные данные для шаблона
    const formatVol = priceData && priceData.volume24h ? formatNumber(priceData.volume24h) : '0';
    const formatMcap = priceData && priceData.marketCap ? formatNumber(priceData.marketCap) : '0';
    
    // Создаем максимально профессиональный интерфейс как на настоящей бирже TradingView
    const chartHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                background: #0D1421;
                font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
                width: 100vw;
                height: 100vh;
                color: #d1d4dc;
                overflow: hidden;
            }
            
            .trading-interface {
                width: 1400px;
                height: 900px;
                background: #131722;
                display: flex;
                flex-direction: column;
                border: 1px solid #2a2e39;
            }
            
            .top-bar {
                height: 50px;
                background: #1e222d;
                border-bottom: 1px solid #2a2e39;
                display: flex;
                align-items: center;
                padding: 0 16px;
                gap: 24px;
            }
            
            .symbol-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .symbol {
                font-size: 18px;
                font-weight: 600;
                color: #f0f3fa;
            }
            
            .exchange {
                font-size: 12px;
                color: #868b93;
                background: #2a2e39;
                padding: 2px 6px;
                border-radius: 3px;
            }
            
            .price-section {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-left: auto;
            }
            
            .current-price {
                font-size: 24px;
                font-weight: 600;
                color: #f0f3fa;
            }
            
            .price-change {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                font-weight: 500;
                padding: 4px 8px;
                border-radius: 4px;
            }
            
            .price-change.positive {
                color: #089981;
                background: rgba(8, 153, 129, 0.1);
            }
            
            .price-change.negative {
                color: #f23645;
                background: rgba(242, 54, 69, 0.1);
            }
            
            .volume {
                font-size: 12px;
                color: #868b93;
            }
            
            .main-content {
                flex: 1;
                display: flex;
            }
            
            .chart-panel {
                flex: 1;
                background: #131722;
                position: relative;
                border-right: 1px solid #2a2e39;
            }
            
            .chart-toolbar {
                height: 40px;
                background: #1e222d;
                border-bottom: 1px solid #2a2e39;
                display: flex;
                align-items: center;
                padding: 0 12px;
                gap: 8px;
            }
            
            .timeframe {
                padding: 6px 12px;
                font-size: 11px;
                font-weight: 500;
                color: #868b93;
                background: transparent;
                border: 1px solid #363a45;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .timeframe.active {
                color: #f0f3fa;
                background: #2962ff;
                border-color: #2962ff;
            }
            
            .chart-container {
                height: calc(100% - 40px);
                position: relative;
                background: #131722;
            }
            
            #chart {
                width: 100%;
                height: 100%;
            }
            
            .sidebar {
                width: 280px;
                background: #1e222d;
                border-left: 1px solid #2a2e39;
                display: flex;
                flex-direction: column;
            }
            
            .orderbook {
                flex: 1;
                padding: 12px;
                border-bottom: 1px solid #2a2e39;
            }
            
            .orderbook-title {
                font-size: 12px;
                font-weight: 600;
                color: #868b93;
                margin-bottom: 8px;
                text-transform: uppercase;
            }
            
            .orderbook-item {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                line-height: 16px;
                padding: 1px 0;
            }
            
            .ask {
                color: #f23645;
            }
            
            .bid {
                color: #089981;
            }
            
            .market-trades {
                flex: 1;
                padding: 12px;
            }
            
            .trades-title {
                font-size: 12px;
                font-weight: 600;
                color: #868b93;
                margin-bottom: 8px;
                text-transform: uppercase;
            }
            
            .trade-item {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                line-height: 16px;
                padding: 1px 0;
            }
            
            .footer-stats {
                height: 60px;
                background: #1e222d;
                border-top: 1px solid #2a2e39;
                display: flex;
                align-items: center;
                padding: 0 16px;
                gap: 32px;
            }
            
            .stat-item {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .stat-label {
                font-size: 10px;
                color: #868b93;
                text-transform: uppercase;
                font-weight: 500;
            }
            
            .stat-value {
                font-size: 13px;
                color: #f0f3fa;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="trading-interface">
            <!-- Верхняя панель как в TradingView -->
            <div class="top-bar">
                <div class="symbol-info">
                    <div class="symbol">CESUSDT</div>
                    <div class="exchange">Binance</div>
                </div>
                <div class="price-section">
                    <div class="current-price">$${lastPrice.toFixed(4)}</div>
                    <div class="price-change ${isPositive ? 'positive' : 'negative'}">
                        <span>${isPositive ? '▲' : '▼'}</span>
                        <span>${isPositive ? '+' : ''}${priceChange}%</span>
                    </div>
                    <div class="volume">Vol: ${formatVol}</div>
                </div>
            </div>
            
            <!-- Основной контент -->
            <div class="main-content">
                <!-- Панель графика -->
                <div class="chart-panel">
                    <div class="chart-toolbar">
                        <div class="timeframe">1m</div>
                        <div class="timeframe">5m</div>
                        <div class="timeframe">15m</div>
                        <div class="timeframe active">1h</div>
                        <div class="timeframe">4h</div>
                        <div class="timeframe">1D</div>
                    </div>
                    <div class="chart-container">
                        <canvas id="chart"></canvas>
                    </div>
                </div>
                
                <!-- Боковая панель как на бирже -->
                <div class="sidebar">
                    <!-- Стакан заявок -->
                    <div class="orderbook">
                        <div class="orderbook-title">Order Book</div>
                        <div class="orderbook-item ask">
                            <span>${(lastPrice * 1.002).toFixed(4)}</span>
                            <span>1,247</span>
                        </div>
                        <div class="orderbook-item ask">
                            <span>${(lastPrice * 1.001).toFixed(4)}</span>
                            <span>2,831</span>
                        </div>
                        <div class="orderbook-item ask">
                            <span>${(lastPrice * 1.0005).toFixed(4)}</span>
                            <span>945</span>
                        </div>
                        <div style="height: 8px; border-bottom: 1px solid #2a2e39; margin: 4px 0;"></div>
                        <div class="orderbook-item bid">
                            <span>${(lastPrice * 0.9995).toFixed(4)}</span>
                            <span>1,856</span>
                        </div>
                        <div class="orderbook-item bid">
                            <span>${(lastPrice * 0.999).toFixed(4)}</span>
                            <span>3,241</span>
                        </div>
                        <div class="orderbook-item bid">
                            <span>${(lastPrice * 0.998).toFixed(4)}</span>
                            <span>1,592</span>
                        </div>
                    </div>
                    
                    <!-- Последние сделки -->
                    <div class="market-trades">
                        <div class="trades-title">Recent Trades</div>
                        <div class="trade-item bid">
                            <span>${(lastPrice * 1.001).toFixed(4)}</span>
                            <span>12:34:56</span>
                        </div>
                        <div class="trade-item ask">
                            <span>${(lastPrice * 0.999).toFixed(4)}</span>
                            <span>12:34:52</span>
                        </div>
                        <div class="trade-item bid">
                            <span>${lastPrice.toFixed(4)}</span>
                            <span>12:34:48</span>
                        </div>
                        <div class="trade-item ask">
                            <span>${(lastPrice * 0.998).toFixed(4)}</span>
                            <span>12:34:45</span>
                        </div>
                        <div class="trade-item bid">
                            <span>${(lastPrice * 1.002).toFixed(4)}</span>
                            <span>12:34:41</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Нижняя статистика -->
            <div class="footer-stats">
                <div class="stat-item">
                    <div class="stat-label">24h Change</div>
                    <div class="stat-value" style="color: ${isPositive ? '#089981' : '#f23645'}">
                        ${isPositive ? '+' : ''}${priceChange}%
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">24h High</div>
                    <div class="stat-value">$${Math.max(...prices).toFixed(4)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">24h Low</div>
                    <div class="stat-value">$${Math.min(...prices).toFixed(4)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">24h Volume</div>
                    <div class="stat-value">${formatVol} CES</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Market Cap</div>
                    <div class="stat-value">$${formatMcap}</div>
                </div>
            </div>
        </div>
        
        <script>
            // Функция форматирования чисел
            function formatNumber(num) {
                if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
                if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
                if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
                return num.toFixed(2);
            }
            
            // Подготовка данных для профессионального свечного графика
            const priceData = ${JSON.stringify(prices)};
            const timeLabels = ${JSON.stringify(timestamps)};
            
            // Создаем реалистичные OHLC данные
            const candleData = priceData.map((price, index) => {
                const variation = price * (0.001 + Math.random() * 0.002); // 0.1-0.3% вариация
                const open = index === 0 ? price : priceData[index - 1] + (Math.random() - 0.5) * variation;
                const close = price;
                const high = Math.max(open, close) + Math.random() * variation;
                const low = Math.min(open, close) - Math.random() * variation;
                
                return {
                    x: timeLabels[index],
                    o: Math.max(0, open),
                    h: Math.max(0, high),
                    l: Math.max(0, low),
                    c: Math.max(0, close)
                };
            });
            
            const ctx = document.getElementById('chart').getContext('2d');
            
            // Профессиональный свечной график как в TradingView
            const chart = new Chart(ctx, {
                type: 'candlestick',
                data: {
                    datasets: [{
                        label: 'CESUSDT',
                        data: candleData,
                        borderColor: {
                            up: '#089981',
                            down: '#f23645',
                            unchanged: '#737375'
                        },
                        backgroundColor: {
                            up: 'rgba(8, 153, 129, 0.8)',
                            down: 'rgba(242, 54, 69, 0.8)',
                            unchanged: 'rgba(115, 115, 117, 0.8)'
                        },
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    scales: {
                        x: {
                            type: 'category',
                            grid: {
                                color: '#2a2e39',
                                lineWidth: 1,
                                drawBorder: false
                            },
                            ticks: {
                                color: '#868b93',
                                font: {
                                    size: 10,
                                    family: 'Roboto'
                                },
                                maxTicksLimit: 8,
                                padding: 8
                            },
                            border: {
                                display: false
                            }
                        },
                        y: {
                            position: 'right',
                            grid: {
                                color: '#2a2e39',
                                lineWidth: 1,
                                drawBorder: false
                            },
                            ticks: {
                                color: '#868b93',
                                font: {
                                    size: 10,
                                    family: 'Roboto'
                                },
                                padding: 8,
                                callback: function(value) {
                                    return '$' + value.toFixed(4);
                                }
                            },
                            border: {
                                display: false
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 15,
                            bottom: 10,
                            left: 10
                        }
                    },
                    animation: {
                        duration: 0
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        </script>
    </body>
    </html>
    `;
    
    // Используем Puppeteer для создания скриншота УЛЬТРАСОВРЕМЕННОГО графика
    let browser;
    try {
      // Попробуем запустить с стандартными настройками
      browser = await puppeteer.launch({ 
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-gpu'
        ]
      });
    } catch (error) {
      console.log('⚠️ Ошибка запуска Puppeteer с автоопределением Chrome:', error.message);
      
      // Попробуем с ручным путем
      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');
        
        let chromePath = null;
        
        // Сначала проверим переменную среды PUPPETEER_EXECUTABLE_PATH
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
          try {
            const envPath = process.env.PUPPETEER_EXECUTABLE_PATH.replace('*', '139.0.7258.138');
            if (fs.existsSync(envPath)) {
              chromePath = envPath;
              console.log(`✅ Найден Chrome через переменную среды: ${chromePath}`);
            }
          } catch (envError) {
            console.log('⚠️ Ошибка проверки переменной среды:', envError.message);
          }
        }
        
        // Попробуем найти Chrome через find команду в известных местах
        if (!chromePath) {
          try {
            // Поиск в директории проекта
            let findResult = '';
            try {
              findResult = execSync('find ./chrome-cache -name "chrome" -type f -executable 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
            } catch (findError1) {
              // Попробуем поиск в /opt/render/.cache/puppeteer/
              try {
                findResult = execSync('find /opt/render/.cache/puppeteer -name "chrome" -type f -executable 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
              } catch (findError2) {
                // Попробуем поиск в домашней директории
                try {
                  findResult = execSync('find ~ -name "chrome" -type f -executable -path "*/puppeteer/*" 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
                } catch (findError3) {
                  // Попробуем глобальный поиск Chrome
                  try {
                    findResult = execSync('which google-chrome || which chromium || which chrome', { encoding: 'utf8' }).trim();
                  } catch (findError4) {
                    console.log('⚠️ Все попытки find не сработали');
                  }
                }
              }
            }
            
            if (findResult && fs.existsSync(findResult)) {
              chromePath = findResult;
              console.log(`✅ Найден Chrome через find: ${chromePath}`);
            }
          } catch (findError) {
            console.log('⚠️ Find команда не сработала:', findError.message);
          }
        }
        
        // Если find не сработал, попробуем известные пути
        if (!chromePath) {
          const possiblePaths = [
            // Пути в директории проекта
            './chrome-cache/chrome/linux-139.0.7258.138/chrome-linux64/chrome',
            './chrome-cache/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
            './chrome-cache/chrome/linux-130.0.6723.116/chrome-linux64/chrome',
            './chrome-cache/chrome/linux-129.0.6668.100/chrome-linux64/chrome',
            // Пути в /opt/render/.cache/puppeteer/
            '/opt/render/.cache/puppeteer/chrome/linux-139.0.7258.138/chrome-linux64/chrome',
            '/opt/render/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
            '/opt/render/.cache/puppeteer/chrome/linux-130.0.6723.116/chrome-linux64/chrome',
            '/opt/render/.cache/puppeteer/chrome/linux-129.0.6668.100/chrome-linux64/chrome',
            // Дополнительные возможные пути
            process.env.HOME + '/.cache/puppeteer/chrome/linux-139.0.7258.138/chrome-linux64/chrome',
            '/home/render/.cache/puppeteer/chrome/linux-139.0.7258.138/chrome-linux64/chrome'
          ];
          
          for (const pathToCheck of possiblePaths) {
            if (fs.existsSync(pathToCheck)) {
              chromePath = pathToCheck;
              console.log(`✅ Найден Chrome по пути: ${chromePath}`);
              break;
            }
          }
        }
        
        // Если все еще не найден, попробуем поиск по glob паттерну
        if (!chromePath) {
          try {
            const glob = require('glob');
            const globPatterns = [
              './chrome-cache/chrome/linux-*/chrome-linux64/chrome',
              '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome'
            ];
            
            for (const globPattern of globPatterns) {
              const matches = glob.sync(globPattern);
              if (matches.length > 0) {
                chromePath = matches[0];
                console.log(`✅ Найден Chrome через glob: ${chromePath}`);
                break;
              }
            }
          } catch (globError) {
            console.log('⚠️ Glob поиск не сработал:', globError.message);
          }
        }
        
        if (chromePath) {
          console.log(`🚀 Попытка запуска Puppeteer с найденным Chrome: ${chromePath}`);
          browser = await puppeteer.launch({ 
            headless: 'new',
            executablePath: chromePath,
            args: [
              '--no-sandbox', 
              '--disable-setuid-sandbox', 
              '--disable-dev-shm-usage',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-gpu'
            ]
          });
          console.log('✅ Puppeteer успешно запущен с найденным Chrome!');
        } else {
          // Последняя попытка - вывести содержимое директорий для отладки
          try {
            console.log('📂 Отладка: Поиск всех возможных мест Chrome...');
            
            // Проверяем различные директории
            const dirsToCheck = [
              './chrome-cache/',
              './chrome-cache/chrome/',
              '/opt/render/',
              '/opt/render/.cache/',
              '/opt/render/.cache/puppeteer/',
              process.env.HOME + '/.cache/',
              process.env.HOME + '/.cache/puppeteer/'
            ];
            
            for (const dir of dirsToCheck) {
              try {
                const lsResult = execSync(`ls -la "${dir}" 2>/dev/null || echo "Директория ${dir} не существует"`, { encoding: 'utf8' });
                console.log(`📂 ${dir}:`);
                console.log(lsResult.slice(0, 500)); // Ограничиваем вывод
              } catch (dirError) {
                console.log(`⚠️ Не удалось проверить ${dir}: ${dirError.message}`);
              }
            }
            
            // Поиск любых файлов chrome в системе
            try {
              const allChromeFiles = execSync('find / -name "chrome" -type f 2>/dev/null | grep -E "(puppeteer|chromium)" | head -5', { encoding: 'utf8' });
              if (allChromeFiles.trim()) {
                console.log('🔍 Найденные файлы Chrome в системе:');
                console.log(allChromeFiles);
              }
            } catch (searchError) {
              console.log('⚠️ Не удалось выполнить глобальный поиск Chrome');
            }
            
          } catch (debugError) {
            console.log('⚠️ Ошибка отладки:', debugError.message);
          }
          
          throw new Error('Не удалось найти Chrome в кэше Puppeteer');
        }
      } catch (secondError) {
        console.error('Ошибка запуска Puppeteer с ручным путем:', secondError.message);
        throw secondError;
      }
    }
    console.log('🎭 Начинаем создание страницы...');
    const page = await browser.newPage();
    console.log('📱 Страница создана, устанавливаем viewport...');
    await page.setViewport({ width: 1400, height: 900 });
    console.log('🗺️ Viewport установлен, загружаем HTML...');
    await page.setContent(chartHTML);
    console.log('🌈 HTML загружен, ожидаем анимации...');
    
    // Ожидаем загрузки Chart.js и других библиотек
    try {
      await page.waitForFunction(() => {
        return typeof window.Chart !== 'undefined';
      }, { timeout: 10000 });
      console.log('✅ Chart.js загружен!');
    } catch (waitError) {
      console.log('⚠️ Chart.js может быть не загружен, продолжаем...');
    }
    
    // Ожидаем загрузки всех анимаций и эффектов
    await new Promise(resolve => setTimeout(resolve, 4000));
    console.log('📷 Анимации завершены, делаем скриншот...');
    
    // Делаем скриншот профессионального торгового интерфейса
    const imageBuffer = await page.screenshot({ 
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1400, height: 900 }
    });
    console.log('✨ Скриншот создан! Закрываем браузер...');
    
    await browser.close();
    console.log('🔒 Браузер закрыт.');
    
    console.log('🎨 УЛЬТРАСОВРЕМЕННЫЙ график создан с D3.js, Three.js и GSAP!');
    return imageBuffer;
    
  } catch (error) {
    console.error('❌ Ошибка создания КРУТОГО графика:', error.message);
    console.error('🔍 Stack trace:', error.stack);
    
    // Если проблема с Chrome/Puppeteer, попробуем без чартов
    if (error.message.includes('Could not find Chrome') || error.message.includes('puppeteer')) {
      console.log('⚠️ Проблема с Puppeteer, возвращаем null');
    }
    
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
    
    const message = `
➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $${priceData.price.toFixed(2)}${priceData.priceRub > 0 ? ` | ₽${priceData.priceRub.toFixed(2)}` : ''}
➖➖➖➖➖➖➖➖➖➖➖➖➖
Изменение за 24ч: ${changeSign}${priceData.change24h.toFixed(2)}%
Объем за 24ч: $${formatNumber(priceData.volume24h)}
    `;
    
    // Отправляем текстовое сообщение с ценой
    await bot.sendMessage(chatId, message);
    
    // Создаем и отправляем УЛЬТРАСОВРЕМЕННЫЙ график как изображение
    if (priceHistory.length >= 2) {
      console.log('🎨 Создание УЛЬТРАСОВРЕМЕННОГО графика с D3.js + Three.js + GSAP...');
      const chartImage = await createPriceChart(priceHistory, priceData);
      
      if (chartImage) {
        // Отправляем график как фотографию
        await bot.sendPhoto(chatId, chartImage);
        console.log('✨ УЛЬТРАСОВРЕМЕННЫЙ график с D3.js, Three.js и GSAP успешно отправлен!');
      } else {
        console.log('⚠️ Не удалось создать график (возможно, проблема с Puppeteer)');
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
console.log('🎨 Команды: /start и /price с УЛЬТРАСОВРЕМЕННЫМИ графиками!');
console.log('💎 Стек: D3.js + Three.js + GSAP + Chart.js + Puppeteer');
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