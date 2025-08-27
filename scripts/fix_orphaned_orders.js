/**
 * 🔧 ИСПРАВЛЕНИЕ СИРОТСКИХ ОРДЕРОВ
 * Скрипт для проверки и исправления ордеров с отсутствующими или недействительными пользователями
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, P2POrder, User } = require('../src/database/models');

async function fixOrphanedOrders() {
  try {
    console.log('🔧 Проверка и исправление сиротских ордеров...');
    
    await connectDatabase();
    console.log('✅ Подключение к базе данных установлено');
    
    // 1. Найти ордера без userId
    console.log('\n📋 ПРОВЕРКА ОРДЕРОВ БЕЗ ПОЛЬЗОВАТЕЛЕЙ:');
    const ordersWithoutUser = await P2POrder.find({
      userId: { $in: [null, undefined] }
    });
    
    console.log(`📊 Найдено ${ordersWithoutUser.length} ордеров без пользователей`);
    
    let fixedWithoutUser = 0;
    for (const order of ordersWithoutUser) {
      console.log(`🔄 Отменяем ордер без пользователя: ${order._id}`);
      order.status = 'cancelled';
      order.cancelReason = 'Ордер не связан с пользователем (автоисправление)';
      order.canceledAt = new Date();
      await order.save();
      fixedWithoutUser++;
    }
    
    // 2. Найти ордера с недействительными userId
    console.log('\n👤 ПРОВЕРКА ОРДЕРОВ С НЕДЕЙСТВИТЕЛЬНЫМИ ПОЛЬЗОВАТЕЛЯМИ:');
    const allActiveOrders = await P2POrder.find({
      status: { $in: ['active', 'partial'] },
      userId: { $ne: null }
    });
    
    console.log(`📊 Найдено ${allActiveOrders.length} активных ордеров для проверки`);
    
    let fixedInvalidUser = 0;
    for (const order of allActiveOrders) {
      try {
        // Проверяем, существует ли пользователь
        const user = await User.findById(order.userId);
        if (!user) {
          console.log(`🔄 Отменяем ордер с несуществующим пользователем: ${order._id} (userId: ${order.userId})`);
          order.status = 'cancelled';
          order.cancelReason = 'Пользователь не найден (автоисправление)';
          order.canceledAt = new Date();
          await order.save();
          fixedInvalidUser++;
        }
      } catch (error) {
        console.log(`🔄 Отменяем ордер с некорректным userId: ${order._id} (ошибка: ${error.message})`);
        order.status = 'cancelled';
        order.cancelReason = 'Некорректный пользователь (автоисправление)';
        order.canceledAt = new Date();
        await order.save();
        fixedInvalidUser++;
      }
    }
    
    // 3. Финальная статистика
    const totalFixed = fixedWithoutUser + fixedInvalidUser;
    
    console.log(`\n📊 РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ:`);
    console.log(`✅ Исправлено ордеров без пользователей: ${fixedWithoutUser}`);
    console.log(`✅ Исправлено ордеров с недействительными пользователями: ${fixedInvalidUser}`);
    console.log(`📈 Общее количество исправлений: ${totalFixed}`);
    
    if (totalFixed === 0) {
      console.log('🎉 Все ордера в порядке! Исправления не требуются.');
    } else {
      console.log('🎉 Исправление сиротских ордеров завершено успешно!');
    }
    
    // 4. Проверка оставшихся активных ордеров
    console.log('\n🔍 ФИНАЛЬНАЯ ПРОВЕРКА:');
    const remainingActiveOrders = await P2POrder.find({
      status: { $in: ['active', 'partial'] }
    }).populate('userId');
    
    let validOrders = 0;
    let invalidOrders = 0;
    
    for (const order of remainingActiveOrders) {
      if (order.userId && order.userId._id) {
        validOrders++;
      } else {
        invalidOrders++;
        console.log(`⚠️ Все еще проблемный ордер: ${order._id}`);
      }
    }
    
    console.log(`✅ Валидных активных ордеров: ${validOrders}`);
    console.log(`❌ Проблемных ордеров: ${invalidOrders}`);
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении сиротских ордеров:', error);
  } finally {
    await disconnectDatabase();
    console.log('🔌 Отключение от базы данных');
  }
}

// Запустить скрипт
if (require.main === module) {
  fixOrphanedOrders()
    .then(() => {
      console.log('✅ Скрипт исправления сиротских ордеров завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершился с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { fixOrphanedOrders };