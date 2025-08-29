/**
 * Core Escrow Service
 * Handles basic escrow operations: locking, releasing, and refunding tokens
 */

const { User, EscrowTransaction } = require('../../../database/models');
const walletService = require('../../wallet/walletService');
const smartContractService = require('../../smartContractService');
const config = require('../../../config/configuration');

class CoreEscrowService {
  constructor(parentService) {
    this.parentService = parentService;
    this.escrowTimeoutMinutes = config.escrow.timeoutMinutes;
    this.useSmartContract = config.escrow.useSmartContract;
    this.escrowContractAddress = config.escrow.contractAddress;
  }

  // Lock tokens in escrow for a trade (SECURE VERSION)
  async lockTokensInEscrow(userId, tradeId, tokenType, amount) {
    try {
      console.log(`🔒 [ESCROW-LOCK] Starting escrow lock: ${amount} ${tokenType} for user ${userId}, trade ${tradeId}`);
      
      // 🔧 ИСПРАВЛЕНИЕ: Дополнительная валидация
      if (!userId) {
        throw new Error('Отсутствует userId');
      }
      
      if (amount <= 0) {
        throw new Error('Количество должно быть больше 0');
      }
      
      if (!['CES', 'POL'].includes(tokenType)) {
        throw new Error('Неподдерживаемый тип токена');
      }
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      console.log(`🔍 [ESCROW-LOCK] User ${userId} (${user.chatId}) current balances:`);
      console.log(`   Available: ${(tokenType === 'CES' ? user.cesBalance : user.polBalance) || 0} ${tokenType}`);
      console.log(`   Escrowed: ${(tokenType === 'CES' ? user.escrowCESBalance : user.escrowPOLBalance) || 0} ${tokenType}`);

      // Check if user has enough balance
      const currentBalance = tokenType === 'CES' ? user.cesBalance : user.polBalance;
      if (currentBalance < amount) {
        const error = `Недостаточно средств. Доступно: ${currentBalance.toFixed(4)} ${tokenType}`;
        console.log(`❌ [ESCROW-LOCK] ${error}`);
        throw new Error(error);
      }
      
      console.log(`✅ [ESCROW-LOCK] Balance validation passed`);

      // БЕЗОПАСНЫЙ ПУТЬ: Используем смарт-контракт
      if (this.useSmartContract && tokenType === 'CES' && this.escrowContractAddress) {
        console.log(`🔐 Using SECURE smart contract escrow at ${this.escrowContractAddress}`);
        return await this.lockTokensInSmartContract(userId, tradeId, amount, user);
      }
      
      // НЕБЕЗОПАСНЫЙ ПУТЬ: Только обновление БД (для совместимости)
      console.log('⚠️ WARNING: Using DATABASE-ONLY escrow (NOT SECURE)');
      console.log('⚠️ Users can bypass this escrow by exporting private key!');
      return await this.lockTokensInDatabase(userId, tradeId, tokenType, amount, user);

    } catch (error) {
      console.error('Error locking tokens in escrow:', error);
      throw error;
    }
  }

