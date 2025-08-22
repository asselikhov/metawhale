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

// Функция создания УЛЬТРАСОВРЕМЕННОГО графика цены с D3.js, Three.js и крутыми анимациями
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
    const priceChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    
    // Создаем УЛЬТРАСОВРЕМЕННЫЙ HTML с D3.js, Three.js и GSAP анимациями
    const chartHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <script src="https://d3js.org/d3.v7.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, 
                    #667eea 0%, 
                    #764ba2 25%, 
                    #f093fb 50%, 
                    #f5576c 75%, 
                    #4facfe 100%);
                background-size: 400% 400%;
                animation: gradientShift 8s ease infinite;
                overflow: hidden;
                width: 100vw;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            .chart-container {
                width: 900px;
                height: 600px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 24px;
                padding: 30px;
                box-shadow: 
                    0 25px 50px rgba(0, 0, 0, 0.25),
                    0 0 0 1px rgba(255, 255, 255, 0.2);
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            
            .chart-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(45deg, 
                    rgba(255, 255, 255, 0.1) 0%, 
                    transparent 50%, 
                    rgba(255, 255, 255, 0.1) 100%);
                z-index: 1;
                pointer-events: none;
            }
            
            .title {
                text-align: center;
                font-size: 32px;
                font-weight: 900;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 10px;
                z-index: 2;
                position: relative;
                text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .subtitle {
                text-align: center;
                font-size: 18px;
                color: #6B7280;
                margin-bottom: 30px;
                z-index: 2;
                position: relative;
                font-weight: 500;
            }
            
            .price-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                z-index: 2;
                position: relative;
            }
            
            .price-stat {
                text-align: center;
                padding: 15px;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 16px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                min-width: 120px;
                transition: all 0.3s ease;
            }
            
            .price-stat:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }
            
            .stat-label {
                font-size: 12px;
                color: #9CA3AF;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .stat-value {
                font-size: 20px;
                font-weight: 700;
                margin-top: 5px;
            }
            
            .positive { color: #10B981; }
            .negative { color: #EF4444; }
            
            #chart {
                border-radius: 16px;
                z-index: 2;
                position: relative;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .particles {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 0;
            }
        </style>
    </head>
    <body>
        <div class="chart-container">
            <canvas class="particles"></canvas>
            <div class="title">💎 CES TOKEN ANALYTICS</div>
            <div class="subtitle">Real-time Price Movement • 24H Data</div>
            
            <div class="price-info">
                <div class="price-stat">
                    <div class="stat-label">CURRENT</div>
                    <div class="stat-value">$${lastPrice.toFixed(4)}</div>
                </div>
                <div class="price-stat">
                    <div class="stat-label">CHANGE</div>
                    <div class="stat-value ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${priceChange}%
                    </div>
                </div>
                <div class="price-stat">
                    <div class="stat-label">MIN</div>
                    <div class="stat-value">$${Math.min(...prices).toFixed(4)}</div>
                </div>
                <div class="price-stat">
                    <div class="stat-label">MAX</div>
                    <div class="stat-value">$${Math.max(...prices).toFixed(4)}</div>
                </div>
            </div>
            
            <canvas id="chart" width="840" height="400"></canvas>
        </div>
        
        <script>
            // УЛЬТРАСОВРЕМЕННАЯ анимация частиц с Three.js
            const particlesCanvas = document.querySelector('.particles');
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ canvas: particlesCanvas, alpha: true });
            renderer.setSize(900, 600);
            
            const particles = new THREE.BufferGeometry();
            const particleCount = 100;
            const positions = new Float32Array(particleCount * 3);
            
            for (let i = 0; i < particleCount * 3; i++) {
                positions[i] = (Math.random() - 0.5) * 10;
            }
            
            particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const material = new THREE.PointsMaterial({ 
                color: 0x667eea, 
                size: 0.02,
                transparent: true,
                opacity: 0.6
            });
            
            const mesh = new THREE.Points(particles, material);
            scene.add(mesh);
            camera.position.z = 5;
            
            function animateParticles() {
                requestAnimationFrame(animateParticles);
                mesh.rotation.x += 0.001;
                mesh.rotation.y += 0.002;
                renderer.render(scene, camera);
            }
            animateParticles();
            
            // КРУТЕЙШИЙ график с D3.js анимациями
            const ctx = document.getElementById('chart').getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            
            if (${isPositive}) {
                gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
                gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.4)');
                gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
            } else {
                gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
                gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.4)');
                gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
            }
            
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(timestamps)},
                    datasets: [{
                        label: 'CES Price',
                        data: ${JSON.stringify(prices)},
                        borderColor: ${isPositive ? "'#10B981'" : "'#EF4444'"},
                        backgroundColor: gradient,
                        borderWidth: 4,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: ${isPositive ? "'#10B981'" : "'#EF4444'"},
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointHoverBorderWidth: 4,
                        borderCapStyle: 'round',
                        borderJoinStyle: 'round'
                    }]
                },
                options: {
                    responsive: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Время (МСК)',
                                font: { size: 14, weight: 'bold' },
                                color: '#374151'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.05)',
                                lineWidth: 1
                            },
                            ticks: {
                                color: '#6B7280',
                                font: { size: 12, weight: '500' }
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Цена (USD)',
                                font: { size: 14, weight: 'bold' },
                                color: '#374151'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.05)',
                                lineWidth: 1
                            },
                            ticks: {
                                color: '#6B7280',
                                font: { size: 12, weight: '500' },
                                callback: function(value) {
                                    return '$' + value.toFixed(4);
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 2000,
                        easing: 'easeInOutQuart'
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
            
            // GSAP анимации для суперкрутых эффектов
            gsap.from('.chart-container', {
                scale: 0.8,
                opacity: 0,
                duration: 1.2,
                ease: 'back.out(1.7)'
            });
            
            gsap.from('.price-stat', {
                y: 50,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out',
                delay: 0.3
            });
            
            gsap.from('.title', {
                y: -30,
                opacity: 0,
                duration: 1,
                ease: 'elastic.out(1, 0.5)',
                delay: 0.2
            });
            
            // Пульсирующая анимация для статистики
            gsap.to('.price-stat', {
                scale: 1.05,
                duration: 2,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                stagger: 0.2
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
    await page.setViewport({ width: 900, height: 600 });
    console.log('🗺️ Viewport установлен, загружаем HTML...');
    await page.setContent(chartHTML);
    console.log('🌈 HTML загружен, ожидаем анимации...');
    
    // Ожидаем загрузки всех анимаций и эффектов
    await page.waitForTimeout(4000);
    console.log('📷 Анимации завершены, делаем скриншот...');
    
    // Делаем скриншот ШЕДЕВРА
    const imageBuffer = await page.screenshot({ 
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 900, height: 600 }
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
      const chartImage = await createPriceChart(priceHistory);
      
      if (chartImage) {
        // Отправляем график как фотографию
        await bot.sendPhoto(chatId, chartImage, {
          caption: `🎨 УЛЬТРАСОВРЕМЕННЫЙ график CES (24ч)\n\n💎 Создан с D3.js + Three.js + GSAP\n🔥 Мин: $${Math.min(...priceHistory.map(p => p.price)).toFixed(4)}\n🚀 Макс: $${Math.max(...priceHistory.map(p => p.price)).toFixed(4)}`
        });
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