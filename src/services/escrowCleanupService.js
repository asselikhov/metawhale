/**
 * Escrow Cleanup Service
 * Автоматическая очистка застрявших токенов в эскроу
 */

const { User, P2POrder, P2PTrade, EscrowTransaction } = require('../database/models');
const walletService = require('./walletService');
const escrowService = require('./escrowService');

class EscrowCleanupService {
  constructor() {
    this.isRunning = false;
    this.cleanupIntervalMinutes = 60; // Проверка каждый час
    this.cleanupTimeout = null;
  }

  // Запуск автоматической очистки
  startAutoCleanup() {
    if (this.isRunning) {
      console.log('⚠️ Escrow cleanup already running');
      return;
    }

    this.isRunning = true;
    console.log('🧹 Starting automatic escrow cleanup service');
    
    // Первая проверка через 5 минут после запуска
    this.cleanupTimeout = setTimeout(() => {
      this.performCleanup();
      // Затем каждый час
      this.cleanupTimeout = setInterval(() => {
        this.performCleanup();
      }, this.cleanupIntervalMinutes * 60 * 1000);
    }, 5 * 60 * 1000);
  }

  // Остановка автоматической очистки
  stopAutoCleanup() {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      clearInterval(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }
    this.isRunning = false;
    console.log('🛑 Stopped automatic escrow cleanup service');
  }

  // Выполнение очистки
  async performCleanup() {
    try {
      console.log('🧹 Performing escrow cleanup...');
      
      const results = await Promise.all([
        this.cleanupOrphanedEscrows(),
        this.fixBalanceDiscrepancies(),
        this.cleanupExpiredOrderEscrows(),
        this.validateActiveTradeEscrows()
      ]);
      
      const [orphaned, discrepancies, expired, invalid] = results;
      
      console.log('✅ Escrow cleanup completed:');
      console.log(`   - Orphaned escrows fixed: ${orphaned}`);
      console.log(`   - Balance discrepancies fixed: ${discrepancies}`);
      console.log(`   - Expired order escrows cleaned: ${expired}`);
      console.log(`   - Invalid trade escrows fixed: ${invalid}`);
      
    } catch (error) {
      console.error('❌ Error during escrow cleanup:', error);
    }
  }

  // Очистка "сиротских" эскроу без связанных ордеров/сделок
  async cleanupOrphanedEscrows() {
    try {
      let fixedCount = 0;
      
      // Найти эскроу транзакции типа 'lock' без соответствующих активных операций
      const orphanedEscrows = await EscrowTransaction.find({
        type: 'lock',
        status: 'completed',
        tradeId: null // Эскроу без связанной сделки
      });

      for (const escrowTx of orphanedEscrows) {
        // Проверить, есть ли активные ордера для этого пользователя
        const activeOrders = await P2POrder.find({
          userId: escrowTx.userId,
          status: { $in: ['active', 'partial'] },
          escrowLocked: true,
          escrowAmount: { $gt: 0 }
        });

        // Если нет активных ордеров, это сиротский эскроу
        if (activeOrders.length === 0) {
          console.log(`🔍 Found orphaned escrow: ${escrowTx._id} (${escrowTx.amount} ${escrowTx.tokenType})`);
          
          // Проверить, создан ли этот эскроу более 24 часов назад
          const createdHoursAgo = (Date.now() - escrowTx.createdAt.getTime()) / (1000 * 60 * 60);
          
          if (createdHoursAgo > 24) {
            try {
              // Check if user still exists before attempting refund
              const user = await User.findById(escrowTx.userId);
              if (!user) {
                console.log(`⚠️ User not found for orphaned escrow ${escrowTx._id}, marking as resolved`); 
                // Mark the escrow transaction as resolved since user no longer exists
                escrowTx.status = 'cancelled';
                escrowTx.reason = 'Automatic cleanup: user account deleted';
                await escrowTx.save();
                fixedCount++;
                continue;
              }
              
              await escrowService.refundTokensFromEscrow(
                escrowTx.userId,
                null,
                escrowTx.tokenType,
                escrowTx.amount,
                'Automatic cleanup: orphaned escrow older than 24 hours'
              );
              
              console.log(`✅ Cleaned orphaned escrow: ${escrowTx._id}`);
              fixedCount++;
            } catch (refundError) {
              console.error(`❌ Failed to refund orphaned escrow ${escrowTx._id}:`, refundError);
            }
          }
        }
      }
      
      return fixedCount;
    } catch (error) {
      console.error('Error cleaning orphaned escrows:', error);
      return 0;
    }
  }