  // БЕЗОПАСНАЯ блокировка через смарт-контракт
  async lockTokensInSmartContract(userId, tradeId, amount, user) {
    try {
      console.log(`🔐 SECURE: Locking ${amount} CES in smart contract escrow`);
      
      // Получаем приватный ключ пользователя
      const privateKey = await walletService.getUserPrivateKey(user.chatId);
      
      // TODO: ИСПРАВЛЕНИЕ - Получаем настоящий адрес покупателя из сделки
      let buyerAddress;
      
      if (tradeId) {
        // Если это для сделки, получаем адрес покупателя
        const trade = await P2PTrade.findById(tradeId).populate('buyerId');
        if (trade && trade.buyerId && trade.buyerId.walletAddress) {
          buyerAddress = trade.buyerId.walletAddress;
        } else {
          throw new Error('Не удалось получить адрес покупателя из сделки. Убедитесь, что у покупателя создан кошелек.');
        }
      } else {
        // Для ордеров используем админский адрес как placeholder
        buyerAddress = '0xC2D5FABd53F537A1225460AE30097198aB14FF32';
        console.log('⚠️ Using admin address as buyer placeholder for order escrow');
      }
      
      // Создаем эскроу в смарт-контракте
      // ИСПРАВЛЕНИЕ: Гарантируем минимум 30 минут для смарт-контракта
      const smartContractMinMinutes = 30; // Минимум по требованиям смарт-контракта
      const actualTimeoutMinutes = Math.max(this.escrowTimeoutMinutes, smartContractMinMinutes);
      
      console.log(`⏰ Escrow timeout: requested ${this.escrowTimeoutMinutes} min, using ${actualTimeoutMinutes} min (min: ${smartContractMinMinutes})`);
      
      const escrowResult = await smartContractService.createSmartEscrow(
        privateKey,
        buyerAddress,
        amount,
        actualTimeoutMinutes
      );
      
      if (!escrowResult.success) {
        throw new Error('Ошибка создания смарт-контракт эскроу');
      }
      
      // Обновляем БД (токены уже реально заблокированы в контракте)
      user.cesBalance -= amount;
      user.escrowCESBalance += amount;
      await user.save();

      // Создаем запись транзакции эскроу
      const escrowTx = new EscrowTransaction({
        userId: userId,
        tradeId: tradeId,
        type: 'lock',
        tokenType: 'CES',
        amount: amount,
        status: 'completed',
        txHash: escrowResult.txHash,
        smartContractEscrowId: escrowResult.escrowId,
        reason: 'Locked in smart contract for P2P trade',
        completedAt: new Date()
      });

      await escrowTx.save();

      console.log(`✅ SECURE: Successfully locked ${amount} CES in smart contract escrow`);
      console.log(`📄 Smart contract escrow ID: ${escrowResult.escrowId}`);
      console.log(`🔗 Transaction hash: ${escrowResult.txHash}`);
      
      return {
        success: true,
        escrowTxId: escrowTx._id,
        smartContractEscrowId: escrowResult.escrowId,
        txHash: escrowResult.txHash,
        newBalance: user.cesBalance,
        escrowBalance: user.escrowCESBalance
      };
      
    } catch (error) {
      console.error('Error in smart contract escrow:', error);
      throw new Error(`Ошибка безопасного эскроу: ${error.message}`);
    }
  }

  // НЕБЕЗОПАСНАЯ блокировка только в БД (для совместимости)
  async lockTokensInDatabase(userId, tradeId, tokenType, amount, user) {
    try {
      console.log(`⚠️ DATABASE-ONLY: Locking ${amount} ${tokenType} (NOT SECURE)`);
      
      // Move tokens from regular balance to escrow
      if (tokenType === 'CES') {
        user.cesBalance -= amount;
        user.escrowCESBalance += amount;
      } else {
        user.polBalance -= amount;
        user.escrowPOLBalance += amount;
      }

      await user.save();

      // Create escrow transaction record
      const escrowTx = new EscrowTransaction({
        userId: userId,
        tradeId: tradeId,
        type: 'lock',
        tokenType: tokenType,
        amount: amount,
        status: 'completed',
        reason: 'Locked in database only (NOT SECURE)',
        completedAt: new Date()
      });

      await escrowTx.save();

      console.log(`⚠️ Successfully locked ${amount} ${tokenType} in database only`);
      
      // Validate balance consistency after lock
      try {
        const balanceValidationService = require('../../validation/BalanceValidationService');
        const validationService = new balanceValidationService(this.parentService);
        await validationService.validateAfterEscrowOperation(
          userId, 
          'lock', 
          amount, 
          tokenType
        );
      } catch (validationError) {
        console.warn('⚠️ Balance validation after lock failed:', validationError.message);
      }
      
      return {
        success: true,
        escrowTxId: escrowTx._id,
        newBalance: tokenType === 'CES' ? user.cesBalance : user.polBalance,
        escrowBalance: tokenType === 'CES' ? user.escrowCESBalance : user.escrowPOLBalance
      };
      
    } catch (error) {
      console.error('Error in database escrow:', error);
      throw error;
    }
  }

