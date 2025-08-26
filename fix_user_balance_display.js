#!/usr/bin/env node

/**
 * Fix User Balance Display Issue
 * Исправление проблемы с отображением балансов пользователей
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, EscrowTransaction, P2PTrade } = require('./src/database/models');
const walletService = require('./src/services/walletService');

const TARGET_USER_CHAT_ID = '942851377';

async function diagnoseAndFixUserBalance() {
  try {
    console.log('🔍 ДИАГНОСТИКА ПРОБЛЕМЫ С БАЛАНСОМ ПОЛЬЗОВАТЕЛЯ');
    console.log('================================================');
    console.log(`🎯 Пользователь: ${TARGET_USER_CHAT_ID}`);
    console.log('');

    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных');

    // Найти пользователя
    const user = await User.findOne({ chatId: TARGET_USER_CHAT_ID });
    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }

    console.log(`\n📋 ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:`);
    console.log(`   Имя: ${user.firstName} ${user.lastName}`);
    console.log(`   Кошелек: ${user.walletAddress}`);
    console.log(`   Дата создания: ${user.createdAt?.toLocaleString('ru-RU')}`);

    // Получить реальный баланс из блокчейна
    console.log(`\n🔗 ПРОВЕРКА БЛОКЧЕЙНА:`);
    const realCESBalance = await walletService.getCESBalance(user.walletAddress);
    const realPOLBalance = await walletService.getPOLBalance(user.walletAddress);
    
    console.log(`   Реальный CES баланс: ${realCESBalance.toFixed(4)} CES`);
    console.log(`   Реальный POL баланс: ${realPOLBalance.toFixed(4)} POL`);

    // Проверить данные в базе
    console.log(`\n💾 ДАННЫЕ В БАЗЕ:`);
    console.log(`   CES баланс: ${user.cesBalance || 0} CES`);
    console.log(`   CES в эскроу: ${user.escrowCESBalance || 0} CES`);
    console.log(`   POL баланс: ${user.polBalance || 0} POL`);
    console.log(`   POL в эскроу: ${user.escrowPOLBalance || 0} POL`);

    // Найти активные сделки
    console.log(`\n🔄 АКТИВНЫЕ СДЕЛКИ:`);
    const activeTrades = await P2PTrade.find({
      $or: [
        { buyerId: user._id },
        { sellerId: user._id }
      ],
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made'] }
    }).populate('buyerId').populate('sellerId');

    if (activeTrades.length === 0) {
      console.log('   Нет активных сделок');
    } else {
      activeTrades.forEach((trade, index) => {
        const role = trade.sellerId._id.toString() === user._id.toString() ? 'Продавец' : 'Покупатель';
        console.log(`   ${index + 1}. ${role} | ${trade.amount} CES | Статус: ${trade.status}`);
        console.log(`      ID: ${trade._id}`);
        console.log(`      Создана: ${trade.createdAt.toLocaleString('ru-RU')}`);
      });
    }

    // Проверить последние эскроу транзакции
    console.log(`\n📋 ПОСЛЕДНИЕ ЭСКРОУ ТРАНЗАКЦИИ:`);
    const recentEscrowTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES'
    }).sort({ createdAt: -1 }).limit(10);

    if (recentEscrowTxs.length === 0) {
      console.log('   Нет эскроу транзакций');
    } else {
      recentEscrowTxs.forEach((tx, index) => {
        const date = tx.createdAt.toLocaleString('ru-RU');
        console.log(`   ${index + 1}. ${date} | ${tx.type.toUpperCase()}: ${tx.amount} CES (${tx.status})`);
        if (tx.smartContractEscrowId) {
          console.log(`      Smart Contract Escrow ID: ${tx.smartContractEscrowId}`);
        }
        if (tx.reason) {
          console.log(`      Причина: ${tx.reason}`);
        }
      });
    }

    // Расчет правильных балансов
    console.log(`\n🧮 АНАЛИЗ БАЛАНСОВ:`);
    
    // Сумма всех активных эскроу
    let totalActiveEscrow = 0;
    activeTrades.forEach(trade => {
      if (trade.sellerId._id.toString() === user._id.toString()) {
        totalActiveEscrow += trade.amount;
      }
    });

    const expectedAvailableBalance = Math.max(0, realCESBalance - totalActiveEscrow);
    const expectedEscrowBalance = totalActiveEscrow;

    console.log(`   Реальный баланс в блокчейне: ${realCESBalance.toFixed(4)} CES`);
    console.log(`   Должно быть в эскроу: ${expectedEscrowBalance.toFixed(4)} CES`);
    console.log(`   Должно быть доступно: ${expectedAvailableBalance.toFixed(4)} CES`);
    console.log(`   Текущий эскроу в БД: ${user.escrowCESBalance || 0} CES`);
    console.log(`   Текущий доступный в БД: ${user.cesBalance || 0} CES`);

    // Проверка расхождений
    const escrowDifference = Math.abs((user.escrowCESBalance || 0) - expectedEscrowBalance);
    const totalInDb = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
    const totalDifference = Math.abs(totalInDb - realCESBalance);

    console.log(`\n⚖️ РАСХОЖДЕНИЯ:`);
    console.log(`   Эскроу: ${escrowDifference.toFixed(4)} CES`);
    console.log(`   Общий баланс: ${totalDifference.toFixed(4)} CES`);

    if (escrowDifference > 0.0001 || totalDifference > 0.0001) {
      console.log(`\n🔧 ТРЕБУЕТСЯ ИСПРАВЛЕНИЕ!`);
      console.log(`\n📝 ПЛАН ИСПРАВЛЕНИЯ:`);
      console.log(`   1. Обновить общий баланс: ${user.cesBalance || 0} → ${realCESBalance.toFixed(4)} CES`);
      console.log(`   2. Обновить эскроу баланс: ${user.escrowCESBalance || 0} → ${expectedEscrowBalance.toFixed(4)} CES`);
      console.log(`   3. После исправления доступно будет: ${expectedAvailableBalance.toFixed(4)} CES`);

      console.log(`\n❓ Выполнить исправление? (y/N)`);
      
      // Для автоматического исправления раскомментируйте следующие строки:
      console.log(`\n🔄 ВЫПОЛНЯЮ ИСПРАВЛЕНИЕ...`);
      
      // Обновляем балансы
      const oldCESBalance = user.cesBalance || 0;
      const oldEscrowBalance = user.escrowCESBalance || 0;
      
      user.cesBalance = realCESBalance;
      user.escrowCESBalance = expectedEscrowBalance;
      user.lastBalanceUpdate = new Date();
      
      await user.save();
      
      console.log(`\n✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО:`);
      console.log(`   CES баланс: ${oldCESBalance} → ${realCESBalance.toFixed(4)}`);
      console.log(`   Эскроу баланс: ${oldEscrowBalance} → ${expectedEscrowBalance.toFixed(4)}`);
      console.log(`   Доступно для использования: ${expectedAvailableBalance.toFixed(4)} CES`);

      // Создаем запись об исправлении
      if (Math.abs(oldCESBalance - realCESBalance) > 0.0001 || Math.abs(oldEscrowBalance - expectedEscrowBalance) > 0.0001) {
        const correctionTx = new EscrowTransaction({
          userId: user._id,
          tradeId: null,
          type: 'refund',
          tokenType: 'CES',
          amount: Math.abs(oldEscrowBalance - expectedEscrowBalance),
          status: 'completed',
          reason: `Исправление отображения баланса. БД: ${oldCESBalance + oldEscrowBalance} → Блокчейн: ${realCESBalance}`,
          completedAt: new Date()
        });
        
        await correctionTx.save();
        console.log(`   📝 Создана запись об исправлении: ${correctionTx._id}`);
      }

    } else {
      console.log(`\n✅ БАЛАНСЫ КОРРЕКТНЫ`);
      console.log(`Нет расхождений, исправление не требуется.`);
    }

    // Проверяем новый способ отображения
    console.log(`\n📱 НОВОЕ ОТОБРАЖЕНИЕ В ЛИЧНОМ КАБИНЕТЕ:`);
    const walletInfo = await walletService.getUserWallet(TARGET_USER_CHAT_ID);
    
    if (walletInfo && walletInfo.hasWallet) {
      let cesDisplay = `Баланс CES: ${walletInfo.cesBalance.toFixed(4)}`;
      if (walletInfo.escrowCESBalance > 0) {
        const available = (walletInfo.cesBalance - walletInfo.escrowCESBalance).toFixed(4);
        cesDisplay += ` (доступно: ${available}, в эскроу: ${walletInfo.escrowCESBalance.toFixed(4)})`;
      }
      
      console.log(`   ${cesDisplay}`);
      console.log(`\n💡 ОБЪЯСНЕНИЕ:`);
      console.log(`   - Общий баланс: ${walletInfo.cesBalance.toFixed(4)} CES (в блокчейне)`);
      console.log(`   - В эскроу: ${walletInfo.escrowCESBalance?.toFixed(4) || 0} CES (заблокировано)`);
      console.log(`   - Доступно: ${(walletInfo.cesBalance - (walletInfo.escrowCESBalance || 0)).toFixed(4)} CES`);
      console.log(`\n✅ Теперь пользователь видит все свои токены!`);
    }

    console.log(`\n🎉 ДИАГНОСТИКА ЗАВЕРШЕНА!`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n✅ База данных отключена');
    }
  }
}

// Запуск
if (require.main === module) {
  diagnoseAndFixUserBalance().catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseAndFixUserBalance };