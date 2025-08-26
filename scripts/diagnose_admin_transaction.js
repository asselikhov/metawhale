/**
 * Диагностика Админской Транзакции
 * Анализирует проблему с зависшей транзакцией возврата эскроу
 */

const { ethers } = require('ethers');
const config = require('../src/config/configuration');

const providers = ethers.providers || ethers;

// Хеши транзакций, которые были отправлены
const TX_HASHES = [
  '0xdcfc4de833143ca54bf9fa853e483f15d14560ee0cb6a2c66d43e002014622d9', // Первая попытка
  '0x4014b398f4c878c11f2917053bcfdd2dc22a7f9a593a71c4fa96a9513be0e5ad'  // Вторая попытка
];

const ADMIN_WALLET = '0x98A569b1ee0C4fc19eA802318d9033Dd056C850b';
const CONTRACT_ADDRESS = '0x04B16d50949CD92de90fbadcF49745897CbED5C4';

async function diagnoseAdminTransaction() {
  try {
    const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    console.log('🔍 ДИАГНОСТИКА АДМИНСКОЙ ТРАНЗАКЦИИ');
    console.log('=====================================');
    
    // Проверяем статус сети
    console.log('🌐 Проверка состояния сети...');
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    console.log(`   Сеть: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Текущий блок: ${blockNumber}`);
    
    // Проверяем баланс админского кошелька
    console.log('\n💰 Проверка баланса админского кошелька...');
    const adminBalance = await provider.getBalance(ADMIN_WALLET);
    console.log(`   Баланс MATIC: ${ethers.utils.formatEther(adminBalance)}`);
    
    if (adminBalance.lt(ethers.utils.parseEther('0.01'))) {
      console.log('   ⚠️ ВНИМАНИЕ: Низкий баланс MATIC для оплаты газа!');
    }
    
    // Проверяем каждую транзакцию
    console.log('\n📋 Анализ отправленных транзакций...');
    
    for (let i = 0; i < TX_HASHES.length; i++) {
      const txHash = TX_HASHES[i];
      console.log(`\n${i + 1}. Транзакция: ${txHash}`);
      
      try {
        const tx = await provider.getTransaction(txHash);
        
        if (!tx) {
          console.log('   ❌ Транзакция не найдена в сети');
          continue;
        }
        
        console.log(`   📤 От: ${tx.from}`);
        console.log(`   📥 К: ${tx.to}`);
        console.log(`   ⛽ Gas Limit: ${tx.gasLimit?.toString()}`);
        console.log(`   💰 Gas Price: ${ethers.utils.formatUnits(tx.gasPrice || 0, 'gwei')} Gwei`);
        console.log(`   📦 Блок: ${tx.blockNumber || 'Pending'}`);
        console.log(`   🔢 Nonce: ${tx.nonce}`);
        
        if (tx.blockNumber) {
          // Транзакция подтверждена
          const receipt = await provider.getTransactionReceipt(txHash);
          console.log(`   ✅ Статус: ${receipt.status === 1 ? 'Успешно' : 'Неудачно'}`);
          console.log(`   ⛽ Gas Used: ${receipt.gasUsed?.toString()}`);
          
          if (receipt.status === 1) {
            console.log('   🎉 ТРАНЗАКЦИЯ ПРОШЛА УСПЕШНО!');
          } else {
            console.log('   ❌ ТРАНЗАКЦИЯ ПРОВАЛИЛАСЬ');
          }
        } else {
          // Транзакция в ожидании
          console.log('   ⏳ Транзакция в ожидании подтверждения...');
          
          // Проверяем, не слишком ли низкая цена газа
          const currentGasPrice = await provider.getGasPrice();
          console.log(`   💰 Текущая цена газа в сети: ${ethers.utils.formatUnits(currentGasPrice, 'gwei')} Gwei`);
          
          if (tx.gasPrice && currentGasPrice.gt(tx.gasPrice.mul(2))) {
            console.log('   ⚠️ ПРОБЛЕМА: Цена газа слишком низкая!');
          }
        }
        
      } catch (txError) {
        console.log(`   ❌ Ошибка проверки: ${txError.message}`);
      }
    }
    
    // Проверяем nonce админского кошелька
    console.log('\n🔢 Проверка nonce админского кошелька...');
    const currentNonce = await provider.getTransactionCount(ADMIN_WALLET, 'latest');
    const pendingNonce = await provider.getTransactionCount(ADMIN_WALLET, 'pending');
    
    console.log(`   Текущий nonce: ${currentNonce}`);
    console.log(`   Pending nonce: ${pendingNonce}`);
    
    if (pendingNonce > currentNonce) {
      console.log(`   ⚠️ ${pendingNonce - currentNonce} транзакций в ожидании`);
    }
    
    // Проверяем текущие цены газа
    console.log('\n⛽ Текущие цены газа...');
    const gasPrice = await provider.getGasPrice();
    const feeData = await provider.getFeeData();
    
    console.log(`   Базовая цена газа: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    if (feeData.maxFeePerGas) {
      console.log(`   Max Fee Per Gas: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} Gwei`);
    }
    if (feeData.maxPriorityFeePerGas) {
      console.log(`   Max Priority Fee: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} Gwei`);
    }
    
    console.log('\n🎯 РЕКОМЕНДАЦИИ:');
    console.log('=====================================');
    
    // Проверяем статус эскроу
    const smartContractService = require('../src/services/smartContractService');
    try {
      const escrowDetails = await smartContractService.getEscrowDetails(7);
      console.log('🔒 Статус эскроу ID 7:');
      console.log(`   Статус: ${escrowDetails.status === 0 ? 'Активен' : 'Неактивен'}`);
      console.log(`   Сумма: ${escrowDetails.amount} CES`);
      
      if (escrowDetails.status === 0) {
        console.log('\n📋 Варианты действий:');
        console.log('1. 🔄 Отправить новую транзакцию с более высокой ценой газа');
        console.log('2. ⏳ Подождать подтверждения текущей транзакции');
        console.log('3. 🚫 Отменить застрявшую транзакцию (если возможно)');
        console.log('4. 🔧 Использовать внешний кошелек (MetaMask) для ручного выполнения');
      } else {
        console.log('✅ Эскроу уже освобожден! Проверьте баланс пользователя.');
      }
      
    } catch (escrowError) {
      console.log(`❌ Не удалось проверить статус эскроу: ${escrowError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
  }
}

// Запуск диагностики
if (require.main === module) {
  diagnoseAdminTransaction()
    .then(() => {
      console.log('\n🎉 Диагностика завершена');
    })
    .catch((error) => {
      console.error('\n💥 Диагностика провалилась:', error);
    });
}

module.exports = { diagnoseAdminTransaction };