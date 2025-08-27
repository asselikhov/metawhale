/**
 * 🔧 ИСПРАВЛЕНИЕ ПРОБЛЕМНЫХ ОРДЕРОВ
 * Скрипт для исправления существующих ордеров со статусом, который не поддерживается в enum
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, P2POrder } = require('../src/database/models');

async function fixProblematicOrders() {
  try {
    console.log('🔧 Исправление проблемных P2P ордеров...');
    
    await connectDatabase();
    console.log('✅ Подключение к базе данных установлено');
    
    // Найти все ордера, которые могут иметь проблемы
    const allOrders = await P2POrder.find({});
    console.log(`📊 Найдено ${allOrders.length} ордеров для проверки`);
    
    let fixedCount = 0;
    
    for (const order of allOrders) {
      try {
        // Попытаться сохранить ордер - если есть проблемы с enum, это выбросит ошибку
        await order.validate();
      } catch (validationError) {
        if (validationError.message.includes('is not a valid enum value')) {
          console.log(`🔄 Исправление ордера ${order._id} со статусом "${order.status}"`);
          
          // Исправить статус в зависимости от текущего состояния
          if (order.status === 'expired' || order.status === 'timeout') {
            order.status = 'cancelled';
            order.cancelReason = order.cancelReason || 'Истёк срок действия ордера';
            order.canceledAt = order.canceledAt || new Date();
          } else if (!['active', 'partial', 'completed', 'cancelled', 'locked'].includes(order.status)) {
            // Если статус неизвестный, устанавливаем cancelled
            order.status = 'cancelled';
            order.cancelReason = `Автоматическое исправление: неподдерживаемый статус "${order.status}"`;
            order.canceledAt = new Date();
          }
          
          await order.save();
          fixedCount++;
          console.log(`✅ Исправлен ордер ${order._id}: статус установлен в "${order.status}"`);
        }
      }
    }
    
    console.log(`\n📊 РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ:`);
    console.log(`✅ Исправлено ордеров: ${fixedCount}`);
    console.log(`📈 Общее количество ордеров: ${allOrders.length}`);
    
    if (fixedCount === 0) {
      console.log('🎉 Все ордера в порядке! Исправления не требуются.');
    } else {
      console.log('🎉 Исправление завершено успешно!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении ордеров:', error);
  } finally {
    await disconnectDatabase();
    console.log('🔌 Отключение от базы данных');
  }
}

// Запустить скрипт
if (require.main === module) {
  fixProblematicOrders()
    .then(() => {
      console.log('✅ Скрипт исправления завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт исправления завершился с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { fixProblematicOrders };