  // Release tokens from escrow (complete trade)
  async releaseTokensFromEscrow(userId, tradeId, tokenType, amount, recipientId) {
    try {
      console.log(`🔓 Releasing ${amount} ${tokenType} from escrow for trade ${tradeId}`);
      
      const [seller, buyer] = await Promise.all([
        User.findById(userId),
        User.findById(recipientId)
      ]);

      if (!seller || !buyer) {
        throw new Error('Участники сделки не найдены');
      }

      // Check escrow balance
      const escrowBalance = tokenType === 'CES' ? seller.escrowCESBalance : seller.escrowPOLBalance;
      if (escrowBalance < amount) {
        throw new Error(`Недостаточно средств в эскроу. Доступно: ${escrowBalance.toFixed(4)} ${tokenType}`);
      }

      // Check if this is a smart contract escrow by looking for the escrow transaction
      let smartContractEscrowId = null;
      let releaseResult = null;
      
      if (tradeId && tokenType === 'CES' && this.useSmartContract && this.escrowContractAddress) {
        // Look for the lock transaction with smart contract escrow ID
        const lockTx = await EscrowTransaction.findOne({
          userId: userId,
          tradeId: tradeId,
          type: 'lock',
          tokenType: 'CES',
          smartContractEscrowId: { $exists: true, $ne: null }
        });
        
        if (lockTx) {
          smartContractEscrowId = lockTx.smartContractEscrowId;
          console.log(`🔐 Found smart contract escrow ID: ${smartContractEscrowId}`);
          
          // Release tokens from smart contract escrow
          const smartContractService = require('../../contract/SmartContractEscrowService');
          const contractService = new smartContractService(this.parentService);
          const sellerPrivateKey = await walletService.getUserPrivateKey(seller.chatId);
          
          releaseResult = await contractService.releaseSmartEscrow(
            smartContractEscrowId,
            sellerPrivateKey
          );
          
          console.log(`✅ Successfully released ${amount} ${tokenType} from smart contract escrow`);
        }
      }
      
      // If not a smart contract escrow or smart contract release failed, use direct transfer
      if (!releaseResult) {
        console.log('🔄 Using direct wallet transfer for escrow release');
        // Execute blockchain transfer from seller to buyer
        releaseResult = await this.executeEscrowTransfer(seller, buyer, tokenType, amount);
      }

      // Update escrow balances
      if (tokenType === 'CES') {
        seller.escrowCESBalance -= amount;
      } else {
        seller.escrowPOLBalance -= amount;
      }

      await seller.save();

      // Create escrow transaction record
      const escrowTx = new EscrowTransaction({
        userId: userId,
        tradeId: tradeId,
        type: 'release',
        tokenType: tokenType,
        amount: amount,
        status: 'completed',
        txHash: releaseResult.txHash,
        smartContractEscrowId: smartContractEscrowId,
        reason: smartContractEscrowId 
          ? 'Released from smart contract escrow after successful P2P trade' 
          : 'Released after successful P2P trade',
        completedAt: new Date()
      });

      await escrowTx.save();

      console.log(`✅ Successfully released ${amount} ${tokenType} from escrow`);
      
      // Validate balance consistency after release
      try {
        const balanceValidationService = require('../../validation/BalanceValidationService');
        const validationService = new balanceValidationService(this.parentService);
        await validationService.validateAfterEscrowOperation(
          userId, 
          'release', 
          amount, 
          tokenType
        );
      } catch (validationError) {
        console.warn('⚠️ Balance validation after release failed:', validationError.message);
      }
      
      return {
        success: true,
        txHash: releaseResult.txHash,
        escrowTxId: escrowTx._id,
        sellerEscrowBalance: tokenType === 'CES' ? seller.escrowCESBalance : seller.escrowPOLBalance
      };

    } catch (error) {
      console.error('Error releasing tokens from escrow:', error);
      throw error;
    }
  }

