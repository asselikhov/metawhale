/**
 * Check Smart Contract Escrow Script
 * Проверка смарт-контракта эскроу на застрявшие токены для пользователя 0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, EscrowTransaction } = require('../src/database/models');
const { ethers } = require('ethers');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function checkSmartContractEscrow() {
  try {
    console.log('🔍 ПРОВЕРКА СМАРТ-КОНТРАКТА ЭСКРОУ');
    console.log('==================================');
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
    
    // Проверяем настройки смарт-контракта
    const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
    const useSmartContract = process.env.USE_SMART_CONTRACT_ESCROW === 'true';
    
    console.log(`\n🔧 НАСТРОЙКИ СМАРТ-КОНТРАКТА:`);
    console.log(`   - Использование смарт-контракта: ${useSmartContract ? 'ДА' : 'НЕТ'}`);
    console.log(`   - Адрес эскроу контракта: ${escrowContractAddress || 'НЕ НАСТРОЕН'}`);
    console.log(`   - Адрес CES токена: ${cesTokenAddress || 'НЕ НАСТРОЕН'}`);
    
    if (!useSmartContract || !escrowContractAddress || !cesTokenAddress) {
      console.log(`\n⚠️ Смарт-контракт эскроу не настроен или отключен`);
      console.log(`Проверяем только базу данных...`);
      
      // Показываем детальную информацию о балансах в БД
      console.log(`\n📊 ДЕТАЛЬНАЯ ИНФОРМАЦИЯ О БАЛАНСАХ:`);
      console.log(`   - cesBalance: ${user.cesBalance || 0}`);
      console.log(`   - escrowCESBalance: ${user.escrowCESBalance || 0}`);
      console.log(`   - Точное значение escrowCESBalance: ${user.escrowCESBalance}`);
      
      return;
    }
    
    // Подключение к блокчейну
    const config = require('../src/config/configuration');
    const provider = new ethers.providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    console.log(`\n🔗 ПОДКЛЮЧЕНИЕ К БЛОКЧЕЙНУ:`);
    console.log(`   - RPC URL: ${config.wallet.polygonRpcUrl}`);
    
    // ABI для проверки эскроу контракта
    const escrowAbi = [
      "function getEscrowDetails(uint256 escrowId) external view returns (address seller, address buyer, uint256 amount, uint256 timelock, uint8 status)",
      "function nextEscrowId() external view returns (uint256)"
    ];
    
    // ABI для проверки CES токена
    const erc20Abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    
    try {
      const escrowContract = new ethers.Contract(escrowContractAddress, escrowAbi, provider);
      const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);
      
      // Проверяем баланс CES токенов на эскроу контракте
      console.log(`\n💰 БАЛАНСЫ СМАРТ-КОНТРАКТА:`);
      
      const escrowContractBalance = await cesContract.balanceOf(escrowContractAddress);
      const decimals = await cesContract.decimals();
      const formattedBalance = ethers.utils.formatUnits(escrowContractBalance, decimals);
      
      console.log(`   - CES баланс эскроу контракта: ${formattedBalance} CES`);
      
      // Проверяем allowance пользователя для эскроу контракта
      const userAllowance = await cesContract.allowance(user.walletAddress, escrowContractAddress);
      const formattedAllowance = ethers.utils.formatUnits(userAllowance, decimals);
      
      console.log(`   - Разрешение пользователя эскроу контракту: ${formattedAllowance} CES`);
      
      // Проверяем баланс пользователя
      const userBalance = await cesContract.balanceOf(user.walletAddress);
      const formattedUserBalance = ethers.utils.formatUnits(userBalance, decimals);
      
      console.log(`   - CES баланс пользователя: ${formattedUserBalance} CES`);
      
      // Пытаемся получить информацию о последних эскроу
      try {
        const nextEscrowId = await escrowContract.nextEscrowId();
        console.log(`\n🔢 ИНФОРМАЦИЯ ОБ ЭСКРОУ:`);
        console.log(`   - Следующий ID эскроу: ${nextEscrowId.toString()}`);
        
        // Проверяем последние несколько эскроу
        const lastEscrowsToCheck = Math.min(10, parseInt(nextEscrowId.toString()));
        console.log(`   - Проверяем последние ${lastEscrowsToCheck} эскроу...`);
        
        for (let i = Math.max(1, nextEscrowId - lastEscrowsToCheck); i < nextEscrowId; i++) {
          try {
            const escrowDetails = await escrowContract.getEscrowDetails(i);
            const [seller, buyer, amount, timelock, status] = escrowDetails;
            
            if (seller.toLowerCase() === user.walletAddress.toLowerCase() || 
                buyer.toLowerCase() === user.walletAddress.toLowerCase()) {
              
              const formattedAmount = ethers.utils.formatUnits(amount, decimals);
              const statusNames = ['Active', 'Released', 'Refunded', 'Disputed'];
              const statusName = statusNames[status] || 'Unknown';
              const role = seller.toLowerCase() === user.walletAddress.toLowerCase() ? 'Продавец' : 'Покупатель';
              
              console.log(`\n   📋 НАЙДЕНО ЭСКРОУ #${i}:`);
              console.log(`      - Роль пользователя: ${role}`);
              console.log(`      - Количество: ${formattedAmount} CES`);
              console.log(`      - Статус: ${statusName} (${status})`);
              console.log(`      - Продавец: ${seller}`);
              console.log(`      - Покупатель: ${buyer}`);
              console.log(`      - Timelock: ${new Date(timelock * 1000).toLocaleString('ru-RU')}`);
              
              if (status === 0 && parseFloat(formattedAmount) > 0) { // Active status
                console.log(`      ⚠️ АКТИВНОЕ ЭСКРОУ С ТОКЕНАМИ!`);
              }
            }
          } catch (escrowError) {
            // Эскроу не существует или ошибка чтения - пропускаем
          }
        }
        
      } catch (escrowInfoError) {
        console.log(`   ⚠️ Не удалось получить информацию об эскроу: ${escrowInfoError.message}`);
      }
      
    } catch (contractError) {
      console.error(`❌ Ошибка при работе с смарт-контрактом: ${contractError.message}`);
    }
    
    // Проверяем записи в базе данных о смарт-контракт эскроу
    console.log(`\n📋 ЗАПИСИ О СМАРТ-КОНТРАКТ ЭСКРОУ В БД:`);
    const smartContractEscrowTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES',
      smartContractEscrowId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });
    
    if (smartContractEscrowTxs.length === 0) {
      console.log(`   - Нет записей о смарт-контракт эскроу`);
    } else {
      smartContractEscrowTxs.forEach((tx, index) => {
        const date = tx.createdAt.toLocaleString('ru-RU');
        console.log(`   ${index + 1}. ${date} | ${tx.type.toUpperCase()}: ${tx.amount} CES`);
        console.log(`      Смарт-контракт эскроу ID: ${tx.smartContractEscrowId}`);
        console.log(`      Статус: ${tx.status}`);
        console.log(`      Причина: ${tx.reason || 'Не указано'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке смарт-контракта:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Отключение от базы данных');
  }
}

// Запуск скрипта
if (require.main === module) {
  checkSmartContractEscrow().catch(console.error);
}

module.exports = { checkSmartContractEscrow };