  // Исправление расхождений балансов
  async fixBalanceDiscrepancies() {
    try {
      let fixedCount = 0;
      
      // Получить всех пользователей с кошельками
      const users = await User.find({
        walletAddress: { $exists: true, $ne: null }
      });

      for (const user of users) {
        try {
          // CRITICAL: Check for balance protection flags before any automatic corrections
          if (user.balanceProtectionEnabled || user.adminProtected || user.skipBalanceSync || user.manualBalance || 
              user.emergencyProtection || user.cleanupServiceBypass) {
            console.log(`🔒 [CLEANUP] Skipping balance check for protected user ${user.chatId}:`);
            console.log(`    Protection flags: { balanceProtectionEnabled: ${user.balanceProtectionEnabled}, adminProtected: ${user.adminProtected}, skipBalanceSync: ${user.skipBalanceSync}, manualBalance: ${user.manualBalance} }`);
            console.log(`    Emergency flags: { emergencyProtection: ${user.emergencyProtection}, cleanupServiceBypass: ${user.cleanupServiceBypass} }`);
            console.log(`    Admin allocation: ${user.adminAllocationAmount || 'none'} CES`);
            continue; // Skip this user completely
          }
          
          // Получить реальный баланс из блокчейна
          const realCESBalance = await walletService.getCESBalance(user.walletAddress);
          
          // Рассчитать активные эскроу
          const activeTrades = await P2PTrade.find({
            sellerId: user._id,
            status: { $in: ['escrow_locked', 'payment_pending', 'payment_made', 'payment_confirmed'] }
          });
          
          const activeOrderEscrows = await P2POrder.find({
            userId: user._id,
            type: 'sell',
            status: { $in: ['active', 'partial'] },
            escrowLocked: true,
            escrowAmount: { $gt: 0 }
          });
          
          let requiredEscrowBalance = 0;
          activeTrades.forEach(trade => requiredEscrowBalance += trade.amount);
          activeOrderEscrows.forEach(order => requiredEscrowBalance += order.escrowAmount);
          
          const requiredAvailableBalance = realCESBalance - requiredEscrowBalance;
          
          // Проверить расхождения
          const currentTotal = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
          const expectedTotal = realCESBalance;
          
          if (Math.abs(currentTotal - expectedTotal) > 0.0001) {
            console.log(`🔍 Balance discrepancy for user ${user.chatId}:`);
            console.log(`   Current: ${currentTotal.toFixed(4)} CES, Expected: ${expectedTotal.toFixed(4)} CES`);
            
            // Исправить балансы
            user.cesBalance = Math.max(0, requiredAvailableBalance);
            user.escrowCESBalance = requiredEscrowBalance;
            user.lastBalanceUpdate = new Date();
            
            await user.save();
            
            // Создать корректирующую транзакцию
            const correctionTx = new EscrowTransaction({
              userId: user._id,
              tradeId: null,
              type: 'refund',
              tokenType: 'CES',
              amount: currentTotal - expectedTotal,
              status: 'completed',
              reason: `Automatic balance correction: ${currentTotal.toFixed(4)} → ${expectedTotal.toFixed(4)} CES`,
              completedAt: new Date()
            });
            
            if (Math.abs(correctionTx.amount) > 0.0001) {
              await correctionTx.save();
            }
            
            console.log(`✅ Fixed balance discrepancy for user ${user.chatId}`);
            fixedCount++;
          }
          
        } catch (userError) {
          console.error(`Error checking user ${user.chatId}:`, userError);
        }
      }
      
      return fixedCount;
    } catch (error) {
      console.error('Error fixing balance discrepancies:', error);
      return 0;
    }
  }

  // Очистка эскроу от истекших ордеров
  async cleanupExpiredOrderEscrows() {
    try {
      let fixedCount = 0;
      
      // Найти отмененные ордера старше 1 часа с заблокированным эскроу
      const expiredOrders = await P2POrder.find({
        status: 'cancelled',
        escrowLocked: true,
        escrowAmount: { $gt: 0 },
        updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) } // Старше 1 часа
      });

