/**
 * Административный возврат застрявших токенов из смарт-контракта
 * Использует права owner для принудительного возврата эскроу
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, EscrowTransaction } = require('./src/database/models');
const { ethers } = require('ethers');

const TARGET_USER_CHAT_ID = '942851377';
const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

async function adminEscrowRefund() {
  try {
    console.log('🔧 АДМИНИСТРАТИВНЫЙ ВОЗВРАТ ЭСКРОУ');
    console.log('=================================');
    console.log(`🎯 Пользователь: ${TARGET_USER_CHAT_ID}`);
    console.log(`🎯 Кошелек: ${TARGET_WALLET}`);
    console.log(`🏛️ Контракт: ${ESCROW_CONTRACT_ADDRESS}`);
    console.log('');
    
    if (!ADMIN_PRIVATE_KEY) {
      console.log('❌ ADMIN_PRIVATE_KEY не установлен в .env');
      return;
    }
    
    if (!ESCROW_CONTRACT_ADDRESS) {
      console.log('❌ ESCROW_CONTRACT_ADDRESS не установлен в .env');
      return;
    }
    
    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных');
    
    // Найти пользователя
    const user = await User.findOne({ chatId: TARGET_USER_CHAT_ID });
    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }
    
    console.log(`\n📊 Статус пользователя:`);
    console.log(`   Баланс CES: ${user.cesBalance || 0} CES`);
    console.log(`   В эскроу: ${user.escrowCESBalance || 0} CES`);
    
    // Настройка провайдера и контракта
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    const escrowABI = [
      "function refundEscrow(uint256 escrowId) external",
      "function getEscrowDetails(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)",
      "function isEscrowExpired(uint256 escrowId) external view returns (bool)",
      "function owner() external view returns (address)"
    ];
    
    const escrowContract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, escrowABI, adminWallet);
    
    console.log(`\n🔍 Проверка прав администратора:`);
    const contractOwner = await escrowContract.owner();
    console.log(`   Owner контракта: ${contractOwner}`);
    console.log(`   Admin кошелек: ${adminWallet.address}`);
    
    if (contractOwner.toLowerCase() !== adminWallet.address.toLowerCase()) {
      console.log('❌ Admin кошелек не является владельцем контракта!');
      return;
    }
    console.log('✅ Admin права подтверждены');
    
    // Найти проблемные эскроу ID
    const lockTxs = await EscrowTransaction.find({
      userId: user._id,
      type: 'lock',
      tokenType: 'CES',
      smartContractEscrowId: { $exists: true, $ne: null },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 });
    
    console.log(`\n🔍 Найдено ${lockTxs.length} транзакций блокировки:`);
    
    for (const lockTx of lockTxs) {
      const escrowId = lockTx.smartContractEscrowId;
      console.log(`\n📋 Эскроу ID ${escrowId}:`);
      console.log(`   Сумма: ${lockTx.amount} CES`);
      console.log(`   Дата: ${lockTx.createdAt.toLocaleString('ru-RU')}`);
      
      try {
        // Проверить статус эскроу
        const [seller, buyer, amount, timelock, status] = await escrowContract.getEscrowDetails(escrowId);
        const isExpired = await escrowContract.isEscrowExpired(escrowId);
        
        const statusNames = ['Active', 'Released', 'Refunded', 'Disputed'];
        console.log(`   Статус: ${statusNames[status]} (${status})`);
        console.log(`   Продавец: ${seller}`);
        console.log(`   Истёк: ${isExpired ? 'Да' : 'Нет'}`);
        console.log(`   Timelock: ${new Date(timelock * 1000).toLocaleString('ru-RU')}`);
        
        if (status === 0) { // Active
          console.log(`   🔄 Выполняю административный возврат...`);
          
          const tx = await escrowContract.refundEscrow(escrowId, {
            gasLimit: 200000,
            gasPrice: ethers.utils.parseUnits('30', 'gwei')
          });
          
          console.log(`   📤 Транзакция отправлена: ${tx.hash}`);
          console.log(`   ⏳ Ожидание подтверждения...`);
          
          const receipt = await tx.wait();
          
          if (receipt.status === 1) {
            console.log(`   ✅ Возврат успешен! Блок: ${receipt.blockNumber}`);
            console.log(`   ⛽ Газ: ${receipt.gasUsed.toString()}`);
            
            // Обновить баланс пользователя
            user.escrowCESBalance -= lockTx.amount;
            user.cesBalance += lockTx.amount;
            await user.save();
            
            // Создать запись о возврате
            const refundTx = new EscrowTransaction({
              userId: user._id,
              tradeId: lockTx.tradeId,
              type: 'refund',
              tokenType: 'CES',
              amount: lockTx.amount,
              status: 'completed',
              txHash: tx.hash,
              smartContractEscrowId: escrowId,
              reason: 'Административный возврат через owner контракта',
              completedAt: new Date()
            });
            
            await refundTx.save();
            console.log(`   📝 Запись о возврате создана: ${refundTx._id}`);
            
          } else {
            console.log(`   ❌ Транзакция провалилась`);
          }
          
        } else if (status === 2) { // Already refunded
          console.log(`   ✅ Уже возвращён в смарт-контракте`);
          
          // Проверить есть ли запись в БД
          const refundTx = await EscrowTransaction.findOne({
            userId: user._id,
            tradeId: lockTx.tradeId,
            type: 'refund',
            smartContractEscrowId: escrowId
          });
          
          if (!refundTx) {
            console.log(`   📝 Создаю отсутствующую запись о возврате...`);
            
            const missingRefundTx = new EscrowTransaction({
              userId: user._id,
              tradeId: lockTx.tradeId,
              type: 'refund',
              tokenType: 'CES',
              amount: lockTx.amount,
              status: 'completed',
              smartContractEscrowId: escrowId,
              reason: 'Восстановление записи - токены уже возвращены в смарт-контракте',
              completedAt: new Date()
            });
            
            await missingRefundTx.save();
            console.log(`   ✅ Запись создана: ${missingRefundTx._id}`);
          }
          
        } else {
          console.log(`   ⚠️ Неожиданный статус: ${statusNames[status]}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Ошибка обработки эскроу ${escrowId}:`, error.message);
      }
    }
    
    // Проверить итоговый баланс
    await user.reload();
    console.log(`\n📊 ИТОГОВЫЙ БАЛАНС ПОЛЬЗОВАТЕЛЯ:`);
    console.log(`   CES баланс: ${user.cesBalance || 0} CES`);
    console.log(`   В эскроу: ${user.escrowCESBalance || 0} CES`);
    console.log(`   Общий: ${(user.cesBalance || 0) + (user.escrowCESBalance || 0)} CES`);
    
    console.log(`\n🎉 Административный возврат завершён!`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n✅ База данных отключена');
    }
  }
}

// Запуск если вызывается напрямую
if (require.main === module) {
  adminEscrowRefund().catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { adminEscrowRefund };