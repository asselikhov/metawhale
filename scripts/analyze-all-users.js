/**
 * Complete User Analysis Script
 * Analyzes all users in the system to understand the balance display issue
 */

const mongoose = require('mongoose');
const config = require('../src/config/configuration');
const { User } = require('../src/database/models');

async function analyzeAllUsers() {
  console.log('🔍 ПОЛНЫЙ АНАЛИЗ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ');
  console.log('=' .repeat(50));
  
  try {
    await mongoose.connect(config.database.mongoUri, config.database.options);
    console.log('✅ База данных подключена');
    
    // Get all users
    const allUsers = await User.find({}).sort({ subscribedAt: -1 });
    console.log(`\n📊 Всего пользователей в системе: ${allUsers.length}`);
    
    // Categorize users
    const realUsers = allUsers.filter(user => !user.chatId.startsWith('test_'));
    const testUsers = allUsers.filter(user => user.chatId.startsWith('test_'));
    
    const realUsersWithWallets = realUsers.filter(user => user.walletAddress);
    const realUsersWithoutWallets = realUsers.filter(user => !user.walletAddress);
    
    console.log(`\n👥 КАТЕГОРИИ ПОЛЬЗОВАТЕЛЕЙ:`);
    console.log(`   Реальные пользователи: ${realUsers.length}`);
    console.log(`   - С кошельками: ${realUsersWithWallets.length}`);
    console.log(`   - Без кошельков: ${realUsersWithoutWallets.length}`);
    console.log(`   Тестовые пользователи: ${testUsers.length}`);
    
    // Check recent activity
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentlyActive = realUsers.filter(user => 
      user.lastBalanceUpdate && new Date(user.lastBalanceUpdate) > yesterday
    );
    
    const activeThisWeek = realUsers.filter(user => 
      user.lastBalanceUpdate && new Date(user.lastBalanceUpdate) > lastWeek
    );
    
    console.log(`\n📅 АКТИВНОСТЬ ПОЛЬЗОВАТЕЛЕЙ:`);
    console.log(`   Активны за последние 24 часа: ${recentlyActive.length}`);
    console.log(`   Активны за последнюю неделю: ${activeThisWeek.length}`);
    
    // Detailed analysis of real users with wallets
    if (realUsersWithWallets.length > 0) {
      console.log(`\n🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ПОЛЬЗОВАТЕЛЕЙ С КОШЕЛЬКАМИ:`);
      console.log('-'.repeat(80));
      
      for (const user of realUsersWithWallets) {
        const lastUpdate = user.lastBalanceUpdate ? 
          new Date(user.lastBalanceUpdate).toLocaleString('ru-RU') : 'Никогда';
        
        const hoursAgo = user.lastBalanceUpdate ? 
          Math.floor((now - new Date(user.lastBalanceUpdate)) / (1000 * 60 * 60)) : 'N/A';
        
        console.log(`\n👤 ${user.chatId} (${user.firstName || user.username || 'Без имени'}):`);
        console.log(`   📧 Telegram: @${user.username || 'не указан'}`);
        console.log(`   🏠 Адрес кошелька: ${user.walletAddress}`);
        console.log(`   💰 Баланс CES: ${user.cesBalance || 0}`);
        console.log(`   💎 Баланс POL: ${user.polBalance || 0}`);
        console.log(`   🔒 Эскроу CES: ${user.escrowCESBalance || 0}`);
        console.log(`   🔒 Эскроу POL: ${user.escrowPOLBalance || 0}`);
        console.log(`   📅 Последнее обновление: ${lastUpdate} (${hoursAgo} ч. назад)`);
        console.log(`   ✅ Активен: ${user.isActive ? 'Да' : 'Нет'}`);
        console.log(`   📈 P2P рейтинг: ${user.p2pRating || 5.0}`);
        console.log(`   🤝 Успешных сделок: ${user.successfulTrades || 0}`);
      }
    }
    
    // Check for users who might have balance issues
    console.log(`\n⚠️ ПОТЕНЦИАЛЬНЫЕ ПРОБЛЕМЫ:`);
    
    const usersWithOldUpdates = realUsersWithWallets.filter(user => {
      if (!user.lastBalanceUpdate) return true;
      const hoursSinceUpdate = (now - new Date(user.lastBalanceUpdate)) / (1000 * 60 * 60);
      return hoursSinceUpdate > 24;
    });
    
    if (usersWithOldUpdates.length > 0) {
      console.log(`   🕐 Пользователи с устаревшими балансами (>24ч): ${usersWithOldUpdates.length}`);
      for (const user of usersWithOldUpdates) {
        const hoursAgo = user.lastBalanceUpdate ? 
          Math.floor((now - new Date(user.lastBalanceUpdate)) / (1000 * 60 * 60)) : 'Никогда';
        console.log(`     - ${user.chatId}: ${hoursAgo} часов назад`);
      }
    } else {
      console.log(`   ✅ Все балансы актуальны`);
    }
    
    // Check for DB vs Blockchain discrepancies would require blockchain calls
    console.log(`\n🎯 РЕКОМЕНДАЦИИ:`);
    
    if (realUsersWithWallets.length === 0) {
      console.log(`   ⚠️ В системе нет реальных пользователей с кошельками`);
      console.log(`   💡 Возможно, нужно проверить процесс регистрации`);
    } else if (usersWithOldUpdates.length > 0) {
      console.log(`   🔄 Рекомендуется обновить балансы для ${usersWithOldUpdates.length} пользователей`);
      console.log(`   💡 Можно запустить принудительное обновление балансов`);
    } else {
      console.log(`   ✅ Система работает корректно`);
      console.log(`   💡 Если пользователи жалуются на нулевые балансы, возможно:`);
      console.log(`      - Они действительно потратили все средства`);
      console.log(`      - Средства заблокированы в активных P2P сделках`);
      console.log(`      - Проблемы с интерфейсом отображения`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Анализ завершен');
  }
}

analyzeAllUsers().catch(console.error);