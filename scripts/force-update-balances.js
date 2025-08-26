/**
 * Force Balance Update Script
 * Updates all user balances from blockchain and fixes DB synchronization issues
 */

const mongoose = require('mongoose');
const config = require('../src/config/configuration');
const { User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

async function forceUpdateAllBalances() {
  console.log('🔄 ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ БАЛАНСОВ');
  console.log('=' .repeat(50));
  
  try {
    await mongoose.connect(config.database.mongoUri, config.database.options);
    console.log('✅ База данных подключена');
    
    // Get all users with wallets
    const usersWithWallets = await User.find({ 
      walletAddress: { $exists: true, $ne: null }
    });
    
    console.log(`\n📊 Найдено пользователей с кошельками: ${usersWithWallets.length}`);
    
    if (usersWithWallets.length === 0) {
      console.log('⚠️ Нет пользователей для обновления');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let updatedBalances = [];
    
    console.log('\n🔄 ОБНОВЛЕНИЕ БАЛАНСОВ:');
    console.log('-'.repeat(80));
    
    for (const user of usersWithWallets) {
      try {
        console.log(`\n👤 Обновляем пользователя ${user.chatId} (${user.firstName || 'Без имени'})...`);
        
        // Store old balances for comparison
        const oldCESBalance = user.cesBalance || 0;
        const oldPOLBalance = user.polBalance || 0;
        
        // Get real balances from blockchain
        console.log(`   🔍 Проверяем реальные балансы...`);
        const [realCESBalance, realPOLBalance] = await Promise.all([
          walletService.getCESBalance(user.walletAddress),
          walletService.getPOLBalance(user.walletAddress)
        ]);
        
        console.log(`   📊 Реальные балансы: CES: ${realCESBalance}, POL: ${realPOLBalance}`);
        console.log(`   📊 Старые балансы в БД: CES: ${oldCESBalance}, POL: ${oldPOLBalance}`);
        
        // Calculate changes
        const cesChange = realCESBalance - oldCESBalance;
        const polChange = realPOLBalance - oldPOLBalance;
        
        // Update user in database
        user.cesBalance = realCESBalance;
        user.polBalance = realPOLBalance;
        user.lastBalanceUpdate = new Date();
        await user.save();
        
        console.log(`   ✅ Обновлено в БД:`);
        console.log(`      CES: ${oldCESBalance} → ${realCESBalance} (${cesChange >= 0 ? '+' : ''}${cesChange.toFixed(4)})`);
        console.log(`      POL: ${oldPOLBalance} → ${realPOLBalance} (${polChange >= 0 ? '+' : ''}${polChange.toFixed(4)})`);
        
        updatedBalances.push({
          chatId: user.chatId,
          name: user.firstName || user.username || 'Без имени',
          cesOld: oldCESBalance,
          cesNew: realCESBalance,
          cesChange: cesChange,
          polOld: oldPOLBalance,
          polNew: realPOLBalance,
          polChange: polChange
        });
        
        successCount++;
        
        // Small delay to avoid overwhelming the RPC
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`   ❌ Ошибка обновления для ${user.chatId}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📈 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   ✅ Успешно обновлено: ${successCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    
    if (updatedBalances.length > 0) {
      console.log('\n💰 ИЗМЕНЕНИЯ БАЛАНСОВ:');
      console.log('-'.repeat(80));
      
      let totalCESChange = 0;
      let totalPOLChange = 0;
      
      for (const update of updatedBalances) {
        const hasChanges = Math.abs(update.cesChange) > 0.0001 || Math.abs(update.polChange) > 0.0001;
        
        if (hasChanges) {
          console.log(`\n🔄 ${update.chatId} (${update.name}):`);
          if (Math.abs(update.cesChange) > 0.0001) {
            console.log(`   CES: ${update.cesOld.toFixed(4)} → ${update.cesNew.toFixed(4)} (${update.cesChange >= 0 ? '+' : ''}${update.cesChange.toFixed(4)})`);
          }
          if (Math.abs(update.polChange) > 0.0001) {
            console.log(`   POL: ${update.polOld.toFixed(4)} → ${update.polNew.toFixed(4)} (${update.polChange >= 0 ? '+' : ''}${update.polChange.toFixed(4)})`);
          }
          
          totalCESChange += update.cesChange;
          totalPOLChange += update.polChange;
        } else {
          console.log(`✅ ${update.chatId} (${update.name}): Без изменений`);
        }
      }
      
      console.log('\n🎯 ОБЩИЕ ИЗМЕНЕНИЯ:');
      console.log(`   Всего изменений CES: ${totalCESChange >= 0 ? '+' : ''}${totalCESChange.toFixed(4)}`);
      console.log(`   Всего изменений POL: ${totalPOLChange >= 0 ? '+' : ''}${totalPOLChange.toFixed(4)}`);
    }
    
    console.log('\n✅ ОБНОВЛЕНИЕ ЗАВЕРШЕНО!');
    console.log('💡 Теперь пользователи должны видеть актуальные балансы');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Принудительное обновление завершено');
  }
}

forceUpdateAllBalances().catch(console.error);