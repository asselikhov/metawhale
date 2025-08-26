/**
 * Быстрая Проверка Безопасности Эскроу
 * Проверяет состояние системы эскроу и выявляет потенциальные проблемы
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/database/models');

async function quickEscrowCheck() {
  try {
    console.log('🔍 БЫСТРАЯ ПРОВЕРКА БЕЗОПАСНОСТИ ЭСКРОУ');
    console.log('=====================================');
    
    await connectDatabase();
    
    const { EscrowTransaction, P2PTrade, User } = require('../src/database/models');
    
    // 1. Проверка активных эскроу
    console.log('\n📊 1. АНАЛИЗ АКТИВНЫХ ЭСКРОУ:');
    
    const activeEscrows = await EscrowTransaction.find({
      type: 'lock',
      status: 'completed',
      smartContractEscrowId: { $exists: true, $ne: null }
    }).populate('userId', 'chatId username firstName');
    
    console.log(`   Всего активных эскроу: ${activeEscrows.length}`);
    
    if (activeEscrows.length > 0) {
      console.log('   Детали активных эскроу:');
      for (const escrow of activeEscrows.slice(0, 5)) { // Показываем первые 5
        const refund = await EscrowTransaction.findOne({
          tradeId: escrow.tradeId,
          type: 'refund',
          smartContractEscrowId: escrow.smartContractEscrowId
        });
        
        const status = refund ? '✅ Возвращен' : '⚠️ Активен';
        console.log(`   - ID ${escrow.smartContractEscrowId}: ${escrow.amount} CES, ${status}`);
        console.log(`     Пользователь: ${escrow.userId?.chatId || 'Unknown'} (${escrow.userId?.username || escrow.userId?.firstName || 'N/A'})`);
        console.log(`     Создан: ${escrow.createdAt.toISOString()}`);
      }
      
      if (activeEscrows.length > 5) {
        console.log(`   ... и еще ${activeEscrows.length - 5} эскроу`);
      }
    }
    
    // 2. Проверка зависших сделок
    console.log('\n🕐 2. ПРОВЕРКА ЗАВИСШИХ СДЕЛОК:');
    
    const stuckTrades = await P2PTrade.find({
      status: { $in: ['escrow_locked', 'payment_pending'] },
      'timeTracking.createdAt': { $lt: new Date(Date.now() - 60 * 60 * 1000) } // Старше 1 часа
    }).populate('sellerId buyerId', 'chatId username firstName');
    
    console.log(`   Зависших сделок: ${stuckTrades.length}`);
    
    if (stuckTrades.length > 0) {
      console.log('   Детали зависших сделок:');
      for (const trade of stuckTrades) {
        const age = Math.round((Date.now() - trade.timeTracking.createdAt.getTime()) / (60 * 1000));
        console.log(`   - Сделка ${trade._id}: ${trade.amount} CES, возраст ${age} мин`);
        console.log(`     Статус: ${trade.status}, Продавец: ${trade.sellerId?.chatId}`);
      }
    }
    
    // 3. Проверка записей о ручном вмешательстве
    console.log('\n🛠️ 3. ЗАПИСИ О РУЧНОМ ВМЕШАТЕЛЬСТВЕ:');
    
    const manualInterventions = await EscrowTransaction.find({
      type: { $in: ['manual_intervention_required', 'timeout_intervention_required'] },
      status: 'pending'
    }).populate('userId', 'chatId username firstName');
    
    console.log(`   Требуется ручных вмешательств: ${manualInterventions.length}`);
    
    if (manualInterventions.length > 0) {
      console.log('   Детали:');
      for (const intervention of manualInterventions) {
        console.log(`   - ${intervention.type}: ${intervention.amount} CES`);
        console.log(`     Пользователь: ${intervention.userId?.chatId} (${intervention.userId?.username || intervention.userId?.firstName || 'N/A'})`);
        console.log(`     Причина: ${intervention.reason}`);
        console.log(`     Создано: ${intervention.createdAt.toISOString()}`);
      }
    }
    
    // 4. Проверка пользователей с эскроу балансами
    console.log('\n👥 4. ПОЛЬЗОВАТЕЛИ С ЭСКРОУ БАЛАНСАМИ:');
    
    const usersWithEscrow = await User.find({
      escrowCESBalance: { $gt: 0 }
    }, 'chatId username firstName escrowCESBalance cesBalance walletAddress').limit(10);
    
    console.log(`   Пользователей с эскроу: ${usersWithEscrow.length}`);
    
    if (usersWithEscrow.length > 0) {
      console.log('   Топ пользователей по эскроу:');
      for (const user of usersWithEscrow) {
        console.log(`   - ${user.chatId} (${user.username || user.firstName || 'N/A'}): ${user.escrowCESBalance} CES в эскроу`);
        console.log(`     Доступно: ${user.cesBalance} CES, Кошелек: ${user.walletAddress?.slice(0, 10)}...`);
      }
    }
    
    // 5. Статистика за последние 24 часа
    console.log('\n📈 5. СТАТИСТИКА ЗА 24 ЧАСА:');
    
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stats = {
      newEscrows: await EscrowTransaction.countDocuments({
        type: 'lock',
        createdAt: { $gte: last24h }
      }),
      refunds: await EscrowTransaction.countDocuments({
        type: 'refund',
        createdAt: { $gte: last24h }
      }),
      completedTrades: await P2PTrade.countDocuments({
        status: 'completed',
        'timeTracking.completedAt': { $gte: last24h }
      }),
      cancelledTrades: await P2PTrade.countDocuments({
        status: 'cancelled',
        'timeTracking.createdAt': { $gte: last24h }
      })
    };
    
    console.log(`   Новых эскроу: ${stats.newEscrows}`);
    console.log(`   Возвратов: ${stats.refunds}`);
    console.log(`   Завершенных сделок: ${stats.completedTrades}`);
    console.log(`   Отмененных сделок: ${stats.cancelledTrades}`);
    
    // 6. Общая оценка здоровья системы
    console.log('\n🏥 6. ОЦЕНКА ЗДОРОВЬЯ СИСТЕМЫ:');
    
    let healthScore = 100;
    const issues = [];
    
    if (stuckTrades.length > 0) {
      healthScore -= stuckTrades.length * 10;
      issues.push(`${stuckTrades.length} зависших сделок`);
    }
    
    if (manualInterventions.length > 0) {
      healthScore -= manualInterventions.length * 15;
      issues.push(`${manualInterventions.length} требуют ручного вмешательства`);
    }
    
    const unresolvedEscrows = activeEscrows.filter(async escrow => {
      const refund = await EscrowTransaction.findOne({
        tradeId: escrow.tradeId,
        type: 'refund',
        smartContractEscrowId: escrow.smartContractEscrowId
      });
      return !refund;
    });
    
    if (unresolvedEscrows.length > 5) {
      healthScore -= (unresolvedEscrows.length - 5) * 5;
      issues.push(`${unresolvedEscrows.length} нерешенных эскроу`);
    }
    
    healthScore = Math.max(0, healthScore);
    
    if (healthScore >= 90) {
      console.log(`   🟢 ОТЛИЧНОЕ состояние (${healthScore}/100)`);
    } else if (healthScore >= 70) {
      console.log(`   🟡 ХОРОШЕЕ состояние (${healthScore}/100)`);
    } else if (healthScore >= 50) {
      console.log(`   🟠 УДОВЛЕТВОРИТЕЛЬНОЕ состояние (${healthScore}/100)`);
    } else {
      console.log(`   🔴 ТРЕБУЕТ ВНИМАНИЯ (${healthScore}/100)`);
    }
    
    if (issues.length > 0) {
      console.log('   Обнаруженные проблемы:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('   ✅ Критических проблем не обнаружено');
    }
    
    // 7. Рекомендации
    console.log('\n💡 7. РЕКОМЕНДАЦИИ:');
    
    if (healthScore < 70) {
      console.log('   🚨 НЕМЕДЛЕННЫЕ ДЕЙСТВИЯ:');
      if (manualInterventions.length > 0) {
        console.log('   - Обработать записи о ручном вмешательстве');
      }
      if (stuckTrades.length > 0) {
        console.log('   - Проверить зависшие сделки');
      }
    }
    
    console.log('   📅 РЕГУЛЯРНЫЕ ДЕЙСТВИЯ:');
    console.log('   - Запускать мониторинг каждые 30 минут');
    console.log('   - Проверять балансы пользователей ежедневно');
    console.log('   - Резервное копирование данных эскроу');
    
    if (usersWithEscrow.length > 20) {
      console.log('   - Оптимизировать процесс эскроу (много активных пользователей)');
    }
    
    await disconnectDatabase();
    
    console.log('\n✅ Быстрая проверка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
    await disconnectDatabase();
    throw error;
  }
}

// Запуск если вызван напрямую
if (require.main === module) {
  quickEscrowCheck()
    .then(() => {
      console.log('\n🎉 Проверка завершена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Проверка провалилась:', error);
      process.exit(1);
    });
}

module.exports = { quickEscrowCheck };