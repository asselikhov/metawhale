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
    
    // 2. Проверка балансов
    console.log('\n💰 ПРОВЕРКА БАЛАНСОВ:');
    for (const user of usersWithWallets.slice(0, 10)) { // Проверяем первых 10 для примера
      try {
        const realBalance = await walletService.getCESBalance(user.walletAddress);
        const dbBalance = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
        const discrepancy = Math.abs(realBalance - dbBalance);
        
        if (discrepancy > 0.0001) {
          results.balanceDiscrepancies++;
          console.log(`   ⚠️ Расхождение у ${user.chatId}: Блокчейн ${realBalance.toFixed(4)}, БД ${dbBalance.toFixed(4)} CES`);\n          results.errors.push(`Balance discrepancy for user ${user.chatId}: ${discrepancy.toFixed(4)} CES`);\n        } else {\n          console.log(`   ✅ ${user.chatId}: Баланс корректен (${realBalance.toFixed(4)} CES)`);\n        }\n      } catch (error) {\n        results.errors.push(`Failed to check balance for user ${user.chatId}: ${error.message}`);\n      }\n    }\n    \n    // 3. Проверка сиротских эскроу\n    console.log('\n🔍 ПОИСК СИРОТСКИХ ЭСКРОУ:');\n    const orphanedEscrows = await EscrowTransaction.find({\n      type: 'lock',\n      status: 'completed',\n      tradeId: null,\n      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }\n    });\n    \n    results.orphanedEscrows = orphanedEscrows.length;\n    console.log(`   - Найдено сиротских эскроу старше 24 часов: ${results.orphanedEscrows}`);\n    \n    for (const escrow of orphanedEscrows.slice(0, 5)) {\n      console.log(`   ⚠️ Сиротский эскроу: ${escrow._id} (${escrow.amount} ${escrow.tokenType})`);\n    }\n    \n    // 4. Проверка устаревших ордеров\n    console.log('\n📋 ПРОВЕРКА УСТАРЕВШИХ ОРДЕРОВ:');\n    const staleOrders = await P2POrder.find({\n      status: 'cancelled',\n      escrowLocked: true,\n      escrowAmount: { $gt: 0 },\n      updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }\n    });\n    \n    results.staleOrders = staleOrders.length;\n    console.log(`   - Найдено отмененных ордеров с неосвобожденным эскроу: ${results.staleOrders}`);\n    \n    for (const order of staleOrders.slice(0, 5)) {\n      console.log(`   ⚠️ Устаревший ордер: ${order._id} (${order.escrowAmount} CES)`);\n    }\n    \n    // 5. Проверка просроченных сделок\n    console.log('\n🤝 ПРОВЕРКА ПРОСРОЧЕННЫХ СДЕЛОК:');\n    const staleTrades = await P2PTrade.find({\n      status: { $in: ['escrow_locked', 'payment_pending'] },\n      'timeTracking.createdAt': { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }\n    });\n    \n    results.staleTrades = staleTrades.length;\n    console.log(`   - Найдено активных сделок старше 2 часов: ${results.staleTrades}`);\n    \n    for (const trade of staleTrades.slice(0, 5)) {\n      const age = (Date.now() - trade.timeTracking.createdAt.getTime()) / (1000 * 60 * 60);\n      console.log(`   ⚠️ Просроченная сделка: ${trade._id} (${age.toFixed(1)} часов, ${trade.amount} CES)`);\n    }\n    \n    // 6. Проверка статистики очистки\n    console.log('\n🧹 СТАТИСТИКА СЛУЖБЫ ОЧИСТКИ:');\n    const cleanupStats = await escrowCleanupService.getCleanupStatistics();\n    \n    if (cleanupStats) {\n      console.log(`   - Всего пользователей с кошельками: ${cleanupStats.totalUsers}`);\n      console.log(`   - Всего транзакций эскроу: ${cleanupStats.totalEscrowTransactions}`);\n      console.log(`   - Активных эскроу: ${cleanupStats.activeEscrows}`);\n      console.log(`   - Сиротских эскроу: ${cleanupStats.orphanedEscrows}`);\n      console.log(`   - Просроченных сделок: ${cleanupStats.staleTrades}`);\n      console.log(`   - Истекших ордеров: ${cleanupStats.expiredOrders}`);\n    }\n    \n    // 7. Проверка функций исправления\n    console.log('\n🔧 ПРОВЕРКА ИСПРАВЛЕНИЙ В КОДЕ:');\n    const codeChecks = {\n      cancelOrderFix: false,\n      escrowLinkingFix: false,\n      validationFix: false,\n      cleanupServiceFix: false\n    };\n    \n    try {\n      const fs = require('fs');\n      const path = require('path');\n      \n      // Проверка исправления cancelOrder\n      const p2pServiceCode = fs.readFileSync(path.join(__dirname, '../src/services/p2pService.js'), 'utf8');\n      if (p2pServiceCode.includes('refundTokensFromEscrow') && \n          p2pServiceCode.includes(\"order.type === 'sell'\") &&\n          p2pServiceCode.includes('escrowAmount')) {\n        codeChecks.cancelOrderFix = true;\n      }\n      \n      // Проверка улучшения связывания эскроу\n      if (p2pServiceCode.includes('linkEscrowToTrade')) {\n        codeChecks.escrowLinkingFix = true;\n      }\n      \n      // Проверка улучшенной валидации\n      const escrowServiceCode = fs.readFileSync(path.join(__dirname, '../src/services/escrowService.js'), 'utf8');\n      if (escrowServiceCode.includes('[ESCROW-LOCK]') && \n          escrowServiceCode.includes('[ESCROW-REFUND]')) {\n        codeChecks.validationFix = true;\n      }\n      \n      // Проверка службы очистки\n      const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');\n      if (appCode.includes('escrowCleanupService')) {\n        codeChecks.cleanupServiceFix = true;\n      }\n      \n    } catch (error) {\n      results.errors.push(`Code check failed: ${error.message}`);\n    }\n    \n    console.log(`   - Исправление cancelOrder: ${codeChecks.cancelOrderFix ? '✅' : '❌'}`);\n    console.log(`   - Улучшение связывания эскроу: ${codeChecks.escrowLinkingFix ? '✅' : '❌'}`);\n    console.log(`   - Улучшенная валидация: ${codeChecks.validationFix ? '✅' : '❌'}`);\n    console.log(`   - Служба автоочистки: ${codeChecks.cleanupServiceFix ? '✅' : '❌'}`);\n    \n    // 8. Рекомендации\n    console.log('\n🎯 РЕКОМЕНДАЦИИ:');\n    \n    if (results.balanceDiscrepancies > 0) {\n      console.log(`   ⚠️ Обнаружено ${results.balanceDiscrepancies} расхождений в балансах - требует исправления`);\n    }\n    \n    if (results.orphanedEscrows > 0) {\n      console.log(`   ⚠️ Обнаружено ${results.orphanedEscrows} сиротских эскроу - рекомендуется запустить очистку`);\n    }\n    \n    if (results.staleOrders > 0) {\n      console.log(`   ⚠️ Обнаружено ${results.staleOrders} устаревших ордеров - требует очистки`);\n    }\n    \n    if (results.staleTrades > 0) {\n      console.log(`   ⚠️ Обнаружено ${results.staleTrades} просроченных сделок - требует принудительной отмены`);\n    }\n    \n    const allCodeChecks = Object.values(codeChecks).every(check => check);\n    if (allCodeChecks) {\n      console.log(`   ✅ Все исправления кода применены корректно`);\n    } else {\n      console.log(`   ❌ Некоторые исправления кода отсутствуют`);\n    }\n    \n    if (results.balanceDiscrepancies === 0 && results.orphanedEscrows === 0 && \n        results.staleOrders === 0 && results.staleTrades === 0 && allCodeChecks) {\n      console.log(`\n🎉 СИСТЕМА ЭСКРОУ В ОТЛИЧНОМ СОСТОЯНИИ!`);\n    } else {\n      console.log(`\n⚠️ ТРЕБУЕТСЯ ВНИМАНИЕ - обнаружены проблемы`);\n    }\n    \n    // 9. Итоговая статистика\n    console.log('\n📈 ИТОГОВАЯ СТАТИСТИКА:');\n    console.log(`   - Проверено пользователей: ${Math.min(10, results.usersWithWallets)}`);\n    console.log(`   - Расхождений в балансах: ${results.balanceDiscrepancies}`);\n    console.log(`   - Сиротских эскроу: ${results.orphanedEscrows}`);\n    console.log(`   - Устаревших ордеров: ${results.staleOrders}`);\n    console.log(`   - Просроченных сделок: ${results.staleTrades}`);\n    console.log(`   - Ошибок при проверке: ${results.errors.length}`);\n    \n    if (results.errors.length > 0) {\n      console.log('\\n🔍 ДЕТАЛИ ОШИБОК:');\n      results.errors.slice(0, 5).forEach((error, index) => {\n        console.log(`   ${index + 1}. ${error}`);\n      });\n    }\n    \n    return results;\n    \n  } catch (error) {\n    console.error('❌ Ошибка валидации системы эскроу:', error);\n    throw error;\n  } finally {\n    await mongoose.connection.close();\n    console.log('\\n💾 Соединение с базой данных закрыто');\n  }\n}\n\n// Run validation\nif (require.main === module) {\n  validateEscrowSystem().then(results => {\n    console.log('\\n✅ Валидация завершена');\n    process.exit(0);\n  }).catch(error => {\n    console.error('❌ Валидация не удалась:', error);\n    process.exit(1);\n  });\n}\n\nmodule.exports = { validateEscrowSystem };