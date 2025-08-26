/**
 * Release Expired Smart Contract Escrow Script
 * Освобождение истекших токенов из смарт-контракта эскроу для пользователя 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, EscrowTransaction } = require('../src/database/models');
const { ethers } = require('ethers');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const ESCROW_ID = 1; // ID найденного эскроу

async function releaseExpiredSmartEscrow() {
  try {
    console.log('🔓 ОСВОБОЖДЕНИЕ ИСТЕКШЕГО СМАРТ-КОНТРАКТ ЭСКРОУ');
    console.log('===============================================');
    console.log(`🎯 Кошелек: ${TARGET_WALLET}`);
    console.log(`🔢 Эскроу ID: ${ESCROW_ID}`);
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
    
    // Настройки смарт-контракта
    const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
    
    if (!escrowContractAddress || !cesTokenAddress) {
      console.log('❌ Адреса смарт-контрактов не настроены');
      return;
    }
    
    console.log(`\n🔧 НАСТРОЙКИ:`);
    console.log(`   - Эскроу контракт: ${escrowContractAddress}`);
    console.log(`   - CES токен: ${cesTokenAddress}`);
    
    // Подключение к блокчейну
    const config = require('../src/config/configuration');
    const provider = new ethers.providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    // Получаем приватный ключ пользователя
    const walletService = require('../src/services/walletService');
    let userPrivateKey;
    
    try {
      userPrivateKey = await walletService.getUserPrivateKey(user.chatId);
      if (!userPrivateKey) {
        throw new Error('Приватный ключ не найден');
      }
      console.log('✅ Приватный ключ пользователя получен');
    } catch (keyError) {
      console.error(`❌ Ошибка получения приватного ключа: ${keyError.message}`);
      return;
    }
    
    // Создаем wallet для подписи транзакций
    const userWallet = new ethers.Wallet(userPrivateKey, provider);
    
    console.log(`\n🔗 ПОДКЛЮЧЕНИЕ К СМАРТ-КОНТРАКТУ:`);
    
    // ABI эскроу контракта
    const escrowAbi = [
      "function getEscrowDetails(uint256 escrowId) external view returns (address seller, address buyer, uint256 amount, uint256 timelock, uint8 status)",
      "function refundEscrow(uint256 escrowId) external"
    ];
    
    // ABI CES токена для проверки баланса
    const erc20Abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    
    const escrowContract = new ethers.Contract(escrowContractAddress, escrowAbi, userWallet);
    const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);
    
    try {
      // Проверяем детали эскроу
      console.log(`🔍 Проверяем эскроу #${ESCROW_ID}...`);
      const escrowDetails = await escrowContract.getEscrowDetails(ESCROW_ID);
      const [seller, buyer, amount, timelock, status] = escrowDetails;
      
      const decimals = await cesContract.decimals();
      const formattedAmount = ethers.utils.formatUnits(amount, decimals);
      const statusNames = ['Active', 'Released', 'Refunded', 'Disputed'];
      const statusName = statusNames[status] || 'Unknown';
      
      console.log(`\n📋 ДЕТАЛИ ЭСКРОУ #${ESCROW_ID}:`);
      console.log(`   - Продавец: ${seller}`);
      console.log(`   - Покупатель: ${buyer}`);
      console.log(`   - Количество: ${formattedAmount} CES`);
      console.log(`   - Статус: ${statusName} (${status})`);
      console.log(`   - Timelock: ${new Date(timelock * 1000).toLocaleString('ru-RU')}`);
      console.log(`   - Истек: ${Date.now() > timelock * 1000 ? 'ДА' : 'НЕТ'}`);
      
      // Проверяем права пользователя
      if (seller.toLowerCase() !== user.walletAddress.toLowerCase()) {
        console.log(`❌ Пользователь не является продавцом в этом эскроу`);
        return;
      }
      
      if (status !== 0) { // Не Active
        console.log(`❌ Эскроу не в активном состоянии (статус: ${statusName})`);
        return;
      }
      
      // Проверяем баланс пользователя до операции
      const balanceBefore = await cesContract.balanceOf(user.walletAddress);
      const formattedBalanceBefore = ethers.utils.formatUnits(balanceBefore, decimals);
      
      console.log(`\n💰 БАЛАНС ДО ОПЕРАЦИИ: ${formattedBalanceBefore} CES`);
      
      // Выполняем возврат токенов
      console.log(`\n🔄 ВЫПОЛНЯЮ ВОЗВРАТ ТОКЕНОВ ИЗ ЭСКРОУ...`);
      
      const tx = await escrowContract.refundEscrow(ESCROW_ID, {
        gasLimit: 150000,
        gasPrice: ethers.utils.parseUnits('30', 'gwei')
      });
      
      console.log(`📤 Транзакция отправлена: ${tx.hash}`);
      console.log(`⏳ Ожидаем подтверждения...`);
      
      const receipt = await tx.wait();
      
      console.log(`✅ Транзакция подтверждена в блоке: ${receipt.blockNumber}`);
      console.log(`⛽ Использовано газа: ${receipt.gasUsed.toString()}`);
      
      // Проверяем баланс после операции
      const balanceAfter = await cesContract.balanceOf(user.walletAddress);
      const formattedBalanceAfter = ethers.utils.formatUnits(balanceAfter, decimals);
      const difference = parseFloat(formattedBalanceAfter) - parseFloat(formattedBalanceBefore);
      
      console.log(`\n💰 РЕЗУЛЬТАТ ОПЕРАЦИИ:`);
      console.log(`   - Баланс до: ${formattedBalanceBefore} CES`);
      console.log(`   - Баланс после: ${formattedBalanceAfter} CES`);
      console.log(`   - Возвращено: ${difference.toFixed(4)} CES`);
      
      if (difference > 0) {
        console.log(`\n🎉 УСПЕХ! Токены успешно возвращены из смарт-контракта!`);
        
        // Обновляем запись в базе данных
        try {
          const refundTx = new EscrowTransaction({
            userId: user._id,
            tradeId: null,
            type: 'refund',
            tokenType: 'CES',
            amount: difference,
            status: 'completed',
            txHash: tx.hash,
            smartContractEscrowId: ESCROW_ID.toString(),
            reason: `Возврат из истекшего смарт-контракт эскроу #${ESCROW_ID}`,
            completedAt: new Date()
          });
          
          await refundTx.save();
          console.log(`📝 Создана запись в БД: ${refundTx._id}`);
          
          // Обновляем баланс пользователя в БД
          const updatedUser = await User.findById(user._id);
          updatedUser.cesBalance = parseFloat(formattedBalanceAfter);
          updatedUser.lastBalanceUpdate = new Date();
          await updatedUser.save();
          
          console.log(`📊 Обновлен баланс в БД: ${updatedUser.cesBalance} CES`);
          
        } catch (dbError) {
          console.log(`⚠️ Ошибка обновления БД (токены все равно возвращены): ${dbError.message}`);
        }
        
      } else {
        console.log(`❌ Токены не были возвращены. Проверьте статус эскроу.`);
      }
      
    } catch (contractError) {
      console.error(`❌ Ошибка при работе с смарт-контрактом: ${contractError.message}`);
      
      if (contractError.message.includes('EscrowNotExpired')) {
        console.log(`💡 Эскроу еще не истек. Попробуйте позже.`);
      } else if (contractError.message.includes('UnauthorizedAccess')) {
        console.log(`💡 Нет прав на выполнение операции.`);
      } else if (contractError.message.includes('InvalidEscrowStatus')) {
        console.log(`💡 Эскроу не в подходящем состоянии.`);
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
  releaseExpiredSmartEscrow().catch(console.error);
}

module.exports = { releaseExpiredSmartEscrow };