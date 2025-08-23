// Диагностический скрипт для проверки и исправления ATH
require('dotenv').config();
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
  ath: Number // ATH (All Time High) в USD
});

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

async function diagnoseATH() {
  console.log('🔍 Диагностика проблемы ATH...\n');
  
  try {
    // Подключаемся к MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB успешно\n');
    
    // Получаем статистику из базы данных
    const totalRecords = await PriceHistory.countDocuments();
    console.log(`📊 Всего записей в базе: ${totalRecords}`);
    
    // Находим максимальную цену за все время
    const maxPriceRecord = await PriceHistory.findOne().sort({ price: -1 });
    const maxPrice = maxPriceRecord ? maxPriceRecord.price : 0;
    console.log(`🏆 Максимальная цена в базе данных: $${maxPrice.toFixed(2)}`);
    
    // Находим последнюю запись
    const lastRecord = await PriceHistory.findOne().sort({ timestamp: -1 });
    if (lastRecord) {
      console.log(`📈 Последняя запись:`);
      console.log(`   Цена: $${lastRecord.price.toFixed(2)}`);
      console.log(`   ATH в записи: $${lastRecord.ath?.toFixed(2) || 'не установлен'}`);
      console.log(`   Время: ${lastRecord.timestamp}`);
    }
    
    // Проверяем записи с неправильным ATH
    const recordsWithWrongATH = await PriceHistory.find({
      $or: [
        { ath: { $lt: maxPrice } },
        { ath: null },
        { ath: { $exists: false } }
      ]
    }).sort({ timestamp: -1 }).limit(10);
    
    if (recordsWithWrongATH.length > 0) {
      console.log(`\n⚠️ Найдено ${recordsWithWrongATH.length} записей с неправильным ATH:`);
      recordsWithWrongATH.forEach((record, i) => {
        console.log(`${i + 1}. Цена: $${record.price.toFixed(2)}, ATH: $${record.ath?.toFixed(2) || 'не установлен'}, Время: ${record.timestamp}`);
      });
      
      // Предлагаем исправление
      console.log(`\n🛠️ Исправляем ATH для всех записей...`);
      const result = await PriceHistory.updateMany(
        {},
        { $set: { ath: maxPrice } }
      );
      console.log(`✅ Обновлено ${result.modifiedCount} записей`);
    } else {
      console.log('\n✅ Все записи имеют правильный ATH');
    }
    
    // Получаем последние 5 записей для проверки
    const recentRecords = await PriceHistory.find().sort({ timestamp: -1 }).limit(5);
    console.log('\n📋 Последние 5 записей:');
    recentRecords.forEach((record, i) => {
      const isCorrectATH = record.ath === maxPrice;
      console.log(`${i + 1}. $${record.price.toFixed(2)} | ATH: $${record.ath?.toFixed(2) || 'N/A'} ${isCorrectATH ? '✅' : '❌'} | ${record.timestamp}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при диагностике ATH:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Диагностика завершена');
  }
}

// Запускаем диагностику
diagnoseATH().catch(console.error);