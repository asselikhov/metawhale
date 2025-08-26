/**
 * Investigate Missing Tokens Script
 * Расследование пропавших 1.3 CES токенов у пользователя 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade, P2POrder, EscrowTransaction, Transaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function investigateMissingTokens() {
  try {
    console.log('🕵️ РАССЛЕДОВАНИЕ ПРОПАВШИХ ТОКЕНОВ');
    console.log('====================================');
    console.log(`🎯 Кошелек: ${TARGET_WALLET}`);
    console.log('📊 Ожидаемый баланс: 2 CES');
    console.log('📊 Фактический баланс: 0.7 CES');
    console.log('❌ ПРОПАЛО: 1.3 CES');
    console.log('');
    
    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    // Поиск пользователя
    const user = await User.findOne({ walletAddress: TARGET_WALLET });
    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }
    
    console.log(`\n👤 ПОЛЬЗОВАТЕЛЬ: ${user.firstName} (${user.chatId})`);
    
    // 1. ПОЛНАЯ ИСТОРИЯ ЭСКРОУ ТРАНЗАКЦИЙ
    console.log(`\n📋 ПОЛНАЯ ИСТОРИЯ ЭСКРОУ ТРАНЗАКЦИЙ:`);
    const allEscrowTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES'
    }).sort({ createdAt: 1 }); // По возрастанию времени
    
    let runningBalance = 0;
    let totalLocked = 0;
    let totalReleased = 0;
    let totalRefunded = 0;
    
    console.log(`\n📈 ХРОНОЛОГИЯ ЭСКРОУ ОПЕРАЦИЙ:`);
    allEscrowTxs.forEach((tx, index) => {
      const date = tx.createdAt.toLocaleString('ru-RU');
      const amount = tx.amount;
      
      if (tx.type === 'lock' && tx.status === 'completed') {
        runningBalance += amount;
        totalLocked += amount;
        console.log(`${index + 1}. ${date} | БЛОКИРОВКА: +${amount} CES | Баланс эскроу: ${runningBalance} CES`);
      } else if (tx.type === 'release' && tx.status === 'completed') {
        runningBalance -= amount;
        totalReleased += amount;
        console.log(`${index + 1}. ${date} | ОСВОБОЖДЕНИЕ: -${amount} CES | Баланс эскроу: ${runningBalance} CES`);
      } else if (tx.type === 'refund' && tx.status === 'completed') {
        runningBalance -= amount;
        totalRefunded += amount;
        console.log(`${index + 1}. ${date} | ВОЗВРАТ: -${amount} CES | Баланс эскроу: ${runningBalance} CES`);
      } else {
        console.log(`${index + 1}. ${date} | ${tx.type.toUpperCase()}: ${amount} CES (${tx.status}) | Не влияет на баланс`);
      }
      
      console.log(`      Причина: ${tx.reason || 'Не указано'}`);
      if (tx.tradeId) {
        console.log(`      Сделка: ${tx.tradeId}`);
      }
      console.log('');
    });
    
    console.log(`📊 ИТОГИ ЭСКРОУ ОПЕРАЦИЙ:`);
    console.log(`   - Всего заблокировано: ${totalLocked.toFixed(4)} CES`);
    console.log(`   - Всего освобождено: ${totalReleased.toFixed(4)} CES`);
    console.log(`   - Всего возвращено: ${totalRefunded.toFixed(4)} CES`);
    console.log(`   - Расчетный баланс эскроу: ${(totalLocked - totalReleased - totalRefunded).toFixed(4)} CES`);
    console.log(`   - Текущий баланс эскроу в БД: ${user.escrowCESBalance || 0} CES`);
    
    // 2. ИСТОРИЯ ОБЫЧНЫХ ТРАНЗАКЦИЙ
    console.log(`\n💸 ИСТОРИЯ ОБЫЧНЫХ ТРАНЗАКЦИЙ:`);
    const userTransactions = await Transaction.find({
      $or: [
        { fromUserId: user._id, tokenType: 'CES' },
        { toUserId: user._id, tokenType: 'CES' }
      ]
    }).sort({ createdAt: 1 });
    
    if (userTransactions.length === 0) {
      console.log('   - Нет обычных транзакций CES');
    } else {
      userTransactions.forEach((tx, index) => {
        const date = tx.createdAt.toLocaleString('ru-RU');
        const isIncoming = tx.toUserId && tx.toUserId.toString() === user._id.toString();
        const direction = isIncoming ? 'ПОЛУЧЕНО' : 'ОТПРАВЛЕНО';
        const sign = isIncoming ? '+' : '-';
        
        console.log(`   ${index + 1}. ${date} | ${direction}: ${sign}${tx.amount} CES | Статус: ${tx.status}`);
        console.log(`      От: ${tx.fromAddress}`);
        console.log(`      К: ${tx.toAddress}`);
        if (tx.txHash) {
          console.log(`      Хеш: ${tx.txHash}`);
        }
        console.log('');
      });
    }
    
    // 3. ИСТОРИЯ P2P ОРДЕРОВ
    console.log(`\n📋 ИСТОРИЯ P2P ОРДЕРОВ:`);
    const allOrders = await P2POrder.find({
      userId: user._id,
      type: 'sell'
    }).sort({ createdAt: 1 });
    
    if (allOrders.length === 0) {
      console.log('   - Нет P2P ордеров на продажу');
    } else {
      console.log(`\n📈 ХРОНОЛОГИЯ P2P ОРДЕРОВ:`);
      allOrders.forEach((order, index) => {
        const date = order.createdAt.toLocaleString('ru-RU');
        const escrowInfo = order.escrowLocked ? `(${order.escrowAmount || 0} CES в эскроу)` : '(без эскроу)';
        
        console.log(`   ${index + 1}. ${date} | Ордер ${order._id}`);
        console.log(`      Количество: ${order.amount} CES`);
        console.log(`      Статус: ${order.status} ${escrowInfo}`);
        console.log(`      Заполнено: ${order.filledAmount || 0} CES`);
        console.log(`      Остается: ${order.remainingAmount || 0} CES`);
        console.log('');
      });
    }
    
    // 4. ИСТОРИЯ P2P СДЕЛОК
    console.log(`\n🤝 ИСТОРИЯ P2P СДЕЛОК (где пользователь - продавец):`);
    const allTrades = await P2PTrade.find({
      sellerId: user._id
    }).sort({ 'timeTracking.createdAt': 1 });
    
    if (allTrades.length === 0) {
      console.log('   - Нет P2P сделок где пользователь продавец');
    } else {
      console.log(`\n📈 ХРОНОЛОГИЯ P2P СДЕЛОК:`);
      allTrades.forEach((trade, index) => {
        const date = trade.timeTracking?.createdAt?.toLocaleString('ru-RU') || 'Неизвестно';
        
        console.log(`   ${index + 1}. ${date} | Сделка ${trade._id}`);
        console.log(`      Количество: ${trade.amount} CES`);
        console.log(`      Статус сделки: ${trade.status}`);
        console.log(`      Статус эскроу: ${trade.escrowStatus}`);
        console.log(`      Сумма: ${trade.totalValue} ₽`);
        if (trade.disputeReason) {
          console.log(`      Причина отмены: ${trade.disputeReason}`);
        }
        console.log('');
      });
    }
    
    // 5. АНАЛИЗ БЛОКЧЕЙН ТРАНЗАКЦИЙ
    console.log(`\n🔗 ПРОВЕРКА БЛОКЧЕЙН ТРАНЗАКЦИЙ:`);
    let realBalance = 0;
    try {
      realBalance = await walletService.getCESBalance(user.walletAddress);
      console.log(`   - Текущий баланс в блокчейне: ${realBalance.toFixed(4)} CES`);
      
      // Проверим историю транзакций в блокчейне (если доступно)
      // Это требует дополнительных API вызовов к Polygon scan
      console.log(`   - Для полного анализа блокчейн транзакций требуется Polygon scan API`);
      
    } catch (error) {
      console.log(`   ❌ Ошибка получения баланса из блокчейна: ${error.message}`);
      realBalance = 0.7; // Используем известное значение
    }
    
    // 6. ПОИСК ВОЗМОЖНЫХ ПРОБЛЕМ
    console.log(`\n🔍 АНАЛИЗ ВОЗМОЖНЫХ ПРОБЛЕМ:`);
    
    // Проверка на двойное списание
    const duplicateRefunds = allEscrowTxs.filter(tx => 
      tx.type === 'refund' && 
      tx.reason && 
      tx.reason.includes('Automatic balance correction')
    );
    
    if (duplicateRefunds.length > 0) {
      console.log(`   ⚠️ НАЙДЕНЫ АВТОМАТИЧЕСКИЕ КОРРЕКТИРОВКИ БАЛАНСА: ${duplicateRefunds.length}`);
      duplicateRefunds.forEach((tx, index) => {
        const date = tx.createdAt.toLocaleString('ru-RU');
        console.log(`      ${index + 1}. ${date}: ${tx.amount} CES - ${tx.reason}`);
      });
    }
    
    // Проверка на некорректные возвраты
    const unexpectedRefunds = allEscrowTxs.filter(tx => 
      tx.type === 'refund' && 
      tx.amount > 2 // Возвраты больше ожидаемого баланса
    );
    
    if (unexpectedRefunds.length > 0) {
      console.log(`   ⚠️ НАЙДЕНЫ ПОДОЗРИТЕЛЬНЫЕ КРУПНЫЕ ВОЗВРАТЫ:`);
      unexpectedRefunds.forEach((tx, index) => {
        const date = tx.createdAt.toLocaleString('ru-RU');
        console.log(`      ${index + 1}. ${date}: ${tx.amount} CES - ${tx.reason}`);
      });
    }
    
    // 7. РЕКОМЕНДАЦИИ ПО ВОССТАНОВЛЕНИЮ
    console.log(`\n💡 РЕКОМЕНДАЦИИ ПО ВОССТАНОВЛЕНИЮ:`);
    
    const currentDbBalance = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
    const expectedBalance = 2.0; // Ожидаемый баланс
    const missingAmount = expectedBalance - realBalance;
    
    console.log(`   📊 Анализ баланса:`);
    console.log(`      - Ожидалось: ${expectedBalance} CES`);
    console.log(`      - Фактически в блокчейне: ${realBalance.toFixed(4)} CES`);
    console.log(`      - В базе данных: ${currentDbBalance.toFixed(4)} CES`);
    console.log(`      - ПРОПАЛО: ${missingAmount.toFixed(4)} CES`);
    
    if (missingAmount > 0.001) {
      console.log(`\n   🔧 ТРЕБУЕТСЯ ВОССТАНОВЛЕНИЕ ${missingAmount.toFixed(4)} CES`);
      console.log(`   Варианты решения:`);
      console.log(`   1. Проверить блокчейн транзакции через Polygon scan`);
      console.log(`   2. Восстановить баланс административно`);
      console.log(`   3. Проверить смарт-контракт эскроу на застрявшие токены`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при расследовании:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Отключение от базы данных');
  }
}

// Запуск скрипта
if (require.main === module) {
  investigateMissingTokens().catch(console.error);
}

module.exports = { investigateMissingTokens };