  // Refund tokens from escrow (cancel trade)
  async refundTokensFromEscrow(userId, tradeId, tokenType, amount, reason = 'Trade cancelled') {
    try {
      console.log(`↩️ [ESCROW-REFUND] Starting refund: ${amount} ${tokenType} for user ${userId}, trade ${tradeId}`);
      console.log(`🔍 [ESCROW-REFUND] Reason: ${reason}`);
      
      const user = await User.findById(userId);
      if (!user) {
        const error = 'Пользователь не найден';
        console.log(`❌ [ESCROW-REFUND] ${error}`);
        throw new Error(error);
      }
      
      console.log(`🔍 [ESCROW-REFUND] User ${userId} (${user.chatId}) current balances:`);
      console.log(`   Available: ${(tokenType === 'CES' ? user.cesBalance : user.polBalance) || 0} ${tokenType}`);
      console.log(`   Escrowed: ${(tokenType === 'CES' ? user.escrowCESBalance : user.escrowPOLBalance) || 0} ${tokenType}`);

      // Check escrow balance
      const escrowBalance = tokenType === 'CES' ? user.escrowCESBalance : user.escrowPOLBalance;
      if (escrowBalance < amount) {
        const error = `Недостаточно средств в эскроу для возврата. Доступно: ${escrowBalance.toFixed(4)} ${tokenType}, требуется: ${amount.toFixed(4)} ${tokenType}`;
        console.log(`❌ [ESCROW-REFUND] ${error}`);
        throw new Error(error);
      }

      // Check if this is a smart contract escrow by looking for the escrow transaction
      let smartContractEscrowId = null;
      let refundResult = null;
      
      if (tokenType === 'CES' && this.useSmartContract && this.escrowContractAddress) {
        // Look for the lock transaction with smart contract escrow ID
        // For order cancellations (tradeId is null), look for transactions without tradeId
        // For trade cancellations (tradeId is not null), look for transactions with tradeId
        const lockTxQuery = {
          userId: userId,
          type: 'lock',
          tokenType: 'CES',
          smartContractEscrowId: { $exists: true, $ne: null }
        };
        
        // Add tradeId condition if it exists
        if (tradeId) {
          lockTxQuery.tradeId = tradeId;
        } else {
          // For order cancellations, look for transactions without tradeId
          lockTxQuery.tradeId = null;
        }
        
        // Sort by creation date descending to get the most recent transaction
        const lockTx = await EscrowTransaction.findOne(lockTxQuery).sort({ createdAt: -1 });
        
        if (lockTx) {
          smartContractEscrowId = lockTx.smartContractEscrowId;
          console.log(`🔐 Found smart contract escrow ID: ${smartContractEscrowId}`);
          
          try {
            // First check if the escrow can be refunded
            const smartContractService = require('../../contract/SmartContractEscrowService');
            const contractService = new smartContractService(this.parentService);
            const refundCheck = await contractService.canRefundEscrow(smartContractEscrowId);
            
            if (!refundCheck.canRefund) {
              if (refundCheck.error) {
                throw new Error(`Cannot check escrow status: ${refundCheck.error}`);
              } else {
                // Check if there's already a refund transaction for this escrow
                const existingRefund = await EscrowTransaction.findOne({
                  userId: userId,
                  type: 'refund',
                  smartContractEscrowId: smartContractEscrowId
                });
                
                if (existingRefund) {
                  console.log(`⚠️ Escrow ${smartContractEscrowId} was already refunded (transaction ${existingRefund._id})`);
                  throw new Error(`Escrow was already refunded. Status: ${refundCheck.statusText}`);
                } else {
                  throw new Error(`Escrow cannot be refunded. Status: ${refundCheck.statusText}`);
                }
              }
            }
            
            console.log(`🔍 Smart contract escrow ${smartContractEscrowId} status: ${refundCheck.statusText}, can refund: ${refundCheck.canRefund}`);
            
            // Proceed with refund
            const walletService = require('../../wallet/walletService');
            const userPrivateKey = await walletService.getUserPrivateKey(user.chatId);
            
            refundResult = await contractService.refundSmartEscrow(
              smartContractEscrowId,
              userPrivateKey
            );
            
            console.log(`✅ Successfully refunded ${amount} ${tokenType} from smart contract escrow`);
          } catch (smartContractError) {
            console.error('❌ Smart contract refund failed:', smartContractError);
            console.error(`⚠️ MANUAL INTERVENTION REQUIRED: Failed to refund ${amount} CES from smart contract escrow ${smartContractEscrowId}`);
            
            // Try to use admin key as fallback
            try {
              console.log('🔄 Attempting fallback with admin key...');
              const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
              if (adminPrivateKey) {
                const contractService = new smartContractService(this.parentService);
                refundResult = await contractService.refundSmartEscrow(
                  smartContractEscrowId,
                  adminPrivateKey
                );
                console.log(`✅ Successfully refunded ${amount} ${tokenType} from smart contract escrow using admin key`);
              } else {
                console.log('❌ Admin private key not available for fallback');
              }
            } catch (adminRefundError) {
              console.error('❌ Admin key refund also failed:', adminRefundError);
              
              // For smart contract escrow, we must not update database if blockchain refund fails
              // This prevents balance discrepancies
              throw new Error(`Smart contract refund failed: ${smartContractError.message}. Manual intervention required for escrow ID ${smartContractEscrowId}`);
            }
          }
        }
      }

      // Update database balances (move tokens back from escrow to regular balance)
      if (tokenType === 'CES') {
        user.escrowCESBalance -= amount;
        user.cesBalance += amount;
      } else {
        user.escrowPOLBalance -= amount;
        user.polBalance += amount;
      }

      await user.save();

      // Create escrow transaction record
      const escrowTx = new EscrowTransaction({
        userId: userId,
        tradeId: tradeId,
        type: 'refund',
        tokenType: tokenType,
        amount: amount,
        status: 'completed',
        txHash: refundResult?.txHash,
        smartContractEscrowId: smartContractEscrowId,
        reason: smartContractEscrowId 
          ? `Refunded from smart contract escrow: ${reason}` 
          : reason,
        completedAt: new Date()
      });

      await escrowTx.save();

      console.log(`✅ Successfully refunded ${amount} ${tokenType} to user`);
      
      // Validate balance consistency after refund
      try {
        const balanceValidationService = require('../../validation/BalanceValidationService');
        const validationService = new balanceValidationService(this.parentService);
        await validationService.validateAfterEscrowOperation(
          userId, 
          'refund', 
          amount, 
          tokenType
        );
      } catch (validationError) {
        console.warn('⚠️ Balance validation after refund failed:', validationError.message);
      }
      
      return {
        success: true,
        txHash: refundResult?.txHash,
        escrowTxId: escrowTx._id,
        newBalance: tokenType === 'CES' ? user.cesBalance : user.polBalance,
        escrowBalance: tokenType === 'CES' ? user.escrowCESBalance : user.escrowPOLBalance
      };

    } catch (error) {
      console.error('Error refunding tokens from escrow:', error);
      throw error;
    }
  }

