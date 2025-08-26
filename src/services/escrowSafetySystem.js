/**
 * Enhanced Escrow Safety System
 * Предотвращает заморозку средств при отмене сделок
 */

const { EscrowTransaction, P2PTrade, User } = require('../database/models');

class EscrowSafetySystem {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 секунд
  }

  /**
   * Безопасная отмена сделки с проверками
   */
  async safeCancelTrade(tradeId, reason, userChatId) {
    try {
      console.log(`🛡️ [SAFETY] Starting safe trade cancellation: ${tradeId}`);
      
      // 1. Получаем сделку с полной информацией
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        throw new Error('Сделка не найдена');
      }
      
      // 2. Проверяем, что пользователь является участником
      const isParticipant = trade.buyerId.chatId === userChatId || trade.sellerId.chatId === userChatId;
      if (!isParticipant) {
        throw new Error('Вы не являетесь участником этой сделки');
      }
      
      // 3. Проверяем статус сделки
      if (!['escrow_locked', 'payment_pending'].includes(trade.status)) {
        throw new Error('Сделка не может быть отменена в текущем статусе');
      }
      
      console.log(`🔍 [SAFETY] Trade validation passed, proceeding with escrow refund`);
      
      // 4. Проверяем эскроу транзакции
      const escrowTx = await EscrowTransaction.findOne({
        tradeId: tradeId,
        type: 'lock',
        tokenType: 'CES',
        status: 'completed'
      });
      
      if (!escrowTx) {
        console.log(`⚠️ [SAFETY] No escrow transaction found for trade ${tradeId}`);
        // Сделка может быть отменена без возврата эскроу
        return await this.updateTradeStatus(trade, reason);
      }
      
      // 5. Безопасный возврат средств
      const refundResult = await this.safeRefundEscrow(escrowTx, trade, reason);
      
      // 6. Обновляем статус сделки только если возврат успешен
      if (refundResult.success) {
        return await this.updateTradeStatus(trade, reason);
      } else {
        // Если возврат не удался, сделка остается в текущем статусе
        throw new Error(`Не удалось вернуть средства: ${refundResult.error}`);
      }
      
    } catch (error) {
      console.error(`❌ [SAFETY] Safe trade cancellation failed:`, error);
      throw error;
    }
  }

  /**
   * Безопасный возврат эскроу с повторными попытками
   */
  async safeRefundEscrow(escrowTx, trade, reason) {
    console.log(`🔄 [SAFETY] Starting safe escrow refund for trade ${trade._id}`);
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`🔄 [SAFETY] Refund attempt ${attempt}/${this.retryAttempts}`);
        
        // 1. Проверяем текущий статус смартконтракта (если используется)
        if (escrowTx.smartContractEscrowId) {
          const statusCheck = await this.checkSmartContractStatus(escrowTx.smartContractEscrowId);
          
          if (!statusCheck.canRefund) {
            if (statusCheck.alreadyRefunded) {
              console.log(`✅ [SAFETY] Escrow already refunded in smart contract`);
              // Обновляем базу данных для синхронизации
              return await this.syncDatabaseAfterRefund(escrowTx, trade.sellerId._id, reason);
            } else {
              throw new Error(`Escrow cannot be refunded: ${statusCheck.reason}`);
            }
          }
        }
        
        // 2. Выполняем возврат через сервис эскроу
        const escrowService = require('./escrowService');
        await escrowService.refundTokensFromEscrow(
          trade.sellerId._id,
          trade._id,
          'CES',
          trade.amount,
          reason
        );
        
        console.log(`✅ [SAFETY] Escrow refund successful on attempt ${attempt}`);
        return { success: true };
        
      } catch (error) {
        console.error(`❌ [SAFETY] Refund attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.retryAttempts) {
          // Последняя попытка не удалась
          console.error(`❌ [SAFETY] All refund attempts failed for trade ${trade._id}`);
          
          // Проверяем, требуется ли ручное вмешательство
          if (error.message.includes('Smart contract refund failed') || 
              error.message.includes('Manual intervention required')) {
            
            // Создаем запись для ручного вмешательства
            await this.createManualInterventionRecord(escrowTx, trade, error.message);
            
            return {
              success: false,
              error: 'Требуется ручное вмешательство администратора',
              requiresManualIntervention: true,
              escrowId: escrowTx.smartContractEscrowId
            };
          }
          
          return { success: false, error: error.message };
        }
        
        // Ждем перед следующей попыткой
        await this.sleep(this.retryDelay);
      }
    }
  }

  /**
   * Проверка статуса смартконтракта
   */
  async checkSmartContractStatus(escrowId) {
    try {
      const smartContractService = require('./smartContractService');
      
      // Проверяем детали эскроу
      const escrowDetails = await smartContractService.getEscrowDetails(escrowId);
      
      // Статус 0 = Active, 1 = Released, 2 = Refunded
      if (escrowDetails.status === 2) {
        return { canRefund: false, alreadyRefunded: true, reason: 'Already refunded' };
      }
      
      if (escrowDetails.status === 1) {
        return { canRefund: false, alreadyRefunded: false, reason: 'Already released to buyer' };
      }
      
      if (escrowDetails.status === 0) {
        return { canRefund: true, alreadyRefunded: false, reason: 'Active and can be refunded' };
      }
      
      return { canRefund: false, alreadyRefunded: false, reason: `Unknown status: ${escrowDetails.status}` };
      
    } catch (error) {
      console.error(`❌ [SAFETY] Smart contract status check failed:`, error);
      throw new Error(`Cannot verify smart contract status: ${error.message}`);
    }
  }

  /**
   * Синхронизация базы данных после возврата
   */
  async syncDatabaseAfterRefund(escrowTx, userId, reason) {
    try {
      console.log(`🔄 [SAFETY] Syncing database after external refund`);
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found for sync');
      }
      
      // Обновляем балансы пользователя
      user.escrowCESBalance = Math.max(0, user.escrowCESBalance - escrowTx.amount);
      user.cesBalance += escrowTx.amount;
      await user.save();
      
      // Создаем новую транзакцию возврата
      const refundTx = new EscrowTransaction({
        userId: userId,
        tradeId: escrowTx.tradeId,
        type: 'refund',
        tokenType: 'CES',
        amount: escrowTx.amount,
        status: 'completed',
        smartContractEscrowId: escrowTx.smartContractEscrowId,
        reason: `Database sync: ${reason}`,
        completedAt: new Date()
      });
      
      await refundTx.save();
      
      console.log(`✅ [SAFETY] Database synced successfully`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ [SAFETY] Database sync failed:`, error);
      throw error;
    }
  }

  /**
   * Создание записи для ручного вмешательства
   */
  async createManualInterventionRecord(escrowTx, trade, errorMessage) {
    try {
      const interventionRecord = new EscrowTransaction({
        userId: trade.sellerId._id,
        tradeId: trade._id,
        type: 'manual_intervention_required',
        tokenType: 'CES',
        amount: trade.amount,
        status: 'pending',
        smartContractEscrowId: escrowTx.smartContractEscrowId,
        reason: `Manual intervention required: ${errorMessage}`,
        createdAt: new Date()
      });
      
      await interventionRecord.save();
      
      console.log(`📝 [SAFETY] Manual intervention record created: ${interventionRecord._id}`);
      return interventionRecord;
      
    } catch (error) {
      console.error(`❌ [SAFETY] Failed to create manual intervention record:`, error);
      throw error;
    }
  }

  /**
   * Обновление статуса сделки
   */
  async updateTradeStatus(trade, reason) {
    try {
      trade.status = 'cancelled';
      trade.escrowStatus = 'returned';
      trade.disputeReason = reason;
      trade.cancelledAt = new Date();
      
      await trade.save();
      
      console.log(`✅ [SAFETY] Trade ${trade._id} status updated to cancelled`);
      return { success: true, trade: trade };
      
    } catch (error) {
      console.error(`❌ [SAFETY] Failed to update trade status:`, error);
      throw error;
    }
  }

  /**
   * Вспомогательная функция задержки
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Автоматическая проверка зависших эскроу
   */
  async checkStuckEscrows() {
    try {
      console.log(`🔍 [SAFETY] Checking for stuck escrows...`);
      
      // Находим эскроу транзакции старше 1 часа без соответствующего возврата
      const stuckEscrows = await EscrowTransaction.find({
        type: 'lock',
        tokenType: 'CES',
        status: 'completed',
        createdAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }, // 1 час назад
        smartContractEscrowId: { $exists: true, $ne: null }
      });
      
      console.log(`🔍 [SAFETY] Found ${stuckEscrows.length} potential stuck escrows`);
      
      for (const escrowTx of stuckEscrows) {
        // Проверяем, есть ли соответствующий возврат
        const refundTx = await EscrowTransaction.findOne({
          tradeId: escrowTx.tradeId,
          type: 'refund',
          smartContractEscrowId: escrowTx.smartContractEscrowId
        });
        
        if (!refundTx) {
          console.log(`⚠️ [SAFETY] Found stuck escrow: ${escrowTx._id}, smart contract ID: ${escrowTx.smartContractEscrowId}`);
          
          // Проверяем статус в смартконтракте
          try {
            const statusCheck = await this.checkSmartContractStatus(escrowTx.smartContractEscrowId);
            
            if (statusCheck.alreadyRefunded) {
              console.log(`🔄 [SAFETY] Syncing stuck escrow ${escrowTx._id}`);
              await this.syncDatabaseAfterRefund(escrowTx, escrowTx.userId, 'Automatic sync of stuck escrow');
            }
          } catch (statusError) {
            console.error(`❌ [SAFETY] Cannot check status of stuck escrow ${escrowTx._id}:`, statusError);
          }
        }
      }
      
      console.log(`✅ [SAFETY] Stuck escrow check completed`);
      
    } catch (error) {
      console.error(`❌ [SAFETY] Stuck escrow check failed:`, error);
    }
  }
}

module.exports = new EscrowSafetySystem();