/**
 * 🔧 ИСПРАВЛЕНИЕ ПРОБЛЕМНЫХ ЭСКРОУ ТРАНЗАКЦИЙ
 * Скрипт для исправления существующих эскроу транзакций со статусом, который не поддерживается в enum
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, EscrowTransaction } = require('../src/database/models');

async function fixProblematicEscrow() {
  try {
    console.log('🔧 Исправление проблемных эскроу транзакций...');
    
    await connectDatabase();
    console.log('✅ Подключение к базе данных установлено');
    
    // Найти все эскроу транзакции, которые могут иметь проблемы
    const allEscrows = await EscrowTransaction.find({});
    console.log(`📊 Найдено ${allEscrows.length} эскроу транзакций для проверки`);
    
    let fixedCount = 0;
    
    for (const escrow of allEscrows) {
      try {
        // Попытаться сохранить эскроу - если есть проблемы с enum, это выбросит ошибку
        await escrow.validate();
      } catch (validationError) {
        if (validationError.message.includes('is not a valid enum value')) {
          console.log(`🔄 Исправление эскроу транзакции ${escrow._id} со статусом "${escrow.status}"`);
          
          // Исправить статус в зависимости от текущего состояния
          if (escrow.status === 'cancelled' || escrow.status === 'canceled') {
            // Статус 'cancelled' уже должен быть валидным, но если проблема есть, 
            // проверим что делать дальше
            console.log(`ℹ️ Статус 'cancelled' должен быть валидным. Возможно проблема в другом месте.`);
            // Попробуем пересохранить
            escrow.status = 'cancelled';
          } else if (!['pending', 'completed', 'failed', 'cancelled'].includes(escrow.status)) {
            // Если статус неизвестный, устанавливаем failed
            escrow.status = 'failed';
            escrow.reason = escrow.reason || `Автоматическое исправление: неподдерживаемый статус`;
          }
          
          await escrow.save();
          fixedCount++;
          console.log(`✅ Исправлена эскроу транзакция ${escrow._id}: статус установлен в "${escrow.status}"`);
        }
      }
    }
    
    console.log(`\n📊 РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ:`);
    console.log(`✅ Исправлено эскроу транзакций: ${fixedCount}`);
    console.log(`📈 Общее количество эскроу транзакций: ${allEscrows.length}`);
    
    if (fixedCount === 0) {
      console.log('🎉 Все эскроу транзакции в порядке! Исправления не требуются.');
    } else {
      console.log('🎉 Исправление завершено успешно!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении эскроу транзакций:', error);
  } finally {
    await disconnectDatabase();
    console.log('🔌 Отключение от базы данных');
  }
}

// Запустить скрипт
if (require.main === module) {
  fixProblematicEscrow()
    .then(() => {
      console.log('✅ Скрипт исправления завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт исправления завершился с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { fixProblematicEscrow };