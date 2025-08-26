/**
 * Manual Token Return Script
 * Ручной возврат CES токенов пользователю с кошельком 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade, P2POrder, EscrowTransaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');
const escrowService = require('../src/services/escrowService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function manualTokenReturn() {
  try {
    console.log('🔧 РУЧНОЙ ВОЗВРАТ CES ТОКЕНОВ');
    console.log('================================');
    console.log(`🎯 Кошелек: ${TARGET_WALLET}`);
    console.log('');
    
    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    // Поиск пользователя по адресу кошелька
    const user = await User.findOne({ walletAddress: TARGET_WALLET });
    if (!user) {
      console.log('❌ Пользователь не найден для указанного кошелька');
      return;
    }
    
    console.log(`\n👤 ПОЛЬЗОВАТЕЛЬ:`);
    console.log(`   - Chat ID: ${user.chatId}`);
    console.log(`   - Имя: ${user.firstName || 'Не указано'} ${user.lastName || ''}`);
    console.log(`   - Username: ${user.username || 'Не указано'}`);
    console.log(`   - Кошелек: ${user.walletAddress}`);
    
    // Проверка текущих балансов
    console.log(`\n💰 ТЕКУЩИЕ БАЛАНСЫ:`);
    const realCESBalance = await walletService.getCESBalance(user.walletAddress);
    console.log(`   - Реальный баланс CES (блокчейн): ${realCESBalance.toFixed(4)} CES`);
    console.log(`   - Доступный баланс CES в БД: ${user.cesBalance || 0} CES`);
    console.log(`   - Заблокировано в эскроу: ${user.escrowCESBalance || 0} CES`);
    console.log(`   - Общий в БД: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)} CES`);
    
    const balanceDiscrepancy = realCESBalance - ((user.cesBalance || 0) + (user.escrowCESBalance || 0));
    console.log(`   - Расхождение: ${balanceDiscrepancy.toFixed(4)} CES`);
    
    // Проверка активных ордеров и сделок
    console.log(`\n🔍 АНАЛИЗ АКТИВНЫХ ОПЕРАЦИЙ:`);
    
    // Активные ордера на продажу
    const activeSellOrders = await P2POrder.find({
      userId: user._id,
      type: 'sell',
      status: { $in: ['active', 'partial'] },
      escrowLocked: true,
      escrowAmount: { $gt: 0 }
    });
    
    console.log(`   - Активных ордеров на продажу с заблокированным эскроу: ${activeSellOrders.length}`);
    let totalOrderEscrow = 0;
    activeSellOrders.forEach((order, index) => {
      console.log(`     ${index + 1}. Ордер ${order._id}: ${order.escrowAmount} CES заблокировано`);
      totalOrderEscrow += order.escrowAmount;
    });
    
    // Активные сделки где пользователь - продавец
    const activeTrades = await P2PTrade.find({
      sellerId: user._id,
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made', 'payment_confirmed'] }
    });
    
    console.log(`   - Активных сделок (пользователь - продавец): ${activeTrades.length}`);
    let totalTradeEscrow = 0;
    activeTrades.forEach((trade, index) => {
      console.log(`     ${index + 1}. Сделка ${trade._id}: ${trade.amount} CES (статус: ${trade.status})`);
      totalTradeEscrow += trade.amount;
    });
    
    // Проверка истории эскроу транзакций
    console.log(`\n📋 ИСТОРИЯ ЭСКРОУ ТРАНЗАКЦИЙ (последние 10):`);
    const escrowHistory = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES'
    }).sort({ createdAt: -1 }).limit(10);
    
    let totalLocked = 0;
    let totalReleased = 0;
    let totalRefunded = 0;
    
    escrowHistory.forEach((tx, index) => {
      const date = tx.createdAt.toLocaleString('ru-RU');
      console.log(`     ${index + 1}. ${tx.type.toUpperCase()}: ${tx.amount} CES (${tx.status}) - ${date}`);
      console.log(`        Причина: ${tx.reason || 'Не указано'}`);
      
      if (tx.type === 'lock' && tx.status === 'completed') {
        totalLocked += tx.amount;
      } else if (tx.type === 'release' && tx.status === 'completed') {
        totalReleased += tx.amount;
      } else if (tx.type === 'refund' && tx.status === 'completed') {
        totalRefunded += tx.amount;
      }
    });
    
    console.log(`\n📊 СВОДКА ПО ЭСКРОУ ТРАНЗАКЦИЯМ:`);
    console.log(`   - Заблокировано (lock): ${totalLocked.toFixed(4)} CES`);
    console.log(`   - Освобождено (release): ${totalReleased.toFixed(4)} CES`);
    console.log(`   - Возвращено (refund): ${totalRefunded.toFixed(4)} CES`);
    console.log(`   - Баланс эскроу транзакций: ${(totalLocked - totalReleased - totalRefunded).toFixed(4)} CES`);
    
    // Расчет правильных балансов
    const expectedEscrowBalance = totalOrderEscrow + totalTradeEscrow;
    const expectedAvailableBalance = Math.max(0, realCESBalance - expectedEscrowBalance);
    
    console.log(`\n🧮 РАСЧЕТ ПРАВИЛЬНЫХ БАЛАНСОВ:`);
    console.log(`   - Реальный баланс в блокчейне: ${realCESBalance.toFixed(4)} CES`);
    console.log(`   - Требуется в эскроу (ордера + сделки): ${expectedEscrowBalance.toFixed(4)} CES`);
    console.log(`   - Должно быть доступно: ${expectedAvailableBalance.toFixed(4)} CES`);
    console.log(`   - Текущий эскроу в БД: ${user.escrowCESBalance || 0} CES`);
    console.log(`   - Текущий доступный в БД: ${user.cesBalance || 0} CES`);
    
    // Проверка необходимости исправления
    const escrowDifference = (user.escrowCESBalance || 0) - expectedEscrowBalance;
    const availableDifference = (user.cesBalance || 0) - expectedAvailableBalance;
    
    console.log(`\n⚖️ АНАЛИЗ РАСХОЖДЕНИЙ:`);
    console.log(`   - Избыток в эскроу: ${escrowDifference.toFixed(4)} CES`);
    console.log(`   - Недостаток в доступном: ${(-availableDifference).toFixed(4)} CES`);
    
    if (Math.abs(escrowDifference) > 0.0001 || Math.abs(availableDifference) > 0.0001) {
      console.log(`\n🔧 ТРЕБУЕТСЯ ИСПРАВЛЕНИЕ БАЛАНСОВ!`);
      console.log(`\n❓ Выполнить автоматическое исправление? (y/N)`);
      
      // Для автоматического исправления раскомментируйте следующие строки:
      // console.log(`\n🔄 ВЫПОЛНЯЮ АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ...`);
      // await fixUserBalances(user, expectedAvailableBalance, expectedEscrowBalance);
      
      console.log(`\n⚠️ ВНИМАНИЕ: Автоматическое исправление отключено для безопасности.`);
      console.log(`Раскомментируйте соответствующие строки в скрипте для выполнения исправления.`);
      
    } else {
      console.log(`\n✅ Балансы корректны, исправление не требуется.`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Отключение от базы данных');
  }
}

// Функция для исправления балансов пользователя
async function fixUserBalances(user, correctAvailableBalance, correctEscrowBalance) {
  try {
    console.log(`\n🔧 ИСПРАВЛЕНИЕ БАЛАНСОВ ДЛЯ ПОЛЬЗОВАТЕЛЯ ${user.chatId}:`);
    
    const oldAvailable = user.cesBalance || 0;
    const oldEscrow = user.escrowCESBalance || 0;
    
    // Обновляем балансы
    user.cesBalance = correctAvailableBalance;
    user.escrowCESBalance = correctEscrowBalance;
    user.lastBalanceUpdate = new Date();
    
    await user.save();
    
    console.log(`   - Доступный баланс: ${oldAvailable.toFixed(4)} → ${correctAvailableBalance.toFixed(4)} CES`);
    console.log(`   - Эскроу баланс: ${oldEscrow.toFixed(4)} → ${correctEscrowBalance.toFixed(4)} CES`);
    
    // Создаем запись о корректировке
    const correctionTx = new EscrowTransaction({
      userId: user._id,
      tradeId: null,
      type: 'refund',
      tokenType: 'CES',
      amount: correctAvailableBalance - oldAvailable,
      status: 'completed',
      reason: `Ручная корректировка баланса: возврат ${(correctAvailableBalance - oldAvailable).toFixed(4)} CES из застрявшего эскроу`,
      completedAt: new Date()
    });
    
    if (Math.abs(correctionTx.amount) > 0.0001) {
      await correctionTx.save();
      console.log(`   - Создана запись о корректировке: ${correctionTx.amount.toFixed(4)} CES`);
    }
    
    console.log(`✅ Балансы успешно исправлены!`);
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении балансов:', error);
    throw error;
  }
}

// Запуск скрипта
if (require.main === module) {
  manualTokenReturn().catch(console.error);
}

module.exports = { manualTokenReturn, fixUserBalances };