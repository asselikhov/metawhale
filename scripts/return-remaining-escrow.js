/**
 * Return Remaining Escrow Script
 * Возврат оставшихся 1.3 CES с эскроу счета пользователя 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, EscrowTransaction } = require('../src/database/models');
const escrowService = require('../src/services/escrowService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function returnRemainingEscrow() {
  try {
    console.log('💰 ВОЗВРАТ ОСТАВШИХСЯ СРЕДСТВ С ЭСКРОУ');
    console.log('=====================================');
    console.log(`🎯 Кошелек: ${TARGET_WALLET}`);
    console.log('');
    
    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    // Поиск пользователя
    const user = await User.findOne({ walletAddress: TARGET_WALLET });
    if (!user) {
      console.log('❌ Пользователь не найден для указанного кошелька');
      return;
    }
    
    console.log(`\n👤 ПОЛЬЗОВАТЕЛЬ: ${user.firstName} (${user.chatId})`);
    
    // Проверка текущих балансов
    console.log(`\n📊 ТЕКУЩИЕ БАЛАНСЫ:`);
    console.log(`   - Доступный баланс CES: ${user.cesBalance || 0} CES`);
    console.log(`   - Заблокировано в эскроу: ${user.escrowCESBalance || 0} CES`);
    console.log(`   - Общий баланс в БД: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)} CES`);
    
    const escrowAmount = user.escrowCESBalance || 0;
    
    if (escrowAmount <= 0.001) {
      console.log(`\n✅ Нет средств для возврата с эскроу (баланс: ${escrowAmount} CES)`);
      return;
    }
    
    console.log(`\n💰 НАЙДЕНО СРЕДСТВ ДЛЯ ВОЗВРАТА: ${escrowAmount.toFixed(4)} CES`);
    
    // Проверяем последние эскроу транзакции
    console.log(`\n📋 ПОСЛЕДНИЕ ЭСКРОУ ТРАНЗАКЦИИ:`);
    const recentEscrowTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES'
    }).sort({ createdAt: -1 }).limit(5);
    
    recentEscrowTxs.forEach((tx, index) => {
      const date = tx.createdAt.toLocaleString('ru-RU');
      console.log(`   ${index + 1}. ${date} | ${tx.type.toUpperCase()}: ${tx.amount} CES (${tx.status})`);
      console.log(`      Причина: ${tx.reason || 'Не указано'}`);
    });
    
    console.log(`\n🔄 ВЫПОЛНЯЮ ВОЗВРАТ СРЕДСТВ С ЭСКРОУ...`);
    
    try {
      // Возвращаем средства с эскроу напрямую через сервис
      await escrowService.refundTokensFromEscrow(
        user._id,
        null, // Нет связанной сделки
        'CES',
        escrowAmount,
        'Административный возврат оставшихся средств с эскроу - ручное вмешательство'
      );
      
      console.log(`✅ УСПЕШНО ВОЗВРАЩЕНО: ${escrowAmount.toFixed(4)} CES`);
      
      // Проверяем обновленные балансы
      const updatedUser = await User.findById(user._id);
      console.log(`\n💰 ОБНОВЛЕННЫЕ БАЛАНСЫ:`);
      console.log(`   - Доступный баланс CES: ${updatedUser.cesBalance || 0} CES`);
      console.log(`   - Заблокировано в эскроу: ${updatedUser.escrowCESBalance || 0} CES`);
      console.log(`   - Общий баланс в БД: ${(updatedUser.cesBalance || 0) + (updatedUser.escrowCESBalance || 0)} CES`);
      
      console.log(`\n🎉 ОПЕРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!`);
      console.log(`💰 Пользователю возвращено с эскроу: ${escrowAmount.toFixed(4)} CES`);
      
    } catch (refundError) {
      console.error(`❌ Ошибка при возврате средств: ${refundError.message}`);
      
      // Попробуем альтернативный способ - прямое обновление балансов
      console.log(`\n🔄 ПРОБУЮ АЛЬТЕРНАТИВНЫЙ СПОСОБ - ПРЯМОЕ ОБНОВЛЕНИЕ БАЛАНСОВ...`);
      
      try {
        const oldAvailable = user.cesBalance || 0;
        const oldEscrow = user.escrowCESBalance || 0;
        
        // Переносим средства из эскроу в доступные
        user.cesBalance = oldAvailable + oldEscrow;
        user.escrowCESBalance = 0;
        user.lastBalanceUpdate = new Date();
        
        await user.save();
        
        // Создаем запись о возврате
        const refundTx = new EscrowTransaction({
          userId: user._id,
          tradeId: null,
          type: 'refund',
          tokenType: 'CES',
          amount: oldEscrow,
          status: 'completed',
          reason: 'Прямой административный возврат оставшихся средств с эскроу',
          completedAt: new Date()
        });
        
        await refundTx.save();
        
        console.log(`✅ АЛЬТЕРНАТИВНЫЙ СПОСОБ УСПЕШЕН!`);
        console.log(`   - Доступный баланс: ${oldAvailable.toFixed(4)} → ${user.cesBalance.toFixed(4)} CES`);
        console.log(`   - Эскроу баланс: ${oldEscrow.toFixed(4)} → ${user.escrowCESBalance} CES`);
        console.log(`   - Создана запись о возврате: ${refundTx._id}`);
        
      } catch (directError) {
        console.error(`❌ Альтернативный способ также не сработал: ${directError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Отключение от базы данных');
  }
}

// Запуск скрипта
if (require.main === module) {
  returnRemainingEscrow().catch(console.error);
}

module.exports = { returnRemainingEscrow };