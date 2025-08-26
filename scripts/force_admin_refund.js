/**
 * Форсированный Админский Возврат Эскроу
 * Отправляет транзакцию с правильной ценой газа для возврата 1.1 CES
 */

const { ethers } = require('ethers');
const config = require('../src/config/configuration');
const { User, connectDatabase, disconnectDatabase } = require('../src/database/models');

const providers = ethers.providers || ethers;

const TARGET_USER_ID = 942851377;
const ESCROW_ID = 7;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = '0x04B16d50949CD92de90fbadcF49745897CbED5C4';

// ABI для функции adminRefundEscrow
const CONTRACT_ABI = [
  "function adminRefundEscrow(uint256 escrowId) external"
];

async function forceAdminRefund() {
  try {
    console.log('🚀 ФОРСИРОВАННЫЙ АДМИНСКИЙ ВОЗВРАТ ЭСКРОУ');
    console.log('=========================================');
    
    await connectDatabase();
    
    // Находим пользователя
    const user = await User.findOne({ chatId: TARGET_USER_ID });
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Проверяем наличие приватного ключа
    if (!ADMIN_PRIVATE_KEY) {
      throw new Error('ADMIN_PRIVATE_KEY не найден в переменных окружения');
    }
    
    console.log(`👤 Пользователь: ${user.username || user.firstName} (${user.chatId})`);
    console.log(`💳 Кошелек: ${user.walletAddress}`);
    
    // Подключаемся к сети
    const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    console.log(`🔑 Админский кошелек: ${adminWallet.address}`);
    
    // Проверяем баланс админа
    const adminBalance = await provider.getBalance(adminWallet.address);
    console.log(`💰 Баланс MATIC админа: ${ethers.utils.formatEther(adminBalance)}`);
    
    if (adminBalance.lt(ethers.utils.parseEther('0.01'))) {
      throw new Error('Недостаточно MATIC для оплаты газа!');
    }
    
    // Создаем контракт
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, adminWallet);
    
    // Получаем текущие цены газа
    console.log('\n⛽ Получение цен газа...');
    const feeData = await provider.getFeeData();
    const gasPrice = await provider.getGasPrice();
    
    console.log(`   Базовая цена газа: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    console.log(`   Max Fee Per Gas: ${ethers.utils.formatUnits(feeData.maxFeePerGas || gasPrice, 'gwei')} Gwei`);
    console.log(`   Max Priority Fee: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas || 0, 'gwei')} Gwei`);
    
    // Устанавливаем агрессивные параметры газа для быстрого подтверждения
    const maxFeePerGas = gasPrice.mul(3); // В 3 раза выше текущей цены
    const maxPriorityFeePerGas = ethers.utils.parseUnits('2', 'gwei'); // 2 Gwei приоритет
    const gasLimit = 300000; // Увеличенный лимит газа
    
    console.log('\n🔧 Параметры транзакции:');
    console.log(`   Gas Limit: ${gasLimit}`);
    console.log(`   Gas Price: ${ethers.utils.formatUnits(maxFeePerGas, 'gwei')} Gwei`);
    
    // Проверяем nonce
    const nonce = await provider.getTransactionCount(adminWallet.address, 'latest');
    console.log(`   Nonce: ${nonce}`);
    
    console.log(`\n🚀 Отправка транзакции возврата эскроу ${ESCROW_ID}...`);
    console.log(`⚠️ Это освободит 1.1 CES для ${user.walletAddress}`);
    
    const txOptions = {
      gasLimit: gasLimit,
      gasPrice: maxFeePerGas,
      nonce: nonce
    };
    
    // Отправляем транзакцию
    const tx = await contract.adminRefundEscrow(ESCROW_ID, txOptions);
    
    console.log(`\n📋 Транзакция отправлена:`);
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Gas Limit: ${tx.gasLimit?.toString()}`);
    console.log(`   Nonce: ${tx.nonce}`);
    
    console.log(`\n⏳ Ожидание подтверждения... (может занять до 2 минут)`);
    
    // Ждем подтверждения с таймаутом
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут ожидания транзакции')), 120000)
      )
    ]);
    
    if (receipt.status === 1) {
      console.log(`\n🎉 ТРАНЗАКЦИЯ УСПЕШНО ПОДТВЕРЖДЕНА!`);
      console.log(`   Блок: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed?.toString()}`);
      console.log(`   Effective Gas Price: ${ethers.utils.formatUnits(receipt.effectiveGasPrice || 0, 'gwei')} Gwei`);
      
      // Проверяем новый баланс пользователя
      console.log(`\n💰 Проверка баланса пользователя...`);
      const walletService = require('../src/services/walletService');
      const newBalance = await walletService.getCESBalance(user.walletAddress);
      console.log(`   Новый баланс: ${newBalance} CES`);
      
      if (newBalance >= 2.0) {
        console.log(`   ✅ УСПЕХ: Возврат завершен! Баланс увеличен до ${newBalance} CES`);
      } else {
        console.log(`   ⚠️ ВНИМАНИЕ: Баланс ${newBalance} CES, ожидалось ~2.0 CES`);
      }
      
    } else {
      console.log(`\n❌ ТРАНЗАКЦИЯ ПРОВАЛИЛАСЬ`);
      console.log(`   Статус: ${receipt.status}`);
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка форсированного возврата:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 РЕШЕНИЕ: Пополните MATIC на админском кошельке');
    } else if (error.message.includes('nonce')) {
      console.log('\n💡 РЕШЕНИЕ: Проблема с nonce, попробуйте еще раз');
    } else if (error.message.includes('gas')) {
      console.log('\n💡 РЕШЕНИЕ: Проблема с газом, увеличьте лимит или цену');
    }
    
    throw error;
  } finally {
    await disconnectDatabase();
    console.log('\n🔌 Соединение с базой закрыто');
  }
}

// Запуск форсированного возврата
if (require.main === module) {
  forceAdminRefund()
    .then(() => {
      console.log('\n🎉 Форсированный возврат завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Форсированный возврат провалился:', error.message);
      process.exit(1);
    });
}

module.exports = { forceAdminRefund };