/**
 * Escrow Service
 * Handles secure escrow functionality for P2P trading
 * Provides maximum security for P2P exchanges with automated dispute resolution
 */

const { User, P2PTrade, EscrowTransaction } = require('../database/models');
const walletService = require('./walletService');
const smartContractService = require('./smartContractService');

class EscrowService {
  constructor() {
    this.escrowTimeoutMinutes = 30; // Default timeout for escrow
    this.disputeTimeoutMinutes = 24 * 60; // 24 hours for dispute resolution
    
    // Check smart contract configuration
    this.useSmartContract = process.env.USE_SMART_CONTRACT_ESCROW === 'true';
    this.escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    
    // Log current configuration
    this.logConfiguration();
  }

  // Log current escrow configuration
  logConfiguration() {
    console.log('\n🔧 Escrow Service Configuration:');
    console.log('================================');
    
    if (this.useSmartContract) {
      if (this.escrowContractAddress && this.escrowContractAddress !== '') {
        console.log('✅ SECURE MODE: Smart contract escrow ENABLED');
        console.log(`📋 Contract address: ${this.escrowContractAddress}`);
        console.log('🛡️ Tokens will be physically locked in smart contract');
        console.log('🚫 Users CANNOT bypass escrow security');
      } else {
        console.log('⚠️ WARNING: Smart contract enabled but no contract address!');
        console.log('❌ Falling back to DATABASE-ONLY mode (NOT SECURE)');
        this.useSmartContract = false;
      }
    } else {
      console.log('🚨 INSECURE MODE: Database-only escrow');
      console.log('⚠️ Users CAN bypass escrow by exporting private key');
      console.log('🔧 To enable secure mode: SET USE_SMART_CONTRACT_ESCROW=true');
    }
    
    console.log(`⏰ Escrow timeout: ${this.escrowTimeoutMinutes} minutes`);
    console.log('================================\n');
  }

  // Lock tokens in escrow for a trade (SECURE VERSION)
  async lockTokensInEscrow(userId, tradeId, tokenType, amount) {
    try {
      console.log(`🔒 Locking ${amount} ${tokenType} in escrow for user ${userId}, trade ${tradeId}`);
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Check if user has enough balance
      const currentBalance = tokenType === 'CES' ? user.cesBalance : user.polBalance;
      if (currentBalance < amount) {
        throw new Error(`Недостаточно средств. Доступно: ${currentBalance.toFixed(4)} ${tokenType}`);
      }

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
      
      // Получаем адрес покупателя (временно используем админский адрес как placeholder)
      const buyerAddress = '0xC2D5FABd53F537A1225460AE30097198aB14FF32'; // TODO: получать из сделки
      
      // Создаем эскроу в смарт-контракте
      const escrowResult = await smartContractService.createSmartEscrow(
        privateKey,
        buyerAddress,
        amount,
        this.escrowTimeoutMinutes
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

      // Execute blockchain transfer from seller to buyer
      const transferResult = await this.executeEscrowTransfer(seller, buyer, tokenType, amount);

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
        txHash: transferResult.txHash,
        reason: 'Released after successful P2P trade',
        completedAt: new Date()
      });

      await escrowTx.save();

      console.log(`✅ Successfully released ${amount} ${tokenType} from escrow`);
      return {
        success: true,
        txHash: transferResult.txHash,
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
      console.log(`↩️ Refunding ${amount} ${tokenType} from escrow for user ${userId}`);
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Check escrow balance
      const escrowBalance = tokenType === 'CES' ? user.escrowCESBalance : user.escrowPOLBalance;
      if (escrowBalance < amount) {
        throw new Error(`Недостаточно средств в эскроу для возврата`);
      }

      // Move tokens back from escrow to regular balance
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
        reason: reason,
        completedAt: new Date()
      });

      await escrowTx.save();

      console.log(`✅ Successfully refunded ${amount} ${tokenType} to user`);
      return {
        success: true,
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

  // Automated escrow timeout handler
  async handleEscrowTimeout(tradeId) {
    try {
      console.log(`⏰ Handling escrow timeout for trade ${tradeId}`);

      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');

      if (!trade) {
        console.log(`Trade ${tradeId} not found`);
        return;
      }

      if (trade.status === 'completed') {
        console.log(`Trade ${tradeId} already completed`);
        return;
      }

      // Check if payment was confirmed
      if (trade.status === 'payment_confirmed') {
        // Release tokens to buyer
        await this.releaseTokensFromEscrow(
          trade.sellerId._id,
          tradeId,
          'CES',
          trade.amount,
          trade.buyerId._id
        );

        trade.status = 'completed';
        trade.escrowStatus = 'released';
        trade.timeTracking.completedAt = new Date();
        await trade.save();

        console.log(`✅ Trade ${tradeId} completed after timeout with payment confirmation`);

      } else {
        // Refund tokens to seller
        await this.refundTokensFromEscrow(
          trade.sellerId._id,
          tradeId,
          'CES',
          trade.amount,
          'Trade timeout - payment not confirmed'
        );

        trade.status = 'cancelled';
        trade.escrowStatus = 'refunded';
        await trade.save();

        console.log(`↩️ Trade ${tradeId} cancelled and refunded after timeout`);
      }

    } catch (error) {
      console.error('Error handling escrow timeout:', error);
    }
  }

  // Manual dispute resolution
  async resolveDispute(tradeId, resolution, moderatorId) {
    try {
      console.log(`⚖️ Resolving dispute for trade ${tradeId}, resolution: ${resolution}`);

      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');

      if (!trade) {
        throw new Error('Сделка не найдена');
      }

      if (trade.status !== 'disputed') {
        throw new Error('Сделка не находится в состоянии спора');
      }

      trade.moderatorId = moderatorId;

      if (resolution === 'buyer_wins') {
        // Release tokens to buyer
        await this.releaseTokensFromEscrow(
          trade.sellerId._id,
          tradeId,
          'CES',
          trade.amount,
          trade.buyerId._id
        );

        trade.status = 'completed';
        trade.escrowStatus = 'released';

      } else if (resolution === 'seller_wins') {
        // Refund tokens to seller
        await this.refundTokensFromEscrow(
          trade.sellerId._id,
          tradeId,
          'CES',
          trade.amount,
          'Dispute resolved in favor of seller'
        );

        trade.status = 'cancelled';
        trade.escrowStatus = 'refunded';
      }

      trade.timeTracking.completedAt = new Date();
      await trade.save();

      console.log(`✅ Dispute resolved for trade ${tradeId}: ${resolution}`);
      return trade;

    } catch (error) {
      console.error('Error resolving dispute:', error);
      throw error;
    }
  }

  // Get system escrow statistics
  async getEscrowStatistics() {
    try {
      const [totalEscrowCES, totalEscrowPOL, activeEscrowTx, totalVolume] = await Promise.all([
        User.aggregate([{ $group: { _id: null, total: { $sum: '$escrowCESBalance' } } }]),
        User.aggregate([{ $group: { _id: null, total: { $sum: '$escrowPOLBalance' } } }]),
        EscrowTransaction.countDocuments({ status: 'pending' }),
        EscrowTransaction.aggregate([
          { $match: { status: 'completed', type: 'release' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      return {
        totalEscrowCES: totalEscrowCES[0]?.total || 0,
        totalEscrowPOL: totalEscrowPOL[0]?.total || 0,
        activeEscrowTransactions: activeEscrowTx,
        totalVolumeProcessed: totalVolume[0]?.total || 0
      };

    } catch (error) {
      console.error('Error getting escrow statistics:', error);
      throw error;
    }
  }
}

module.exports = new EscrowService();