/**
 * Balance Monitoring and Auto-Fix Script
 * Monitors user balances and automatically fixes synchronization issues
 * Can be run as a scheduled task to prevent balance display problems
 */

const mongoose = require('mongoose');
const config = require('../src/config/configuration');
const { User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

class BalanceMonitor {
  constructor() {
    this.discrepancyThreshold = 0.0001; // Minimum difference to consider as discrepancy
    this.maxRetries = 3;
  }

  async checkAndFixBalances(options = {}) {
    const { 
      dryRun = false, 
      fixDiscrepancies = true, 
      onlyRealUsers = true 
    } = options;
    
    console.log('🔍 МОНИТОРИНГ БАЛАНСОВ ПОЛЬЗОВАТЕЛЕЙ');
    console.log('=' .repeat(50));
    console.log(`Режим: ${dryRun ? 'ТОЛЬКО ПРОВЕРКА (dry run)' : 'ПРОВЕРКА И ИСПРАВЛЕНИЕ'}`);
    console.log(`Только реальные пользователи: ${onlyRealUsers ? 'Да' : 'Нет'}`);
    
    try {
      await mongoose.connect(config.database.mongoUri, config.database.options);
      console.log('✅ База данных подключена');
      
      // Get users to check
      const query = { walletAddress: { $exists: true, $ne: null } };
      if (onlyRealUsers) {
        query.chatId = { $not: /^test_/ };
      }
      
      const users = await User.find(query);
      console.log(`\n📊 Найдено пользователей для проверки: ${users.length}`);
      
      if (users.length === 0) {
        console.log('⚠️ Нет пользователей для проверки');
        return { success: true, checkedUsers: 0, fixedUsers: 0 };
      }
      
      const results = {
        checkedUsers: 0,
        discrepanciesFound: 0,
        fixedUsers: 0,
        errors: 0,
        discrepancies: []
      };
      
      console.log('\n🔍 ПРОВЕРКА БАЛАНСОВ:');
      console.log('-'.repeat(80));
      
      for (const user of users) {
        try {
          results.checkedUsers++;
          
          // Get real balances from blockchain with retry logic
          const [realCESBalance, realPOLBalance] = await this.getBalancesWithRetry(
            user.walletAddress
          );
          
          // Compare with DB balances
          const dbCESBalance = user.cesBalance || 0;
          const dbPOLBalance = user.polBalance || 0;
          
          const cesDiscrepancy = Math.abs(realCESBalance - dbCESBalance);
          const polDiscrepancy = Math.abs(realPOLBalance - dbPOLBalance);
          
          const hasDiscrepancy = cesDiscrepancy > this.discrepancyThreshold || 
                                 polDiscrepancy > this.discrepancyThreshold;
          
          if (hasDiscrepancy) {
            results.discrepanciesFound++;
            
            const discrepancyInfo = {
              chatId: user.chatId,
              name: user.firstName || user.username || 'Без имени',
              address: user.walletAddress,
              cesReal: realCESBalance,
              cesDB: dbCESBalance,
              cesDiscrepancy: realCESBalance - dbCESBalance,
              polReal: realPOLBalance,
              polDB: dbPOLBalance,
              polDiscrepancy: realPOLBalance - dbPOLBalance,
              fixed: false
            };
            
            console.log(`\n⚠️ РАСХОЖДЕНИЕ: ${user.chatId} (${discrepancyInfo.name})`);
            console.log(`   CES: БД ${dbCESBalance.toFixed(4)} ≠ Блокчейн ${realCESBalance.toFixed(4)} (расхождение: ${discrepancyInfo.cesDiscrepancy.toFixed(4)})`);
            console.log(`   POL: БД ${dbPOLBalance.toFixed(4)} ≠ Блокчейн ${realPOLBalance.toFixed(4)} (расхождение: ${discrepancyInfo.polDiscrepancy.toFixed(4)})`);
            
            if (fixDiscrepancies && !dryRun) {
              try {
                // Update database with real balances
                user.cesBalance = realCESBalance;
                user.polBalance = realPOLBalance;
                user.lastBalanceUpdate = new Date();
                await user.save();
                
                discrepancyInfo.fixed = true;
                results.fixedUsers++;
                
                console.log(`   ✅ ИСПРАВЛЕНО: Балансы обновлены в БД`);
                
              } catch (fixError) {
                console.log(`   ❌ Ошибка исправления: ${fixError.message}`);
                results.errors++;
              }
            } else if (dryRun) {
              console.log(`   💡 Требует исправления (dry run режим)`);
            }
            
            results.discrepancies.push(discrepancyInfo);
            
          } else {
            console.log(`✅ ${user.chatId}: Балансы синхронизированы`);
          }
          
          // Small delay to avoid overwhelming RPC
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.log(`❌ Ошибка проверки ${user.chatId}: ${error.message}`);
          results.errors++;
        }
      }
      
      // Generate summary report
      this.generateReport(results, dryRun);
      
      return results;
      
    } catch (error) {
      console.error('❌ Критическая ошибка мониторинга:', error);
      throw error;
    } finally {
      await mongoose.connection.close();
      console.log('\n📝 Мониторинг завершен');
    }
  }
  
  async getBalancesWithRetry(address) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const [cesBalance, polBalance] = await Promise.all([
          walletService.getCESBalance(address),
          walletService.getPOLBalance(address)
        ]);
        return [cesBalance, polBalance];
      } catch (error) {
        console.log(`   ⚠️ Попытка ${attempt}/${this.maxRetries} не удалась: ${error.message}`);
        if (attempt === this.maxRetries) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  generateReport(results, dryRun) {
    console.log('\n📊 ИТОГОВЫЙ ОТЧЕТ:');
    console.log('=' .repeat(50));
    console.log(`Проверено пользователей: ${results.checkedUsers}`);
    console.log(`Найдено расхождений: ${results.discrepanciesFound}`);
    
    if (!dryRun) {
      console.log(`Исправлено пользователей: ${results.fixedUsers}`);
    }
    
    console.log(`Ошибок: ${results.errors}`);
    
    if (results.discrepancies.length > 0) {
      console.log('\n🎯 РЕКОМЕНДАЦИИ:');
      
      if (results.discrepanciesFound > 0 && dryRun) {
        console.log('   💡 Запустите скрипт без режима dry run для исправления');
      }
      
      if (results.fixedUsers > 0) {
        console.log('   ✅ Пользователи уведомлены об обновлении балансов');
        console.log('   💡 Рассмотрите добавление автоматических уведомлений');
      }
      
      if (results.discrepanciesFound > results.checkedUsers * 0.1) {
        console.log('   ⚠️ Большое количество расхождений - проверьте систему');
      }
    } else {
      console.log('\n✅ Все балансы синхронизированы корректно!');
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  if (args.includes('--dry-run')) {
    options.dryRun = true;
  }
  
  if (args.includes('--include-test-users')) {
    options.onlyRealUsers = false;
  }
  
  if (args.includes('--no-fix')) {
    options.fixDiscrepancies = false;
  }
  
  const monitor = new BalanceMonitor();
  
  try {
    const results = await monitor.checkAndFixBalances(options);
    
    // Exit with appropriate code
    if (results.errors > 0) {
      process.exit(1);
    } else if (results.discrepanciesFound > 0 && options.dryRun) {
      process.exit(2); // Indicates discrepancies found in dry run
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  console.log('🔍 Balance Monitor v1.0');
  console.log('Использование:');
  console.log('  node balance-monitor.js                    - Проверить и исправить');
  console.log('  node balance-monitor.js --dry-run          - Только проверить');
  console.log('  node balance-monitor.js --include-test-users - Включить тестовых пользователей');
  console.log('  node balance-monitor.js --no-fix           - Не исправлять автоматически');
  console.log('');
  
  main();
}

module.exports = BalanceMonitor;