  // Execute blockchain transfer from escrow
  async executeEscrowTransfer(seller, buyer, tokenType, amount) {
    try {
      console.log(`🔗 Executing blockchain transfer: ${amount} ${tokenType} from ${seller.walletAddress} to ${buyer.walletAddress}`);

      if (tokenType === 'CES') {
        return await walletService.sendCESTokens(seller.chatId, buyer.walletAddress, amount);
      } else {
        return await walletService.sendPOLTokens(seller.chatId, buyer.walletAddress, amount);
      }

    } catch (error) {
      console.error('Escrow blockchain transfer failed:', error);
      throw new Error(`Ошибка перевода токенов: ${error.message}`);
    }
  }

  // Update escrow trade ID after trade creation
  async updateEscrowTradeId(userId, tokenType, amount, tradeId) {
    try {
      console.log(`🔄 [ESCROW-UPDATE] Updating trade ID for escrow: user ${userId}, ${amount} ${tokenType}, trade ${tradeId}`);
      
      // Find the most recent escrow transaction without trade ID for this user and amount
      const escrowTx = await EscrowTransaction.findOne({
        userId: userId,
        tokenType: tokenType,
        amount: amount,
        type: 'lock',
        status: 'completed',
        tradeId: { $in: [null, undefined] }, // Escrow without trade ID
      }).sort({ createdAt: -1 }); // Get the most recent one
      
      if (!escrowTx) {
        console.warn(`⚠️ [ESCROW-UPDATE] No matching escrow transaction found for user ${userId}, ${amount} ${tokenType}`);
        return { success: false, error: 'Escrow transaction not found' };
      }
      
      // Update trade ID
      escrowTx.tradeId = tradeId;
      await escrowTx.save();
      
      console.log(`✅ [ESCROW-UPDATE] Successfully updated escrow transaction ${escrowTx._id} with trade ID ${tradeId}`);
      return { success: true, escrowTxId: escrowTx._id };
      
    } catch (error) {
      console.error('Error updating escrow trade ID:', error);
      return { success: false, error: error.message };
    }
  }

  // Link existing escrow to trade
  async linkEscrowToTrade(userId, tradeId, tokenType, amount) {
    try {
      console.log(`🔗 Linking escrow to trade ${tradeId}`);
      
      // Find and update the most recent lock transaction for this user
      const escrowTx = await EscrowTransaction.findOneAndUpdate(
        {
          userId: userId,
          type: 'lock',
          tokenType: tokenType,
          amount: amount,
          tradeId: null
        },
        {
          tradeId: tradeId
        },
        { sort: { createdAt: -1 } }
      );
      
      if (escrowTx) {
        console.log(`✅ Linked escrow transaction ${escrowTx._id} to trade ${tradeId}`);
      }
      
      return escrowTx;
      
    } catch (error) {
      console.error('Error linking escrow to trade:', error);
      throw error;
    }
  }

  // Check if user has sufficient escrow balance
  async checkEscrowBalance(userId, tokenType, amount) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { hasBalance: false, error: 'Пользователь не найден' };
      }

      const escrowBalance = tokenType === 'CES' ? user.escrowCESBalance : user.escrowPOLBalance;
      const hasBalance = escrowBalance >= amount;

      return {
        hasBalance,
        currentBalance: escrowBalance,
        requiredAmount: amount,
        shortfall: hasBalance ? 0 : amount - escrowBalance
      };

    } catch (error) {
      console.error('Error checking escrow balance:', error);
      return { hasBalance: false, error: error.message };
    }
  }

  // Get user's escrow transaction history
  async getEscrowHistory(userId, limit = 10) {
    try {
      const transactions = await EscrowTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('tradeId');

      return transactions;

    } catch (error) {
      console.error('Error getting escrow history:', error);
      throw error;
    }
  }
}

module.exports = CoreEscrowService;