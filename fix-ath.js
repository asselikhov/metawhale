// Скрипт для исправления данных ATH в базе данных
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
  ath: Number
});

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

async function fixATHData() {
  try {
    console.log('🔧 Исправление данных ATH в базе данных...\n');
    
    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключен к MongoDB\n');
    
    // 1. Найти максимальную цену в истории
    const maxPriceRecord = await PriceHistory.findOne().sort({ price: -1 }).limit(1);
    const correctATH = maxPriceRecord ? maxPriceRecord.price : 0;
    
    console.log(`🏆 Корректный ATH (максимальная цена): $${correctATH.toFixed(2)}\n`);
    
    if (correctATH === 0) {
      console.log('❌ Нет данных для исправления');
      return;
    }
    
    // 2. Подсчет записей для обновления
    const recordsToUpdate = await PriceHistory.countDocuments({
      $or: [
        { ath: { $lt: correctATH } }, // ATH меньше корректного
        { ath: { $exists: false } },   // ATH отсутствует
        { ath: null }                  // ATH равен null
      ]
    });
    
    console.log(`📊 Записей для обновления: ${recordsToUpdate}`);
    
    if (recordsToUpdate === 0) {
      console.log('✅ Все записи уже имеют корректный ATH');
      return;
    }
    
    // 3. Обновление записей
    console.log('🔄 Начинаем обновление...');
    
    // Обновляем все записи с некорректным или отсутствующим ATH
    const updateResult = await PriceHistory.updateMany(
      {\n        $or: [\n          { ath: { $lt: correctATH } },\n          { ath: { $exists: false } },\n          { ath: null }\n        ]\n      },\n      {\n        $set: { ath: correctATH }\n      }\n    );\n    \n    console.log(`✅ Обновлено записей: ${updateResult.modifiedCount}`);\n    \n    // 4. Проверка результата\n    const inconsistentAfter = await PriceHistory.countDocuments({\n      $expr: { $lt: ['$ath', '$price'] }\n    });\n    \n    if (inconsistentAfter === 0) {\n      console.log('🎉 Все записи теперь имеют корректный ATH!');\n    } else {\n      console.log(`⚠️ Остались некорректные записи: ${inconsistentAfter}`);\n    }\n    \n    // 5. Показать статистику после исправления\n    const totalAfter = await PriceHistory.countDocuments();\n    const withCorrectATH = await PriceHistory.countDocuments({ ath: correctATH });\n    \n    console.log('\\n📈 Статистика после исправления:');\n    console.log(`Всего записей: ${totalAfter}`);\n    console.log(`С корректным ATH ($${correctATH.toFixed(2)}): ${withCorrectATH}`);\n    console.log(`Процент исправленных: ${((withCorrectATH / totalAfter) * 100).toFixed(1)}%`);\n    \n  } catch (error) {\n    console.error('❌ Ошибка исправления:', error);\n  } finally {\n    await mongoose.connection.close();\n    console.log('\\n🔌 Соединение с базой данных закрыто');\n  }\n}\n\n// Запуск исправления\nfixATHData();