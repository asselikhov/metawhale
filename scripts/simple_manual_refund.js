/**
 * Простой Мануальный Возврат Эскроу
 * Простой скрипт для возврата 1.1 CES из эскроу ID 7
 */

// Загружаем переменные окружения
require('dotenv').config();

const { ethers } = require('ethers');

// Жестко заданные значения для срочного случая
const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
const ESCROW_ID = 7;
const EXPECTED_AMOUNT = 1.1;

// Получаем переменные окружения
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '0x04B16d50949CD92de90fbadcF49745897CbED5C4';

// ABI для escrow контракта
const ESCROW_ABI = [
  "function refundEscrow(uint256 escrowId) external",
  "function adminRefundEscrow(uint256 escrowId) external", 
  "function getEscrowDetails(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)",
  "function owner() external view returns (address)"
];

async function simpleManualRefund() {
  try {
    console.log('🚀 ПРОСТОЙ МАНУАЛЬНЫЙ ВОЗВРАТ ЭСКРОУ');
    console.log('===================================');
    
    // Проверяем наличие всех переменных
    console.log('🔍 Проверка конфигурации...');
    console.log(`   RPC URL: ${POLYGON_RPC_URL}`);
    console.log(`   Contract: ${ESCROW_CONTRACT_ADDRESS}`);
    console.log(`   Admin Key: ${ADMIN_PRIVATE_KEY ? 'Найден' : 'НЕ НАЙДЕН'}`);
    
    if (!ADMIN_PRIVATE_KEY) {
      console.log('\n❌ ОШИБКА: ADMIN_PRIVATE_KEY не найден в переменных окружения');
      console.log('💡 РЕШЕНИЕ:');
      console.log('1. Установите переменную окружения ADMIN_PRIVATE_KEY');
      console.log('2. Или укажите приватный ключ админа в переменных окружения');
      console.log('3. Убедитесь, что .env файл содержит ADMIN_PRIVATE_KEY=ваш_приватный_ключ');
      return;
    }
    
    // Подключаемся к сети
    const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
    const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    console.log(`\n🔑 Админский кошелек: ${adminWallet.address}`);
    
    // Проверяем баланс MATIC
    const balance = await provider.getBalance(adminWallet.address);
    console.log(`💰 Баланс MATIC: ${ethers.utils.formatEther(balance)}`);
    
    if (balance.lt(ethers.utils.parseEther('0.01'))) {
      console.log('⚠️ ВНИМАНИЕ: Низкий баланс MATIC для газа!');
    }
    
    // Создаем контракт
    const contract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, adminWallet);
    
    // Проверяем детали эскроу
    console.log(`\n🔍 Проверка эскроу ID ${ESCROW_ID}...`);
    try {
      const escrowDetails = await contract.getEscrowDetails(ESCROW_ID);
      
      const seller = escrowDetails[0];
      const buyer = escrowDetails[1]; 
      const amount = ethers.utils.formatEther(escrowDetails[2]);
      const timelock = escrowDetails[3].toString();
      const status = escrowDetails[4];
      
      console.log(`   Продавец: ${seller}`);
      console.log(`   Покупатель: ${buyer}`);
      console.log(`   Сумма: ${amount} CES`);
      console.log(`   Статус: ${status} (${status === 0 ? 'Активен' : 'Неактивен'})`);
      
      // Проверяем, что адрес совпадает
      if (seller.toLowerCase() !== TARGET_WALLET.toLowerCase()) {
        throw new Error(`Неверный адрес продавца: ${seller}, ожидался: ${TARGET_WALLET}`);
      }
      
      // Проверяем сумму
      if (Math.abs(parseFloat(amount) - EXPECTED_AMOUNT) > 0.0001) {
        throw new Error(`Неверная сумма: ${amount} CES, ожидалось: ${EXPECTED_AMOUNT} CES`);
      }
      
      // Проверяем статус
      if (status !== 0) {
        throw new Error(`Эскроу неактивен (статус: ${status})`);
      }
      
      console.log('✅ Эскроу проверен успешно');
      
    } catch (detailsError) {
      console.log(`❌ Ошибка проверки эскроу: ${detailsError.message}`);
      return;
    }
    
    // Получаем цены газа
    console.log('\n⛽ Получение цен газа...');
    const gasPrice = await provider.getGasPrice();
    const highGasPrice = gasPrice.mul(3); // В 3 раза выше для быстрого подтверждения
    
    console.log(`   Базовая цена: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    console.log(`   Повышенная цена: ${ethers.utils.formatUnits(highGasPrice, 'gwei')} Gwei`);
    
    // Пробуем обычный возврат сначала
    console.log(`\n🚀 Попытка обычного возврата эскроу...`);
    
    try {
      const tx = await contract.refundEscrow(ESCROW_ID, {
        gasLimit: 300000,
        gasPrice: highGasPrice
      });
      
      console.log(`📋 Транзакция отправлена: ${tx.hash}`);
      console.log('⏳ Ожидание подтверждения...');
      
      const receipt = await tx.wait(2); // Ждем 2 подтверждения
      
      if (receipt.status === 1) {
        console.log(`✅ УСПЕХ! Возврат выполнен`);
        console.log(`   Блок: ${receipt.blockNumber}`);
        console.log(`   Gas использовано: ${receipt.gasUsed.toString()}`);
        
        // Проверяем новый баланс
        const walletService = require('../src/services/walletService');
        const newBalance = await walletService.getCESBalance(TARGET_WALLET);
        console.log(`💰 Новый баланс пользователя: ${newBalance} CES`);
        
      } else {
        console.log(`❌ Транзакция провалилась`);
      }
      
    } catch (refundError) {
      console.log(`❌ Обычный возврат не удался: ${refundError.message}`);
      
      // Пробуем админский возврат
      console.log(`\n🔧 Попытка админского возврата...`);
      
      try {
        const adminTx = await contract.adminRefundEscrow(ESCROW_ID, {
          gasLimit: 300000,
          gasPrice: highGasPrice
        });
        
        console.log(`📋 Админская транзакция: ${adminTx.hash}`);
        console.log('⏳ Ожидание подтверждения...');
        
        const adminReceipt = await adminTx.wait(2);
        
        if (adminReceipt.status === 1) {
          console.log(`✅ УСПЕХ! Админский возврат выполнен`);
          console.log(`   Блок: ${adminReceipt.blockNumber}`);
          console.log(`   Gas использовано: ${adminReceipt.gasUsed.toString()}`);
          
          // Проверяем новый баланс
          const walletService = require('../src/services/walletService');
          const newBalance = await walletService.getCESBalance(TARGET_WALLET);
          console.log(`💰 Новый баланс пользователя: ${newBalance} CES`);
          
        } else {
          console.log(`❌ Админская транзакция провалилась`);
        }
        
      } catch (adminError) {
        console.log(`❌ Админский возврат не удался: ${adminError.message}`);
        
        console.log('\n🛠️ РЕКОМЕНДАЦИИ:');
        console.log('1. Проверьте права админа в смартконтракте');
        console.log('2. Убедитесь, что приватный ключ корректен');
        console.log('3. Попробуйте использовать MetaMask для ручного выполнения');
        console.log('4. Обратитесь к разработчику смартконтракта');
      }
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

// Запуск
if (require.main === module) {
  simpleManualRefund()
    .then(() => {
      console.log('\n🎉 Скрипт завершен');
    })
    .catch((error) => {
      console.error('\n💥 Скрипт провалился:', error.message);
    });
}

module.exports = { simpleManualRefund };