// Быстрый тест команды /price с новыми исправлениями
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

// Схема истории цен
const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  change24h: Number,
  marketCap: Number,
  volume24h: Number,
  priceRub: Number,
  changeRub24h: Number,
  ath: Number
});

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

// Функция получения курса USD/RUB (копия из основного файла)
async function getUSDToRUBRate() {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 5000
    });
    
    if (response.data && response.data.rates && response.data.rates.RUB) {
      const rate = response.data.rates.RUB;
      console.log(`💱 Курс USD/RUB: ${rate}`);
      return rate;
    }
    
    return 100; // Fallback курс
  } catch (error) {
    console.log('⚠️ Ошибка получения курса USD/RUB:', error.message);
    return 100;
  }
}

// Функция получения данных ATH из CoinMarketCap (упрощенная версия)
async function getCMCPrice() {
  try {
    if (!process.env.CMC_API_KEY) {
      return null;
    }

    const response = await axios.get(
      'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
          'Accept': 'application/json'
        },
        params: {
          id: '36465',
          convert: 'USD'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.data && response.data.data['36465']) {
      const cesData = response.data.data['36465'];
      const quote = cesData.quote;
      
      if (quote.USD) {
        console.log('✅ Данные получены из CoinMarketCap');
        console.log(`💰 Цена: $${quote.USD.price?.toFixed(6)}`);
        
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
    
    return null;
  } catch (error) {
    console.log('⚠️ Ошибка CoinMarketCap API:', error.message);
    return null;
  }
}

async function simulatePriceCommand() {
  console.log('🤖 Симуляция команды /price...\n');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB успешно\n');
    
    // Получаем данные из CoinMarketCap
    const cmcData = await getCMCPrice();
    if (cmcData) {
      // Получаем ATH из базы данных
      console.log('🔍 Получаем ATH из базы данных...');
      const maxPriceRecord = await PriceHistory.findOne().sort({ price: -1 });
      const databaseATH = maxPriceRecord ? maxPriceRecord.price : cmcData.price;
      
      const finalATH = Math.max(databaseATH, cmcData.price);
      
      const priceData = {
        price: cmcData.price,
        priceRub: cmcData.priceRub,
        change24h: cmcData.change24h,
        marketCap: cmcData.marketCap,
        volume24h: cmcData.volume24h,
        ath: finalATH,
        source: 'coinmarketcap'
      };
      
      // Сохраняем в базу данных
      await new PriceHistory(priceData).save();
      console.log(`💾 Данные сохранены: $${priceData.price.toFixed(2)} | ATH: $${priceData.ath.toFixed(2)}\n`);
      
      // Форматируем сообщение
      const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
      const changeSign = priceData.change24h >= 0 ? '+' : '';
      const isNewATH = priceData.price >= priceData.ath;
      const athDisplay = isNewATH ? `🏆 $ ${priceData.ath.toFixed(2)}` : `$ ${priceData.ath.toFixed(2)}`;
      const sourceEmoji = '🄲🄼🄲';
      
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
      
      console.log('📱 СООБЩЕНИЕ ДЛЯ ПОЛЬЗОВАТЕЛЯ:');
      console.log(message);
      console.log('\n✅ Команда /price выполнена успешно!');
      
      // Проверяем исправления
      console.log('\n🔍 ПРОВЕРКА ИСПРАВЛЕНИЙ:');
      console.log(`✅ Рубли отображаются: ${priceData.priceRub > 0 ? 'ДА' : 'НЕТ'} (₽${priceData.priceRub.toFixed(2)})`);
      console.log(`✅ ATH из базы данных: ${databaseATH.toFixed(2)} → Финальный ATH: ${finalATH.toFixed(2)}`);
      
    } else {
      console.log('❌ Не удалось получить данные из CoinMarketCap');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Соединение с базой данных закрыто');
  }
}

// Запуск симуляции
simulatePriceCommand().catch(console.error);