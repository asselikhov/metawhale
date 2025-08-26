/**
 * Balance Issue Diagnostic Script
 * Tests wallet balance checking functionality to identify the root cause
 */

const mongoose = require('mongoose');
const { ethers } = require('ethers');
const config = require('../src/config/configuration');
const { User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

// Ensure ethers providers are available
const providers = ethers.providers || ethers;
const utils = ethers.utils || ethers;

async function runDiagnostics() {
  console.log('🔍 ДИАГНОСТИКА ПРОБЛЕМЫ С БАЛАНСАМИ');
  console.log('=' .repeat(50));
  
  try {
    // 1. Check database connection
    console.log('\n1️⃣ Проверка подключения к базе данных...');
    await mongoose.connect(config.database.mongoUri, config.database.options);
    console.log('✅ База данных подключена');
    
    // 2. Check configuration
    console.log('\n2️⃣ Проверка конфигурации...');
    console.log(`   - Polygon RPC URL: ${config.wallet.polygonRpcUrl}`);
    console.log(`   - CES Contract Address: ${config.wallet.cesContractAddress}`);
    console.log(`   - Encryption Key present: ${config.wallet.encryptionKey ? 'Yes' : 'No'}`);
    
    // 3. Test RPC connection
    console.log('\n3️⃣ Проверка подключения к Polygon RPC...');
    try {
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ RPC работает, последний блок: ${blockNumber}`);
    } catch (rpcError) {
      console.log(`❌ Ошибка RPC: ${rpcError.message}`);
      
      // Try alternative RPC endpoints
      const alternativeRPCs = [
        'https://rpc.ankr.com/polygon',
        'https://polygon-rpc.com/',
        'https://rpc-mainnet.matic.network',
        'https://matic-mainnet.chainstacklabs.com'
      ];
      
      console.log('\n🔄 Тестирование альтернативных RPC...');
      for (const rpcUrl of alternativeRPCs) {
        try {
          const testProvider = new providers.JsonRpcProvider(rpcUrl);
          const testBlock = await testProvider.getBlockNumber();
          console.log(`✅ ${rpcUrl} - блок: ${testBlock}`);
        } catch (altError) {
          console.log(`❌ ${rpcUrl} - ошибка: ${altError.message}`);
        }
      }
    }
    
    // 4. Test CES contract
    console.log('\n4️⃣ Проверка контракта CES...');
    try {
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function name() view returns (string)",
        "function symbol() view returns (string)"
      ];
      
      const contract = new ethers.Contract(
        config.wallet.cesContractAddress,
        erc20Abi,
        provider
      );
      
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ]);
      
      console.log(`✅ Контракт CES найден:`);
      console.log(`   - Название: ${name}`);
      console.log(`   - Символ: ${symbol}`);
      console.log(`   - Десятичные знаки: ${decimals}`);
      
    } catch (contractError) {
      console.log(`❌ Ошибка контракта CES: ${contractError.message}`);
    }
    
    // 5. Check users with wallets
    console.log('\n5️⃣ Проверка пользователей с кошельками...');
    const usersWithWallets = await User.find({ 
      walletAddress: { $exists: true, $ne: null } 
    }).limit(5);
    
    console.log(`   Найдено пользователей с кошельками: ${usersWithWallets.length}`);
    
    if (usersWithWallets.length === 0) {
      console.log('⚠️ Нет пользователей с кошельками для тестирования');
    } else {
      // 6. Test balance checking for a few users
      console.log('\n6️⃣ Тестирование проверки балансов...');
      
      for (const user of usersWithWallets.slice(0, 3)) {
        console.log(`\n👤 Пользователь ${user.chatId} (${user.firstName || 'Неизвестно'}):`);
        console.log(`   - Адрес кошелька: ${user.walletAddress}`);
        console.log(`   - Баланс CES в БД: ${user.cesBalance || 0}`);
        console.log(`   - Баланс POL в БД: ${user.polBalance || 0}`);
        console.log(`   - Последнее обновление: ${user.lastBalanceUpdate || 'Никогда'}`);
        
        try {
          // Test CES balance
          console.log('   🔍 Проверка реального баланса CES...');
          const cesBalance = await walletService.getCESBalance(user.walletAddress);
          console.log(`   💰 Реальный баланс CES: ${cesBalance}`);
          
          // Test POL balance
          console.log('   🔍 Проверка реального баланса POL...');
          const polBalance = await walletService.getPOLBalance(user.walletAddress);
          console.log(`   💎 Реальный баланс POL: ${polBalance}`);
          
          // Compare with DB
          const cesDiscrepancy = cesBalance - (user.cesBalance || 0);
          const polDiscrepancy = polBalance - (user.polBalance || 0);
          
          if (Math.abs(cesDiscrepancy) > 0.0001) {
            console.log(`   ⚠️ Расхождение CES: ${cesDiscrepancy.toFixed(4)}`);
          } else {
            console.log(`   ✅ Баланс CES совпадает`);
          }
          
          if (Math.abs(polDiscrepancy) > 0.0001) {
            console.log(`   ⚠️ Расхождение POL: ${polDiscrepancy.toFixed(4)}`);
          } else {
            console.log(`   ✅ Баланс POL совпадает`);
          }
          
        } catch (balanceError) {
          console.log(`   ❌ Ошибка проверки баланса: ${balanceError.message}`);
        }
      }
      
      // 7. Test getUserWallet function
      console.log('\n7️⃣ Тестирование функции getUserWallet...');
      const testUser = usersWithWallets[0];
      
      try {
        const walletInfo = await walletService.getUserWallet(testUser.chatId);
        console.log(`   Результат getUserWallet:`);
        console.log(`   - hasWallet: ${walletInfo.hasWallet}`);
        console.log(`   - cesBalance: ${walletInfo.cesBalance}`);
        console.log(`   - polBalance: ${walletInfo.polBalance}`);
        console.log(`   - totalCESBalance: ${walletInfo.totalCESBalance}`);
        console.log(`   - totalPOLBalance: ${walletInfo.totalPOLBalance}`);
        
      } catch (walletError) {
        console.log(`   ❌ Ошибка getUserWallet: ${walletError.message}`);
      }
    }
    
    console.log('\n🎯 РЕКОМЕНДАЦИИ:');
    console.log('1. Проверьте переменные окружения (POLYGON_RPC_URL, CES_CONTRACT_ADDRESS)');
    console.log('2. Убедитесь, что Polygon RPC доступен');
    console.log('3. Проверьте правильность адреса контракта CES');
    console.log('4. Рассмотрите использование альтернативного RPC провайдера');
    
  } catch (error) {
    console.error('❌ Критическая ошибка диагностики:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Диагностика завершена');
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);