/**
 * Real User Balance Checker
 * Checks balances of real users to identify the scope of the issue
 */

const mongoose = require('mongoose');
const config = require('../src/config/configuration');
const { User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

async function checkRealUserBalances() {
  console.log('🔍 ПРОВЕРКА БАЛАНСОВ РЕАЛЬНЫХ ПОЛЬЗОВАТЕЛЕЙ');
  console.log('=' .repeat(50));
  
  try {
    // Connect to database
    await mongoose.connect(config.database.mongoUri, config.database.options);
    console.log('✅ База данных подключена');
    
    // Find all users with wallets (excluding test users)
    const realUsers = await User.find({ 
      walletAddress: { $exists: true, $ne: null },
      chatId: { $not: /^test_/ } // Exclude test users
    }).sort({ lastBalanceUpdate: -1 });
    
    console.log(`\n📊 Найдено реальных пользователей с кошельками: ${realUsers.length}`);
    
    if (realUsers.length === 0) {
      console.log('⚠️ Нет реальных пользователей с кошельками');
      return;
    }
    
    let usersWithBalance = 0;
    let usersWithZeroBalance = 0;
    let totalCESBalance = 0;
    let totalPOLBalance = 0;
    
    console.log('\n👥 АНАЛИЗ ПОЛЬЗОВАТЕЛЕЙ:');
    console.log('-'.repeat(80));
    
    for (const user of realUsers.slice(0, 20)) { // Check first 20 users
      try {
        const walletInfo = await walletService.getUserWallet(user.chatId);
        
        const hasCES = walletInfo.totalCESBalance > 0;
        const hasPOL = walletInfo.totalPOLBalance > 0;
        
        if (hasCES || hasPOL) {
          usersWithBalance++;
          console.log(`\n✅ ${user.chatId} (${user.firstName || 'Без имени'}):`);
          console.log(`   💰 CES: ${walletInfo.totalCESBalance.toFixed(4)}`);
          console.log(`   💎 POL: ${walletInfo.totalPOLBalance.toFixed(4)}`);
          console.log(`   📅 Обновлено: ${walletInfo.lastUpdate || 'Никогда'}`);
          
          totalCESBalance += walletInfo.totalCESBalance;
          totalPOLBalance += walletInfo.totalPOLBalance;
        } else {
          usersWithZeroBalance++;
          console.log(`❌ ${user.chatId}: Нулевой баланс`);
        }
        
      } catch (error) {
        console.log(`⚠️ ${user.chatId}: Ошибка - ${error.message}`);
      }
    }
    
    console.log('\n📈 СТАТИСТИКА:');
    console.log(`   Пользователей с балансом: ${usersWithBalance}`);
    console.log(`   Пользователей с нулевым балансом: ${usersWithZeroBalance}`);
    console.log(`   Общий баланс CES: ${totalCESBalance.toFixed(4)}`);
    console.log(`   Общий баланс POL: ${totalPOLBalance.toFixed(4)}`);
    
    // Check recent balance updates
    console.log('\n📅 ПОСЛЕДНИЕ ОБНОВЛЕНИЯ БАЛАНСОВ:');
    const recentUpdates = await User.find({
      lastBalanceUpdate: { $exists: true, $ne: null },
      chatId: { $not: /^test_/ }
    }).sort({ lastBalanceUpdate: -1 }).limit(10);
    
    for (const user of recentUpdates) {
      const timeDiff = new Date() - new Date(user.lastBalanceUpdate);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      console.log(`   ${user.chatId}: ${hoursAgo} часов назад (CES: ${user.cesBalance || 0}, POL: ${user.polBalance || 0})`);
    }
    
    // Check for users with escrowed balances
    console.log('\n🔒 ПОЛЬЗОВАТЕЛИ С ЗАБЛОКИРОВАННЫМИ СРЕДСТВАМИ:');
    const usersWithEscrow = await User.find({
      $or: [
        { escrowCESBalance: { $gt: 0 } },
        { escrowPOLBalance: { $gt: 0 } }
      ],
      chatId: { $not: /^test_/ }
    });
    
    if (usersWithEscrow.length > 0) {
      for (const user of usersWithEscrow) {
        console.log(`   ${user.chatId}: CES в эскроу: ${user.escrowCESBalance || 0}, POL в эскроу: ${user.escrowPOLBalance || 0}`);
      }
    } else {
      console.log('   Нет пользователей с заблокированными средствами');
    }
    
    // Recommendations
    console.log('\n🎯 ВЫВОДЫ:');
    if (usersWithZeroBalance > usersWithBalance * 2) {
      console.log('⚠️ Большинство пользователей имеют нулевые балансы');
      console.log('   Возможные причины:');
      console.log('   - Пользователи потратили все средства');
      console.log('   - Проблемы с пополнением кошельков');
      console.log('   - Средства заблокированы в P2P сделках');
    } else {
      console.log('✅ Система балансов работает корректно');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Проверка завершена');
  }
}

checkRealUserBalances().catch(console.error);