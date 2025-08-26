/**
 * Cancel Stuck Trades Script
 * Принудительная отмена застрявших сделок для пользователя с кошельком 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade, EscrowTransaction } = require('../src/database/models');
const escrowService = require('../src/services/escrowService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function cancelStuckTrades() {
  try {
    console.log('🔧 ПРИНУДИТЕЛЬНАЯ ОТМЕНА ЗАСТРЯВШИХ СДЕЛОК');
    console.log('==========================================');
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
    
    console.log(`\n👤 ПОЛЬЗОВАТЕЛЬ: ${user.firstName} (${user.chatId})`);
    
    // Поиск всех активных сделок где пользователь - продавец
    const stuckTrades = await P2PTrade.find({
      sellerId: user._id,
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made'] }
    }).populate('buyerId', 'chatId firstName lastName');
    
    console.log(`\n🔍 НАЙДЕНО ЗАСТРЯВШИХ СДЕЛОК: ${stuckTrades.length}`);
    
    if (stuckTrades.length === 0) {
      console.log('✅ Нет сделок для отмены');
      return;
    }
    
    // Показываем детали каждой сделки
    console.log(`\n📋 ДЕТАЛИ СДЕЛОК:`);
    let totalAmountToReturn = 0;
    
    stuckTrades.forEach((trade, index) => {
      const buyer = trade.buyerId;
      const buyerName = buyer ? `${buyer.firstName || 'Неизвестно'} (${buyer.chatId})` : 'Покупатель не найден';
      
      console.log(`   ${index + 1}. Сделка ${trade._id}:`);
      console.log(`      - Количество: ${trade.amount} CES`);
      console.log(`      - Цена: ${trade.pricePerToken} ₽ за CES`);
      console.log(`      - Общая сумма: ${trade.totalValue} ₽`);
      console.log(`      - Статус: ${trade.status}`);
      console.log(`      - Покупатель: ${buyerName}`);
      console.log(`      - Создана: ${trade.timeTracking?.createdAt?.toLocaleString('ru-RU') || 'Неизвестно'}`);
      console.log('');
      
      totalAmountToReturn += trade.amount;
    });
    
    console.log(`💰 ОБЩАЯ СУММА К ВОЗВРАТУ: ${totalAmountToReturn.toFixed(4)} CES`);
    
    // Проверяем текущие балансы пользователя
    console.log(`\n📊 ТЕКУЩИЕ БАЛАНСЫ ПОЛЬЗОВАТЕЛЯ:`);
    console.log(`   - Доступный баланс: ${user.cesBalance || 0} CES`);
    console.log(`   - Заблокировано в эскроу: ${user.escrowCESBalance || 0} CES`);
    
    console.log(`\n⚠️ ВНИМАНИЕ: Эта операция отменит все указанные сделки и вернет токены пользователю.`);
    console.log(`🔄 Выполняю отмену всех застрявших сделок...`);
    
    // Отменяем каждую сделку
    let successfulCancellations = 0;
    let totalReturned = 0;
    
    for (let i = 0; i < stuckTrades.length; i++) {
      const trade = stuckTrades[i];
      
      try {
        console.log(`\n🔄 Отменяю сделку ${i + 1}/${stuckTrades.length}: ${trade._id}`);
        
        // Возвращаем токены из эскроу
        await escrowService.refundTokensFromEscrow(
          user._id,
          trade._id,
          'CES',
          trade.amount,
          'Принудительная отмена застрявшей сделки - административное вмешательство'
        );
        
        // Обновляем статус сделки
        trade.status = 'cancelled';
        trade.escrowStatus = 'returned';
        trade.disputeReason = 'Принудительная отмена - административное вмешательство';
        trade.timeTracking.completedAt = new Date();
        
        await trade.save();
        
        console.log(`   ✅ Сделка ${trade._id} успешно отменена`);
        console.log(`   💰 Возвращено: ${trade.amount} CES`);
        
        successfulCancellations++;
        totalReturned += trade.amount;
        
        // Уведомляем покупателя (если возможно)
        if (trade.buyerId && trade.buyerId.chatId) {
          try {
            const botInstance = require('../src/bot/telegramBot');
            const bot = botInstance.getInstance();
            const notificationMessage = `❌ СДЕЛКА ОТМЕНЕНА\n\n` +
                                       `Сделка ${trade._id.toString().slice(-8)} была отменена администрацией.\n` +
                                       `Количество: ${trade.amount} CES\n` +
                                       `Сумма: ${trade.totalValue} ₽\n\n` +
                                       `Причина: Техническая проблема с эскроу.\n` +
                                       `Приносим извинения за неудобства.`;
            
            await bot.telegram.sendMessage(trade.buyerId.chatId, notificationMessage);
            console.log(`   📧 Уведомление отправлено покупателю ${trade.buyerId.chatId}`);
          } catch (notifyError) {
            console.log(`   ⚠️ Не удалось уведомить покупателя: ${notifyError.message}`);
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Ошибка при отмене сделки ${trade._id}:`, error.message);
      }
    }
    
    console.log(`\n✅ РЕЗУЛЬТАТЫ ОПЕРАЦИИ:`);
    console.log(`   - Успешно отменено сделок: ${successfulCancellations}/${stuckTrades.length}`);
    console.log(`   - Общая сумма возвращена: ${totalReturned.toFixed(4)} CES`);
    
    // Проверяем обновленные балансы
    const updatedUser = await User.findById(user._id);
    console.log(`\n💰 ОБНОВЛЕННЫЕ БАЛАНСЫ:`);
    console.log(`   - Доступный баланс: ${updatedUser.cesBalance || 0} CES`);
    console.log(`   - Заблокировано в эскроу: ${updatedUser.escrowCESBalance || 0} CES`);
    console.log(`   - Общий баланс в БД: ${(updatedUser.cesBalance || 0) + (updatedUser.escrowCESBalance || 0)} CES`);
    
    if (successfulCancellations === stuckTrades.length) {
      console.log(`\n🎉 ВСЕ СДЕЛКИ УСПЕШНО ОТМЕНЕНЫ!`);
      console.log(`💰 Пользователю возвращено: ${totalReturned.toFixed(4)} CES`);
    } else {
      console.log(`\n⚠️ ЧАСТИЧНЫЙ УСПЕХ: ${successfulCancellations}/${stuckTrades.length} сделок отменено`);
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
  cancelStuckTrades().catch(console.error);
}

module.exports = { cancelStuckTrades };