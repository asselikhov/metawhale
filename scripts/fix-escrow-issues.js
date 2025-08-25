/**
 * Fix Specific Escrow Issues
 * Исправляет конкретные проблемы, найденные в валидации
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade, EscrowTransaction } = require('../src/database/models');
const escrowService = require('../src/services/escrowService');

async function fixEscrowIssues() {
  try {
    console.log('🔧 ИСПРАВЛЕНИЕ НАЙДЕННЫХ ПРОБЛЕМ ЭСКРОУ');
    console.log('====================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    let fixedIssues = 0;
    
    // 1. Fix balance discrepancy for test_seller_123
    console.log('\n💰 ИСПРАВЛЕНИЕ РАСХОЖДЕНИЙ В БАЛАНСАХ:');
    const testSeller = await User.findOne({ chatId: 'test_seller_123' });
    if (testSeller && testSeller.cesBalance > 0) {
      console.log(`   - Найден пользователь test_seller_123 с балансом ${testSeller.cesBalance} CES`);
      console.log(`   - Сбрасываем тестовый баланс до 0`);
      
      testSeller.cesBalance = 0;
      testSeller.escrowCESBalance = 0;
      await testSeller.save();
      
      console.log(`   ✅ Тестовый баланс исправлен`);
      fixedIssues++;
    }
    
    // 2. Fix expired trades
    console.log('\n🤝 ИСПРАВЛЕНИЕ ПРОСРОЧЕННЫХ СДЕЛОК:');
    const expiredTrades = await P2PTrade.find({
      status: { $in: ['escrow_locked', 'payment_pending'] },
      'timeTracking.createdAt': { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    }).populate('sellerId buyerId');
    
    console.log(`   - Найдено просроченных сделок: ${expiredTrades.length}`);
    
    for (const trade of expiredTrades) {
      try {
        console.log(`   🔍 Обработка просроченной сделки: ${trade._id}`);
        
        // Check if escrow needs to be refunded
        const escrowTx = await EscrowTransaction.findOne({
          tradeId: trade._id,
          type: 'lock',
          status: 'completed'
        });
        
        if (escrowTx) {
          console.log(`     - Найдена блокировка эскроу на ${escrowTx.amount} CES`);
          
          // Refund escrow to seller
          await escrowService.refundTokensFromEscrow(
            trade.sellerId._id,
            trade._id,
            'CES',
            trade.amount,
            'Automatic cleanup: expired trade timeout'
          );
          
          console.log(`     ✅ Эскроу возвращен продавцу`);
        }
        
        // Update trade status
        trade.status = 'cancelled';
        trade.escrowStatus = 'returned';
        trade.disputeReason = 'Automatic cleanup: trade timeout exceeded';
        trade.timeTracking.cancelledAt = new Date();
        
        await trade.save();
        
        console.log(`   ✅ Сделка ${trade._id} отменена и эскроу освобожден`);
        fixedIssues++;
        
      } catch (tradeError) {
        console.error(`   ❌ Ошибка при исправлении сделки ${trade._id}:`, tradeError.message);
      }
    }
    
    // 3. Summary
    console.log(`\n📊 ИТОГИ ИСПРАВЛЕНИЯ:`);
    console.log(`   - Всего исправлено проблем: ${fixedIssues}`);
    
    if (fixedIssues > 0) {
      console.log(`   🎉 Все найденные проблемы успешно исправлены!`);
    } else {
      console.log(`   ℹ️ Проблем для исправления не найдено`);
    }
    
    return fixedIssues;
    
  } catch (error) {
    console.error('❌ Ошибка исправления проблем:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n💾 Соединение с базой данных закрыто');
  }
}

// Run fixes
if (require.main === module) {
  fixEscrowIssues().then(fixedCount => {
    console.log(`\n✅ Исправление завершено. Проблем исправлено: ${fixedCount}`);
    process.exit(0);
  }).catch(error => {
    console.error('❌ Исправление не удалось:', error);
    process.exit(1);
  });
}

module.exports = { fixEscrowIssues };