/**
 * 🔧 КОМПЛЕКСНОЕ ИСПРАВЛЕНИЕ ВАЛИДАЦИОННЫХ ПРОБЛЕМ
 * Исправляет все проблемы с enum значениями в базе данных
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, P2POrder, EscrowTransaction } = require('../src/database/models');

async function fixAllValidationIssues() {
  try {
    console.log('🔧 Исправление всех валидационных проблем...');
    
    await connectDatabase();
    console.log('✅ Подключение к базе данных установлено');
    
    let totalFixed = 0;
    
    // 1. Исправляем P2POrder с неподдерживаемыми статусами
    console.log('\n📋 ИСПРАВЛЕНИЕ P2P ОРДЕРОВ:');
    const orders = await P2POrder.find({});
    console.log(`📊 Найдено ${orders.length} ордеров для проверки`);
    
    let fixedOrders = 0;
    for (const order of orders) {
      try {
        await order.validate();
      } catch (error) {
        if (error.message.includes('is not a valid enum value')) {
          console.log(`🔄 Исправление ордера ${order._id} со статусом "${order.status}"`);
          
          if (order.status === 'expired' || order.status === 'timeout') {
            order.status = 'cancelled';
            order.cancelReason = order.cancelReason || 'Истёк срок действия ордера (автоисправление)';
            order.canceledAt = order.canceledAt || new Date();
          } else if (!['active', 'partial', 'completed', 'cancelled', 'locked'].includes(order.status)) {
            order.status = 'cancelled';
            order.cancelReason = `Автоматическое исправление: неподдерживаемый статус "${order.status}"`;
            order.canceledAt = new Date();
          }
          
          await order.save();
          fixedOrders++;
          console.log(`✅ Исправлен ордер ${order._id}: статус установлен в "${order.status}"`);
        }
      }
    }
    
    // 2. Исправляем EscrowTransaction с неподдерживаемыми статусами
    console.log('\n💰 ИСПРАВЛЕНИЕ ЭСКРОУ ТРАНЗАКЦИЙ:');
    const escrows = await EscrowTransaction.find({});
    console.log(`📊 Найдено ${escrows.length} эскроу транзакций для проверки`);
    
    let fixedEscrows = 0;
    for (const escrow of escrows) {
      try {
        await escrow.validate();
      } catch (error) {
        if (error.message.includes('is not a valid enum value')) {
          console.log(`🔄 Исправление эскроу транзакции ${escrow._id} со статусом "${escrow.status}"`);
          
          if (escrow.status === 'cancelled' || escrow.status === 'canceled') {
            escrow.status = 'failed';
            escrow.reason = escrow.reason || 'Операция отменена (автоисправление)';
          } else if (!['pending', 'completed', 'failed'].includes(escrow.status)) {
            escrow.status = 'failed';
            escrow.reason = `Автоматическое исправление: неподдерживаемый статус "${escrow.status}"`;
          }
          
          await escrow.save();
          fixedEscrows++;
          console.log(`✅ Исправлена эскроу транзакция ${escrow._id}: статус установлен в "${escrow.status}"`);
        }
      }
    }
    
    totalFixed = fixedOrders + fixedEscrows;
    
    console.log(`\n📊 РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ:`);
    console.log(`✅ Исправлено P2P ордеров: ${fixedOrders}`);
    console.log(`✅ Исправлено эскроу транзакций: ${fixedEscrows}`);
    console.log(`📈 Общее количество исправлений: ${totalFixed}`);
    
    if (totalFixed === 0) {
      console.log('🎉 Все записи в порядке! Исправления не требуются.');
    } else {
      console.log('🎉 Исправление завершено успешно!');
    }
    
    // 3. Проверка финальной валидации
    console.log('\n🔍 ФИНАЛЬНАЯ ПРОВЕРКА:');
    
    let validationErrors = 0;
    
    // Проверяем все ордера
    const allOrders = await P2POrder.find({});
    for (const order of allOrders) {
      try {
        await order.validate();
      } catch (error) {
        console.error(`❌ Ордер ${order._id} все еще имеет ошибки валидации:`, error.message);
        validationErrors++;
      }
    }
    
    // Проверяем все эскроу
    const allEscrows = await EscrowTransaction.find({});
    for (const escrow of allEscrows) {
      try {
        await escrow.validate();
      } catch (error) {
        console.error(`❌ Эскроу ${escrow._id} все еще имеет ошибки валидации:`, error.message);
        validationErrors++;
      }
    }
    
    if (validationErrors === 0) {
      console.log('✅ Все записи прошли финальную проверку валидации!');
    } else {
      console.log(`⚠️ Найдено ${validationErrors} записей с проблемами валидации.`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении валидационных проблем:', error);
  } finally {
    await disconnectDatabase();
    console.log('🔌 Отключение от базы данных');
  }
}

// Запустить скрипт
if (require.main === module) {
  fixAllValidationIssues()
    .then(() => {
      console.log('✅ Комплексное исправление завершено');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Комплексное исправление завершилось с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { fixAllValidationIssues };