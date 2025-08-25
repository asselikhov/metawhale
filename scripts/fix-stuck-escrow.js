/**
 * Fix Stuck Escrow - Repair Database Balances
 * Исправляет баланс эскроу для кошелька с застрявшими токенами
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade, EscrowTransaction } = require('../src/database/models');
const walletService = require('../src/services/walletService');

const WALLET_ADDRESS = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function fixStuckEscrow() {
  try {
    console.log('🔧 ИСПРАВЛЕНИЕ ЗАСТРЯВШИХ ТОКЕНОВ В ЭСКРОУ');
    console.log('=========================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    // Find user by wallet address
    const user = await User.findOne({ walletAddress: WALLET_ADDRESS });
    if (!user) {
      console.log('❌ Пользователь не найден для кошелька:', WALLET_ADDRESS);
      return;
    }
    
    console.log(`\n👤 ПОЛЬЗОВАТЕЛЬ: ${user.firstName} (${user.chatId})`);
    
    // Get current real balance from blockchain
    const realCESBalance = await walletService.getCESBalance(user.walletAddress);
    console.log(`💰 Реальный баланс CES: ${realCESBalance.toFixed(4)} CES`);
    
    // Check active trades that should have escrow
    const activeTrades = await P2PTrade.find({
      sellerId: user._id, // User is seller, so their CES should be in escrow
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made', 'payment_confirmed'] }
    });
    
    let totalActiveEscrow = 0;
    console.log(`\n🤝 АКТИВНЫЕ СДЕЛКИ (где пользователь - продавец):`);
    if (activeTrades.length === 0) {
      console.log('   - Нет активных сделок');
    } else {
      activeTrades.forEach((trade, index) => {
        console.log(`   ${index + 1}. Сделка ${trade._id}:`);
        console.log(`      - Количество: ${trade.amount} CES`);
        console.log(`      - Статус: ${trade.status}`);
        console.log(`      - Создана: ${trade.timeTracking?.createdAt?.toLocaleString('ru-RU') || 'Неизвестно'}`);
        totalActiveEscrow += trade.amount;
      });
    }
    
    console.log(`\n📊 РАСЧЕТ ПРАВИЛЬНЫХ БАЛАНСОВ:`);
    console.log(`   - Реальный баланс в блокчейне: ${realCESBalance.toFixed(4)} CES`);
    console.log(`   - Должно быть в активном эскроу: ${totalActiveEscrow.toFixed(4)} CES`);
    console.log(`   - Должно быть доступно: ${(realCESBalance - totalActiveEscrow).toFixed(4)} CES`);
    
    const correctAvailableBalance = realCESBalance - totalActiveEscrow;
    const correctEscrowBalance = totalActiveEscrow;
    
    console.log(`\n🔍 ТЕКУЩЕЕ СОСТОЯНИЕ БД:`);
    console.log(`   - Доступный баланс: ${user.cesBalance || 0} CES`);
    console.log(`   - Эскроу баланс: ${user.escrowCESBalance || 0} CES`);
    console.log(`   - Общий в БД: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)} CES`);
    
    console.log(`\n✅ ПРАВИЛЬНЫЕ ЗНАЧЕНИЯ:`);
    console.log(`   - Доступный баланс: ${correctAvailableBalance.toFixed(4)} CES`);
    console.log(`   - Эскроу баланс: ${correctEscrowBalance.toFixed(4)} CES`);
    console.log(`   - Общий: ${realCESBalance.toFixed(4)} CES`);
    
    // Check if correction is needed
    const availableDiff = Math.abs((user.cesBalance || 0) - correctAvailableBalance);
    const escrowDiff = Math.abs((user.escrowCESBalance || 0) - correctEscrowBalance);
    
    if (availableDiff > 0.0001 || escrowDiff > 0.0001) {
      console.log(`\n⚠️ ТРЕБУЕТСЯ ИСПРАВЛЕНИЕ:`);
      console.log(`   - Изменение доступного баланса: ${((user.cesBalance || 0) - correctAvailableBalance).toFixed(4)} CES`);
      console.log(`   - Изменение эскроу баланса: ${((user.escrowCESBalance || 0) - correctEscrowBalance).toFixed(4)} CES`);
      
      // Ask for confirmation (in real script, you'd want manual confirmation)
      console.log(`\n🔧 ПРИМЕНЕНИЕ ИСПРАВЛЕНИЙ...`);
      
      // Store original values
      const originalCESBalance = user.cesBalance || 0;
      const originalEscrowBalance = user.escrowCESBalance || 0;
      
      // Update user balances
      user.cesBalance = correctAvailableBalance;
      user.escrowCESBalance = correctEscrowBalance;
      user.lastBalanceUpdate = new Date();
      
      await user.save();
      
      // Create corrective escrow transaction record
      const correctionTx = new EscrowTransaction({
        userId: user._id,
        tradeId: null,
        type: 'refund', // Mark as refund since we're reducing escrow
        tokenType: 'CES',
        amount: originalEscrowBalance - correctEscrowBalance,
        status: 'completed',
        reason: `Исправление застрявшего эскроу. Было: ${originalEscrowBalance} CES, стало: ${correctEscrowBalance} CES`,
        completedAt: new Date()
      });
      
      if (correctionTx.amount !== 0) {
        await correctionTx.save();
        console.log(`📝 Создана корректирующая транзакция: ${correctionTx._id}`);
      }
      
      console.log(`\n✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО:`);
      console.log(`   - Доступный баланс: ${originalCESBalance} → ${correctAvailableBalance.toFixed(4)} CES`);
      console.log(`   - Эскроу баланс: ${originalEscrowBalance} → ${correctEscrowBalance.toFixed(4)} CES`);
      console.log(`   - Общий баланс: ${(originalCESBalance + originalEscrowBalance).toFixed(4)} → ${realCESBalance.toFixed(4)} CES`);
      
      // Verify the fix
      const updatedUser = await User.findById(user._id);
      const newTotal = (updatedUser.cesBalance || 0) + (updatedUser.escrowCESBalance || 0);
      
      if (Math.abs(newTotal - realCESBalance) < 0.0001) {
        console.log(`\n🎉 ПРОВЕРКА ПРОЙДЕНА: Баланс БД теперь соответствует блокчейну!`);
      } else {
        console.log(`\n❌ ОШИБКА: Баланс БД (${newTotal.toFixed(4)}) не соответствует блокчейну (${realCESBalance.toFixed(4)})`);
      }
      
    } else {
      console.log(`\n✅ ИСПРАВЛЕНИЕ НЕ ТРЕБУЕТСЯ: Балансы корректны`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка исправления:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n💾 Соединение с базой данных закрыто');
  }
}

// Run fix
if (require.main === module) {
  fixStuckEscrow();
}

module.exports = { fixStuckEscrow };