      for (const order of expiredOrders) {
        try {
          // Проверить, был ли уже возвращен эскроу
          const refundTx = await EscrowTransaction.findOne({
            userId: order.userId,
            type: 'refund',
            amount: order.escrowAmount,
            createdAt: { $gte: order.updatedAt }
          });
          
          if (!refundTx) {
            console.log(`🔍 Found expired order with unreturned escrow: ${order._id}`);
            
            await escrowService.refundTokensFromEscrow(
              order.userId,
              null,
              'CES',
              order.escrowAmount,
              `Automatic cleanup: expired cancelled order ${order._id}`
            );
            
            // Обновить ордер
            order.escrowLocked = false;
            order.escrowAmount = 0;
            await order.save();
            
            console.log(`✅ Cleaned expired order escrow: ${order._id}`);
            fixedCount++;
          }
        } catch (orderError) {
          console.error(`❌ Failed to clean expired order ${order._id}:`, orderError);
        }
      }
      
      return fixedCount;
    } catch (error) {
      console.error('Error cleaning expired order escrows:', error);
      return 0;
    }
  }

  // Валидация эскроу активных сделок
  async validateActiveTradeEscrows() {
    try {
      let fixedCount = 0;
      
      // Найти активные сделки старше 2 часов
      const staleTrades = await P2PTrade.find({
        status: { $in: ['escrow_locked', 'payment_pending'] },
        'timeTracking.createdAt': { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
      }).populate('sellerId buyerId');

      for (const trade of staleTrades) {
        try {
          // Check if trade and required fields exist
          if (!trade || !trade._id || !trade.timeTracking) {
            console.log(`⚠️ Skipping invalid trade: ${trade?._id || 'null'} - missing required fields`);
            continue;
          }
          
          // Check if seller and buyer exist
          if (!trade.sellerId || !trade.sellerId._id) {
            console.log(`⚠️ Skipping trade ${trade._id} - missing seller information`);
            continue;
          }
          
          // Проверить, истек ли таймаут сделки
          const expiryTime = trade.timeTracking?.expiresAt || 
                            new Date(trade.timeTracking.createdAt.getTime() + 30 * 60 * 1000);
          
          if (Date.now() > expiryTime.getTime()) {
            console.log(`🔍 Found expired trade: ${trade._id}`);
            
            // Отменить просроченную сделку
            await escrowService.refundTokensFromEscrow(
              trade.sellerId._id,
              trade._id,
              'CES',
              trade.amount,
              'Automatic cleanup: trade timeout exceeded'
            );
            
            trade.status = 'cancelled';
            trade.escrowStatus = 'returned';
            trade.disputeReason = 'Automatic timeout cleanup';
            await trade.save();
            
            console.log(`✅ Cleaned expired trade: ${trade._id}`);
            fixedCount++;
          }
        } catch (tradeError) {
          console.error(`❌ Failed to validate trade ${trade._id}:`, tradeError);
        }
      }
      
      return fixedCount;
    } catch (error) {
      console.error('Error validating active trade escrows:', error);
      return 0;
    }
  }

  // Получение статистики эскроу
  async getCleanupStatistics() {
    try {
      const stats = {
        totalUsers: await User.countDocuments({ walletAddress: { $exists: true } }),
        totalEscrowTransactions: await EscrowTransaction.countDocuments(),
        activeEscrows: await EscrowTransaction.countDocuments({ type: 'lock', status: 'completed' }),
        orphanedEscrows: 0,
        staleTrades: 0,
        expiredOrders: 0
      };
      
      // Подсчет сиротских эскроу
      const orphanedEscrows = await EscrowTransaction.find({
        type: 'lock',
        status: 'completed',
        tradeId: null,
        createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      stats.orphanedEscrows = orphanedEscrows.length;
      
      // Подсчет просроченных сделок
      stats.staleTrades = await P2PTrade.countDocuments({
        status: { $in: ['escrow_locked', 'payment_pending'] },
        'timeTracking.createdAt': { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
      });
      
      // Подсчет истекших ордеров
      stats.expiredOrders = await P2POrder.countDocuments({
        status: 'cancelled',
        escrowLocked: true,
        escrowAmount: { $gt: 0 },
        updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting cleanup statistics:', error);
      return null;
    }
  }
}

module.exports = new EscrowCleanupService();