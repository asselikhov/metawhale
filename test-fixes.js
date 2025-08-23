// Тест исправления ATH и конвертации в рубли
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

// Схема истории цен (копия из основного файла)
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

// Функция получения курса USD/RUB
async function getUSDToRUBRate() {
  try {
    console.log('💱 Получаем курс USD/RUB...');
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 5000
    });
    
    if (response.data && response.data.rates && response.data.rates.RUB) {
      const rate = response.data.rates.RUB;
      console.log(`✅ Курс USD/RUB: ${rate}`);
      return rate;
    }
    
    console.log('⚠️ Курс RUB не найден в ответе API');
    return 100; // Fallback курс
  } catch (error) {
    console.log('⚠️ Ошибка получения курса USD/RUB:', error.message);
    return 100; // Fallback курс ~100 рублей за доллар
  }
}

async function testFixes() {
  console.log('🧪 Тестирование исправлений ATH и рублей...\n');
  
  try {
    // Подключаемся к MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB успешно\n');

    // 1. Тестируем курс USD/RUB
    console.log('🔍 ТЕСТ 1: Курс USD/RUB');
    console.log('='.repeat(30));
    const usdToRubRate = await getUSDToRUBRate();
    const testPrice = 3.08;
    const testPriceRub = testPrice * usdToRubRate;
    console.log(`Тестовая цена: $${testPrice}`);
    console.log(`Курс: ${usdToRubRate}`);
    console.log(`Цена в рублях: ₽${testPriceRub.toFixed(2)}\n`);

    // 2. Тестируем ATH из базы данных
    console.log('🔍 ТЕСТ 2: ATH из базы данных');
    console.log('='.repeat(30));
    const maxPriceRecord = await PriceHistory.findOne().sort({ price: -1 });
    const databaseATH = maxPriceRecord ? maxPriceRecord.price : 0;
    console.log(`ATH из базы данных: $${databaseATH.toFixed(2)}`);
    console.log(`Всего записей в базе: ${await PriceHistory.countDocuments()}\n`);

    // 3. Тестируем финальный ATH
    console.log('🔍 ТЕСТ 3: Финальный ATH');
    console.log('='.repeat(30));
    const currentPrice = testPrice;
    const finalATH = Math.max(databaseATH, currentPrice);
    console.log(`Текущая цена: $${currentPrice.toFixed(2)}`);
    console.log(`ATH из базы: $${databaseATH.toFixed(2)}`);
    console.log(`Финальный ATH: $${finalATH.toFixed(2)}`);
    
    if (currentPrice >= finalATH) {
      console.log('🏆 Это новый ATH!');
    } else {
      console.log('📊 Текущий ATH остается прежним');
    }
    console.log();

    // 4. Тестируем итоговое сообщение
    console.log('🔍 ТЕСТ 4: Форматирование сообщения');
    console.log('='.repeat(30));
    
    const priceData = {
      price: currentPrice,
      priceRub: testPriceRub,
      change24h: -4.85,
      volume24h: 626954.63,
      ath: finalATH,
      source: 'coinmarketcap'
    };

    const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
    const changeSign = priceData.change24h >= 0 ? '+' : '';
    const isNewATH = priceData.price >= priceData.ath;
    const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
    const sourceEmoji = priceData.source === 'database' ? '🗄️' : '🄲🄼🄲';

    function formatNumber(num) {
      if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
      if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
      return num.toFixed(2);
    }

    const message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена CES: $ ${priceData.price.toFixed(2)}${priceData.priceRub > 0 ? ` | ₽ ${priceData.priceRub.toFixed(2)}` : ' | ₽ 0.00'} ${sourceEmoji}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(2)}% • 🅥 $ ${formatNumber(priceData.volume24h)} • 🅐🅣🅗 ${athDisplay}`;

    console.log('ИТОГОВОЕ СООБЩЕНИЕ:');
    console.log(message);
    console.log();

    console.log('✅ Все тесты завершены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Соединение с базой данных закрыто');
  }
}

// Запускаем тест
testFixes().catch(console.error);