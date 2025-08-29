/**
 * Автоматический Мониторинг Эскроу
 * Предотвращает заморозку средств через регулярные проверки
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/database/models');
const escrowSafetySystem = require('../src/services/escrowSafetySystem');

class EscrowMonitoringService {
  constructor() {
    this.monitoringInterval = 30 * 60 * 1000; // 30 минут
    this.isRunning = false;
  }

  /**
   * Запуск постоянного мониторинга
   */
  async startMonitoring() {
    if (this.isRunning) {
      console.log('🔍 Monitoring is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting escrow monitoring service...');

    try {
      await connectDatabase();
      console.log('✅ Connected to database for monitoring');

      // Первоначальная проверка
      await this.performMonitoringCheck();

      // Запуск периодических проверок
      this.intervalId = setInterval(async () => {
        try {
          await this.performMonitoringCheck();
        } catch (error) {
          console.error('❌ Monitoring check failed:', error);
        }
      }, this.monitoringInterval);

      console.log(`🔄 Monitoring started, checking every ${this.monitoringInterval / 60000} minutes`);

    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Остановка мониторинга
   */
  async stopMonitoring() {
    if (!this.isRunning) {
      console.log('🛑 Monitoring is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await disconnectDatabase();
    console.log('🛑 Escrow monitoring stopped');
  }

  /**
   * Выполнение проверки мониторинга
   */
  async performMonitoringCheck() {
    try {
      console.log('🔍 [MONITOR] Starting escrow monitoring check...');
      
      // 1. Проверка зависших эскроу
      await escrowSafetySystem.checkStuckEscrows();
      
      // 2. Проверка просроченных сделок
      await this.checkExpiredTrades();
      
      // 3. Проверка несоответствий балансов
      await this.checkBalanceDiscrepancies();
      
      // 4. Статистика мониторинга
      await this.generateMonitoringStats();
      
      console.log('✅ [MONITOR] Monitoring check completed successfully');
      
    } catch (error) {
      console.error('❌ [MONITOR] Monitoring check failed:', error);
    }
  }

  /**
   * Проверка просроченных сделок
   */
  async checkExpiredTrades() {
    try {
      const { P2PTrade } = require('../src/database/models');
      
      // Найти сделки старше 2 часов в статусе escrow_locked или payment_pending
      const expiredTrades = await P2PTrade.find({
        status: { $in: ['escrow_locked', 'payment_pending'] },
        'timeTracking.createdAt': { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
      }).populate('sellerId buyerId');

      if (expiredTrades.length > 0) {
        console.log(`⚠️ [MONITOR] Found ${expiredTrades.length} expired trades`);
        
        for (const trade of expiredTrades) {
          try {
            // Проверить, истек ли реальный таймаут
            const expiryTime = trade.timeTracking?.expiresAt || 
                              new Date(trade.timeTracking.createdAt.getTime() + 30 * 60 * 1000);
            
            if (Date.now() > expiryTime.getTime()) {
              console.log(`🕐 [MONITOR] Processing expired trade: ${trade._id}`);
              
              const p2pService = require('../src/services/p2p');
              await p2pService.cancelTradeWithTimeout(trade._id);
              
              console.log(`✅ [MONITOR] Processed expired trade: ${trade._id}`);
            }
          } catch (tradeError) {
            console.error(`❌ [MONITOR] Failed to process expired trade ${trade._id}:`, tradeError);
          }
        }
      } else {
        console.log('✅ [MONITOR] No expired trades found');
      }
      
    } catch (error) {
      console.error('❌ [MONITOR] Error checking expired trades:', error);
    }
  }

  /**
   * Проверка несоответствий балансов
   */
  async checkBalanceDiscrepancies() {
    try {
      const { User } = require('../src/database/models');
      const walletService = require('../src/services/walletService');
      
      // Найти пользователей с CES балансами для проверки
      const usersWithBalance = await User.find({
        walletAddress: { $exists: true, $ne: null },
        $or: [
          { cesBalance: { $gt: 0 } },
          { escrowCESBalance: { $gt: 0 } }
        ]
      }).limit(10); // Проверяем по 10 пользователей за раз
      
      let discrepanciesFound = 0;
      
      for (const user of usersWithBalance) {
        try {
          // Получить реальный баланс с блокчейна
          const blockchainBalance = await walletService.getCESBalance(user.walletAddress);
          const dbTotalBalance = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
          
          const difference = Math.abs(blockchainBalance - dbTotalBalance);
          
          if (difference > 0.0001) { // Допустимая погрешность
            console.log(`⚠️ [MONITOR] Balance discrepancy for user ${user.chatId}:`);
            console.log(`   Database: ${dbTotalBalance} CES (${user.cesBalance} available + ${user.escrowCESBalance} escrow)`);
            console.log(`   Blockchain: ${blockchainBalance} CES`);
            console.log(`   Difference: ${difference.toFixed(4)} CES`);
            
            discrepanciesFound++;
            
            // Создать запись для расследования
            const { EscrowTransaction } = require('../src/database/models');
            const discrepancyRecord = new EscrowTransaction({
              userId: user._id,
              type: 'balance_discrepancy_detected',
              tokenType: 'CES',
              amount: difference,
              status: 'pending',
              reason: `Balance discrepancy: DB=${dbTotalBalance}, Blockchain=${blockchainBalance}`,
              createdAt: new Date()
            });
            
            await discrepancyRecord.save();
          }
          
        } catch (balanceError) {
          console.error(`❌ [MONITOR] Error checking balance for user ${user.chatId}:`, balanceError);
        }
      }
      
      if (discrepanciesFound === 0) {
        console.log('✅ [MONITOR] No balance discrepancies found');
      } else {
        console.log(`⚠️ [MONITOR] Found ${discrepanciesFound} balance discrepancies`);
      }
      
    } catch (error) {
      console.error('❌ [MONITOR] Error checking balance discrepancies:', error);
    }
  }

  /**
   * Генерация статистики мониторинга
   */
  async generateMonitoringStats() {
    try {
      const { EscrowTransaction, P2PTrade, User } = require('../src/database/models');
      
      // Статистика эскроу транзакций за последние 24 часа
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const stats = {
        activeEscrows: await EscrowTransaction.countDocuments({
          type: 'lock',
          status: 'completed',
          createdAt: { $gte: last24Hours }
        }),
        successfulRefunds: await EscrowTransaction.countDocuments({
          type: 'refund',
          status: 'completed',
          createdAt: { $gte: last24Hours }
        }),
        manualInterventions: await EscrowTransaction.countDocuments({
          type: { $in: ['manual_intervention_required', 'timeout_intervention_required'] },
          status: 'pending',
          createdAt: { $gte: last24Hours }
        }),
        activeTrades: await P2PTrade.countDocuments({
          status: { $in: ['escrow_locked', 'payment_pending'] }
        }),
        usersWithEscrow: await User.countDocuments({
          escrowCESBalance: { $gt: 0 }
        })
      };
      
      console.log('📊 [MONITOR] Escrow monitoring statistics (24h):');
      console.log(`   Active escrows: ${stats.activeEscrows}`);
      console.log(`   Successful refunds: ${stats.successfulRefunds}`);
      console.log(`   Manual interventions needed: ${stats.manualInterventions}`);
      console.log(`   Active trades: ${stats.activeTrades}`);
      console.log(`   Users with escrowed funds: ${stats.usersWithEscrow}`);
      
      if (stats.manualInterventions > 0) {
        console.log('⚠️ [MONITOR] ATTENTION: Manual interventions required!');
      }
      
    } catch (error) {
      console.error('❌ [MONITOR] Error generating monitoring stats:', error);
    }
  }

  /**
   * Одноразовая проверка (для ручного запуска)
   */
  async runSingleCheck() {
    try {
      console.log('🔍 Running single escrow monitoring check...');
      
      await connectDatabase();
      await this.performMonitoringCheck();
      await disconnectDatabase();
      
      console.log('✅ Single monitoring check completed');
      
    } catch (error) {
      console.error('❌ Single monitoring check failed:', error);
      await disconnectDatabase();
      throw error;
    }
  }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  const monitor = new EscrowMonitoringService();
  
  // Обработка сигналов для корректного завершения
  process.on('SIGINT', async () => {
    console.log('\\n🛑 Received SIGINT, stopping monitoring...');
    await monitor.stopMonitoring();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\\n🛑 Received SIGTERM, stopping monitoring...');
    await monitor.stopMonitoring();
    process.exit(0);
  });
  
  // Запуск мониторинга
  monitor.startMonitoring()
    .catch((error) => {
      console.error('💥 Failed to start monitoring:', error);
      process.exit(1);
    });
}

module.exports = EscrowMonitoringService;