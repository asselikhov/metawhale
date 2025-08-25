/**
 * Comprehensive Escrow System Validation
 * Полная проверка системы эскроу после всех исправлений
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2POrder, P2PTrade, EscrowTransaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');
const escrowCleanupService = require('../src/services/escrowCleanupService');

async function validateEscrowSystem() {
  try {
    console.log('🔍 КОМПЛЕКСНАЯ ПРОВЕРКА СИСТЕМЫ ЭСКРОУ');
    console.log('===================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    const results = {
      totalUsers: 0,
      usersWithWallets: 0,
      balanceDiscrepancies: 0,
      orphanedEscrows: 0,
      staleOrders: 0,
      staleTrades: 0,
      fixedIssues: 0,
      errors: []
    };
    
    // 1. Проверка всех пользователей с кошельками
    console.log('\n📊 АНАЛИЗ ПОЛЬЗОВАТЕЛЕЙ:');
    const users = await User.find({});
    results.totalUsers = users.length;
    
    const usersWithWallets = users.filter(user => user.walletAddress);
    results.usersWithWallets = usersWithWallets.length;
    
    console.log(`   - Общее количество пользователей: ${results.totalUsers}`);
    console.log(`   - Пользователей с кошельками: ${results.usersWithWallets}`);
    
    // 2. Проверка балансов (первые 5 пользователей)
    console.log('\n💰 ПРОВЕРКА БАЛАНСОВ:');
    for (const user of usersWithWallets.slice(0, 5)) {
      try {
        const realBalance = await walletService.getCESBalance(user.walletAddress);
        const dbBalance = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
        const discrepancy = Math.abs(realBalance - dbBalance);
        
        if (discrepancy > 0.0001) {
          results.balanceDiscrepancies++;
          console.log(`   ⚠️ Расхождение у ${user.chatId}: Блокчейн ${realBalance.toFixed(4)}, БД ${dbBalance.toFixed(4)} CES`);
          results.errors.push(`Balance discrepancy for user ${user.chatId}: ${discrepancy.toFixed(4)} CES`);
        } else {
          console.log(`   ✅ ${user.chatId}: Баланс корректен (${realBalance.toFixed(4)} CES)`);
        }
      } catch (error) {
        results.errors.push(`Failed to check balance for user ${user.chatId}: ${error.message}`);
      }
    }
    
    // 3. Проверка сиротских эскроу
    console.log('\n🔍 ПОИСК СИРОТСКИХ ЭСКРОУ:');
    const orphanedEscrows = await EscrowTransaction.find({
      type: 'lock',
      status: 'completed',
      tradeId: null,
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    results.orphanedEscrows = orphanedEscrows.length;
    console.log(`   - Найдено сиротских эскроу старше 24 часов: ${results.orphanedEscrows}`);
    
    for (const escrow of orphanedEscrows.slice(0, 5)) {
      console.log(`   ⚠️ Сиротский эскроу: ${escrow._id} (${escrow.amount} ${escrow.tokenType})`);
    }
    
    // 4. Проверка устаревших ордеров
    console.log('\n📋 ПРОВЕРКА УСТАРЕВШИХ ОРДЕРОВ:');
    const staleOrders = await P2POrder.find({
      status: 'cancelled',
      escrowLocked: true,
      escrowAmount: { $gt: 0 },
      updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }
    });
    
    results.staleOrders = staleOrders.length;
    console.log(`   - Найдено отмененных ордеров с неосвобожденным эскроу: ${results.staleOrders}`);
    
    for (const order of staleOrders.slice(0, 5)) {
      console.log(`   ⚠️ Устаревший ордер: ${order._id} (${order.escrowAmount} CES)`);
    }
    
    // 5. Проверка просроченных сделок
    console.log('\n🤝 ПРОВЕРКА ПРОСРОЧЕННЫХ СДЕЛОК:');
    const staleTrades = await P2PTrade.find({
      status: { $in: ['escrow_locked', 'payment_pending'] },
      'timeTracking.createdAt': { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    });
    
    results.staleTrades = staleTrades.length;
    console.log(`   - Найдено активных сделок старше 2 часов: ${results.staleTrades}`);
    
    for (const trade of staleTrades.slice(0, 5)) {
      const age = (Date.now() - trade.timeTracking.createdAt.getTime()) / (1000 * 60 * 60);
      console.log(`   ⚠️ Просроченная сделка: ${trade._id} (${age.toFixed(1)} часов, ${trade.amount} CES)`);
    }
    
    // 6. Проверка статистики очистки
    console.log('\n🧹 СТАТИСТИКА СЛУЖБЫ ОЧИСТКИ:');
    const cleanupStats = await escrowCleanupService.getCleanupStatistics();
    
    if (cleanupStats) {
      console.log(`   - Всего пользователей с кошельками: ${cleanupStats.totalUsers}`);
      console.log(`   - Всего транзакций эскроу: ${cleanupStats.totalEscrowTransactions}`);
      console.log(`   - Активных эскроу: ${cleanupStats.activeEscrows}`);
      console.log(`   - Сиротских эскроу: ${cleanupStats.orphanedEscrows}`);
      console.log(`   - Просроченных сделок: ${cleanupStats.staleTrades}`);
      console.log(`   - Истекших ордеров: ${cleanupStats.expiredOrders}`);
    }
    
    // 7. Проверка функций исправления
    console.log('\n🔧 ПРОВЕРКА ИСПРАВЛЕНИЙ В КОДЕ:');
    const codeChecks = {
      cancelOrderFix: false,
      escrowLinkingFix: false,
      validationFix: false,
      cleanupServiceFix: false
    };
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Проверка исправления cancelOrder
      const p2pServiceCode = fs.readFileSync(path.join(__dirname, '../src/services/p2pService.js'), 'utf8');
      if (p2pServiceCode.includes('refundTokensFromEscrow') && 
          p2pServiceCode.includes("order.type === 'sell'") &&
          p2pServiceCode.includes('escrowAmount')) {
        codeChecks.cancelOrderFix = true;
      }
      
      // Проверка улучшения связывания эскроу
      if (p2pServiceCode.includes('linkEscrowToTrade')) {
        codeChecks.escrowLinkingFix = true;
      }
      
      // Проверка улучшенной валидации
      const escrowServiceCode = fs.readFileSync(path.join(__dirname, '../src/services/escrowService.js'), 'utf8');
      if (escrowServiceCode.includes('[ESCROW-LOCK]') && 
          escrowServiceCode.includes('[ESCROW-REFUND]')) {
        codeChecks.validationFix = true;
      }
      
      // Проверка службы очистки
      const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
      if (appCode.includes('escrowCleanupService')) {
        codeChecks.cleanupServiceFix = true;
      }
      
    } catch (error) {
      results.errors.push(`Code check failed: ${error.message}`);
    }
    
    console.log(`   - Исправление cancelOrder: ${codeChecks.cancelOrderFix ? '✅' : '❌'}`);
    console.log(`   - Улучшение связывания эскроу: ${codeChecks.escrowLinkingFix ? '✅' : '❌'}`);
    console.log(`   - Улучшенная валидация: ${codeChecks.validationFix ? '✅' : '❌'}`);
    console.log(`   - Служба автоочистки: ${codeChecks.cleanupServiceFix ? '✅' : '❌'}`);
    
    // 8. Рекомендации
    console.log('\n🎯 РЕКОМЕНДАЦИИ:');
    
    if (results.balanceDiscrepancies > 0) {
      console.log(`   ⚠️ Обнаружено ${results.balanceDiscrepancies} расхождений в балансах - требует исправления`);
    }
    
    if (results.orphanedEscrows > 0) {
      console.log(`   ⚠️ Обнаружено ${results.orphanedEscrows} сиротских эскроу - рекомендуется запустить очистку`);
    }
    
    if (results.staleOrders > 0) {
      console.log(`   ⚠️ Обнаружено ${results.staleOrders} устаревших ордеров - требует очистки`);
    }
    
    if (results.staleTrades > 0) {
      console.log(`   ⚠️ Обнаружено ${results.staleTrades} просроченных сделок - требует принудительной отмены`);
    }
    
    const allCodeChecks = Object.values(codeChecks).every(check => check);
    if (allCodeChecks) {
      console.log(`   ✅ Все исправления кода применены корректно`);
    } else {
      console.log(`   ❌ Некоторые исправления кода отсутствуют`);
    }
    
    if (results.balanceDiscrepancies === 0 && results.orphanedEscrows === 0 && 
        results.staleOrders === 0 && results.staleTrades === 0 && allCodeChecks) {
      console.log(`\n🎉 СИСТЕМА ЭСКРОУ В ОТЛИЧНОМ СОСТОЯНИИ!`);
    } else {
      console.log(`\n⚠️ ТРЕБУЕТСЯ ВНИМАНИЕ - обнаружены проблемы`);
    }
    
    // 9. Итоговая статистика
    console.log('\n📈 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   - Проверено пользователей: ${Math.min(5, results.usersWithWallets)}`);
    console.log(`   - Расхождений в балансах: ${results.balanceDiscrepancies}`);
    console.log(`   - Сиротских эскроу: ${results.orphanedEscrows}`);
    console.log(`   - Устаревших ордеров: ${results.staleOrders}`);
    console.log(`   - Просроченных сделок: ${results.staleTrades}`);
    console.log(`   - Ошибок при проверке: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n🔍 ДЕТАЛИ ОШИБОК:');
      results.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Ошибка валидации системы эскроу:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n💾 Соединение с базой данных закрыто');
  }
}

// Run validation
if (require.main === module) {
  validateEscrowSystem().then(results => {
    console.log('\n✅ Валидация завершена');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Валидация не удалась:', error);
    process.exit(1);
  });
}

module.exports = { validateEscrowSystem };