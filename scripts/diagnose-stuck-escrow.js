/**
 * Diagnose Stuck Escrow - CES Tokens Investigation
 * Проверяет баланс эскроу и историю транзакций для кошелька с пропавшими 2 CES
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2POrder, P2PTrade, EscrowTransaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const WALLET_ADDRESS = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function diagnoseStuckEscrow() {
  try {
    console.log('🔍 ДИАГНОСТИКА ЗАСТРЯВШИХ ТОКЕНОВ В ЭСКРОУ');
    console.log('======================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    // Find user by wallet address
    const user = await User.findOne({ walletAddress: WALLET_ADDRESS });
    if (!user) {
      console.log('❌ Пользователь не найден для кошелька:', WALLET_ADDRESS);
      return;
    }
    
    console.log(`\n👤 ПОЛЬЗОВАТЕЛЬ:`);
    console.log(`   - Chat ID: ${user.chatId}`);
    console.log(`   - Имя: ${user.firstName || 'Не указано'}`);
    console.log(`   - Username: ${user.username || 'Не указано'}`);
    console.log(`   - Кошелек: ${user.walletAddress}`);
    
    // Check real blockchain balance
    console.log(`\n💰 БАЛАНСЫ:`);
    const realCESBalance = await walletService.getCESBalance(user.walletAddress);
    console.log(`   - Реальный баланс CES (блокчейн): ${realCESBalance.toFixed(4)} CES`);
    console.log(`   - Баланс CES в БД: ${user.cesBalance || 0} CES`);
    console.log(`   - Эскроу CES в БД: ${user.escrowCESBalance || 0} CES`);
    console.log(`   - Общий в БД: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)} CES`);
    
    const difference = realCESBalance - ((user.cesBalance || 0) + (user.escrowCESBalance || 0));
    console.log(`   - Разница (блокчейн - БД): ${difference.toFixed(4)} CES`);
    
    if (Math.abs(difference) > 0.0001) {
      console.log(`   ⚠️ ОБНАРУЖЕНО РАСХОЖДЕНИЕ: ${difference.toFixed(4)} CES`);
    }
    
    // Check active orders
    console.log(`\n📋 АКТИВНЫЕ ОРДЕРА:`);
    const activeOrders = await P2POrder.find({
      userId: user._id,
      status: { $in: ['active', 'partial'] }
    });
    
    if (activeOrders.length === 0) {
      console.log('   - Нет активных ордеров');
    } else {
      activeOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ${order.type.toUpperCase()} ордер:`);
        console.log(`      - ID: ${order._id}`);
        console.log(`      - Количество: ${order.amount} CES`);
        console.log(`      - Статус: ${order.status}`);
        console.log(`      - Заблокировано в эскроу: ${order.escrowLocked ? 'Да' : 'Нет'}`);
        console.log(`      - Количество в эскроу: ${order.escrowAmount || 0} CES`);
        console.log(`      - Создан: ${order.createdAt.toLocaleString('ru-RU')}`);
      });
    }
    
    // Check cancelled orders with potential stuck escrow
    console.log(`\n❌ ОТМЕНЕННЫЕ ОРДЕРА (последние 10):`);
    const cancelledOrders = await P2POrder.find({
      userId: user._id,
      status: 'cancelled'
    }).sort({ createdAt: -1 }).limit(10);
    
    if (cancelledOrders.length === 0) {
      console.log('   - Нет отмененных ордеров');
    } else {
      for (const order of cancelledOrders) {
        console.log(`   • ${order.type.toUpperCase()} ордер:`);
        console.log(`     - ID: ${order._id}`);
        console.log(`     - Количество: ${order.amount} CES`);
        console.log(`     - Заблокировано в эскроу: ${order.escrowLocked ? 'Да' : 'Нет'}`);
        console.log(`     - Количество в эскроу: ${order.escrowAmount || 0} CES`);
        console.log(`     - Отменен: ${order.updatedAt.toLocaleString('ru-RU')}`);
        
        // Check if escrow was properly released for this order
        if (order.escrowLocked && order.escrowAmount > 0) {
          const escrowRefund = await EscrowTransaction.findOne({
            userId: user._id,
            type: 'refund',
            amount: order.escrowAmount,
            createdAt: { $gte: order.updatedAt }
          });
          
          if (!escrowRefund) {
            console.log(`     ⚠️ ПРОБЛЕМА: Эскроу не был возвращен для этого ордера!`);
            console.log(`     💰 Застряло: ${order.escrowAmount} CES`);
          } else {
            console.log(`     ✅ Эскроу возвращен: ${escrowRefund.createdAt.toLocaleString('ru-RU')}`);
          }
        }
      }
    }
    
    // Check active trades
    console.log(`\n🤝 АКТИВНЫЕ СДЕЛКИ:`);
    const activeTrades = await P2PTrade.find({
      $or: [
        { buyerId: user._id },
        { sellerId: user._id }
      ],
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made', 'payment_confirmed'] }
    }).populate('buyerId sellerId');
    
    if (activeTrades.length === 0) {
      console.log('   - Нет активных сделок');
    } else {
      activeTrades.forEach((trade, index) => {
        const userRole = trade.buyerId._id.toString() === user._id.toString() ? 'Покупатель' : 'Продавец';
        console.log(`   ${index + 1}. Сделка (${userRole}):`);
        console.log(`      - ID: ${trade._id}`);
        console.log(`      - Количество: ${trade.amount} CES`);
        console.log(`      - Статус: ${trade.status}`);
        console.log(`      - Эскроу: ${trade.escrowStatus}`);
        console.log(`      - Создана: ${trade.timeTracking?.createdAt?.toLocaleString('ru-RU') || trade.createdAt.toLocaleString('ru-RU')}`);
      });
    }
    
    // Check escrow transaction history
    console.log(`\n📊 ИСТОРИЯ ТРАНЗАКЦИЙ ЭСКРОУ (последние 20):`);
    const escrowTransactions = await EscrowTransaction.find({
      userId: user._id
    }).sort({ createdAt: -1 }).limit(20);
    
    if (escrowTransactions.length === 0) {
      console.log('   - Нет транзакций эскроу');
    } else {
      let totalLocked = 0;
      let totalReleased = 0;
      let totalRefunded = 0;
      
      escrowTransactions.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.type.toUpperCase()}:`);
        console.log(`      - Количество: ${tx.amount} ${tx.tokenType}`);
        console.log(`      - Статус: ${tx.status}`);
        console.log(`      - Сделка: ${tx.tradeId || 'Не указано'}`);
        console.log(`      - Причина: ${tx.reason || 'Не указано'}`);
        console.log(`      - Дата: ${tx.createdAt.toLocaleString('ru-RU')}`);
        
        if (tx.tokenType === 'CES' && tx.status === 'completed') {
          switch (tx.type) {
            case 'lock':
              totalLocked += tx.amount;
              break;
            case 'release':
              totalReleased += tx.amount;
              break;
            case 'refund':
              totalRefunded += tx.amount;
              break;
          }
        }
      });
      
      console.log(`\n📈 ИТОГОВАЯ СТАТИСТИКА ЭСКРОУ CES:`);
      console.log(`   - Заблокировано: ${totalLocked.toFixed(4)} CES`);
      console.log(`   - Освобождено: ${totalReleased.toFixed(4)} CES`);
      console.log(`   - Возвращено: ${totalRefunded.toFixed(4)} CES`);
      const netLocked = totalLocked - totalReleased - totalRefunded;
      console.log(`   - Чистый заблокированный остаток: ${netLocked.toFixed(4)} CES`);
      
      if (Math.abs(netLocked - (user.escrowCESBalance || 0)) > 0.0001) {
        console.log(`   ⚠️ РАСХОЖДЕНИЕ: БД показывает ${user.escrowCESBalance || 0} CES, расчет показывает ${netLocked.toFixed(4)} CES`);
      }
    }
    
    // Summary and recommendations
    console.log(`\n🎯 ЗАКЛЮЧЕНИЕ:`);
    if (Math.abs(difference) > 0.0001) {
      console.log(`❌ Обнаружена проблема: ${Math.abs(difference).toFixed(4)} CES застряли в системе`);
      
      if (difference > 0) {
        console.log(`💡 Рекомендация: Увеличить баланс пользователя на ${difference.toFixed(4)} CES`);
        console.log(`   - Возможная причина: отмененные ордера без освобождения эскроу`);
      } else {
        console.log(`💡 Рекомендация: Уменьшить баланс пользователя на ${Math.abs(difference).toFixed(4)} CES`);
        console.log(`   - Возможная причина: двойное начисление или ошибка БД`);
      }
    } else {
      console.log(`✅ Балансы корректны, проблем не обнаружено`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n💾 Соединение с базой данных закрыто');
  }
}

// Run diagnostics
if (require.main === module) {
  diagnoseStuckEscrow();
}

module.exports = { diagnoseStuckEscrow };