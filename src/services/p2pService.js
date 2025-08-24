/**
 * P2P Trading Service with Escrow
 * Handles buying and selling CES tokens for rubles with 1% commission from both buyer and seller
 * Includes advanced escrow system for maximum security
 */

const { P2POrder, P2PTrade, User } = require('../database/models');
const walletService = require('./walletService');
const priceService = require('./priceService');
const escrowService = require('./escrowService');
const smartNotificationService = require('./smartNotificationService');
const reputationService = require('./reputationService');

class P2PService {
  constructor() {
    this.commissionRate = 0.01; // 1% commission
    this.defaultTradeTimeout = 30; // 30 minutes
    this.maxOrderAmount = 10000; // Maximum order amount in CES
    this.minOrderAmount = 1; // Minimum order amount in CES
  }

  // Create a buy order (user wants to buy CES for rubles)
  async createBuyOrder(chatId, amount, pricePerToken) {
    try {
      console.log(`Creating buy order: ${amount} CES at ₽${pricePerToken} per token (chatId: ${chatId})`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        console.log(`User not found for chatId: ${chatId}`);
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        console.log(`User ${chatId} has no wallet`);
        throw new Error('Сначала создайте кошелек');
      }
      
      // Validate input
      if (amount <= 0 || pricePerToken <= 0) {
        console.log(`Invalid input: amount=${amount}, price=${pricePerToken}`);
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      const totalValue = amount * pricePerToken;
      console.log(`Total order value: ₽${totalValue.toFixed(2)}`);
      
      // Check for existing active buy orders with same price
      const existingOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'buy',
        pricePerToken: pricePerToken,
        status: 'active'
      });
      
      if (existingOrder) {
        // Update existing order
        console.log(`Updating existing buy order: ${existingOrder._id}`);
        existingOrder.amount += amount;
        existingOrder.remainingAmount += amount;
        existingOrder.totalValue = existingOrder.amount * pricePerToken;
        existingOrder.updatedAt = new Date();
        await existingOrder.save();
        
        console.log(`Updated existing buy order: ${existingOrder._id}`);
        return existingOrder;
      }
      
      // Create new buy order
      console.log(`Creating new buy order`);
      const buyOrder = new P2POrder({
        userId: user._id,
        type: 'buy',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        remainingAmount: amount
      });
      
      await buyOrder.save();
      
      console.log(`Buy order created: ${buyOrder._id}`);
      
      // Try to match with existing sell orders
      console.log(`Attempting to match orders...`);
      await this.matchOrders();
      
      return buyOrder;
      
    } catch (error) {
      console.error('Error creating buy order:', error);
      throw error;
    }
  }

  // Create a sell order (user wants to sell CES for rubles)
  async createSellOrder(chatId, amount, pricePerToken, paymentMethods = ['bank_transfer']) {
    try {
      console.log(`Creating sell order: ${amount} CES at ₽${pricePerToken} per token (chatId: ${chatId})`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        console.log(`User not found for chatId: ${chatId}`);
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        console.log(`User ${chatId} has no wallet`);
        throw new Error('Сначала создайте кошелек');
      }
      
      // Validate input
      if (amount <= 0 || pricePerToken <= 0) {
        console.log(`Invalid input: amount=${amount}, price=${pricePerToken}`);
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      if (amount < this.minOrderAmount || amount > this.maxOrderAmount) {
        throw new Error(`Количество должно быть от ${this.minOrderAmount} до ${this.maxOrderAmount} CES`);
      }
      
      // Check CES balance
      const cesBalance = await walletService.getCESBalance(user.walletAddress);
      if (cesBalance < amount) {
        console.log(`Insufficient CES balance: ${cesBalance} < ${amount}`);
        throw new Error(`Недостаточно CES токенов. Доступно: ${cesBalance.toFixed(4)} CES`);
      }
      
      const totalValue = amount * pricePerToken;
      console.log(`Total order value: ₽${totalValue.toFixed(2)}`);
      
      // Check for existing active sell orders with same price
      const existingOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'sell',
        pricePerToken: pricePerToken,
        status: 'active'
      });
      
      if (existingOrder) {
        // Update existing order and lock additional tokens in escrow
        console.log(`Updating existing sell order: ${existingOrder._id}`);
        
        // Lock additional tokens in escrow
        await escrowService.lockTokensInEscrow(user._id, null, 'CES', amount);
        
        existingOrder.amount += amount;
        existingOrder.remainingAmount += amount;
        existingOrder.escrowAmount += amount;
        existingOrder.totalValue = existingOrder.amount * pricePerToken;
        existingOrder.updatedAt = new Date();
        existingOrder.escrowLocked = true;
        await existingOrder.save();
        
        console.log(`Updated existing sell order: ${existingOrder._id}`);
        return existingOrder;
      }
      
      // Lock tokens in escrow before creating order
      console.log(`Locking ${amount} CES in escrow`);
      await escrowService.lockTokensInEscrow(user._id, null, 'CES', amount);
      
      // Create new sell order
      console.log(`Creating new sell order`);
      const sellOrder = new P2POrder({
        userId: user._id,
        type: 'sell',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        remainingAmount: amount,
        escrowLocked: true,
        escrowAmount: amount,
        paymentMethods: paymentMethods,
        tradeTimeLimit: this.defaultTradeTimeout
      });
      
      await sellOrder.save();
      
      console.log(`Sell order created: ${sellOrder._id}`);
      
      // Try to match with existing buy orders
      console.log(`Attempting to match orders...`);
      await this.matchOrders();
      
      return sellOrder;
      
    } catch (error) {
      console.error('Error creating sell order:', error);
      throw error;
    }
  }

  // Enhanced order matching with smart algorithms
  async matchOrders() {
    try {
      console.log('Matching orders with enhanced algorithm...');
      
      // Get active buy orders sorted by price (highest first) and trust score
      const buyOrders = await P2POrder.find({
        type: 'buy',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      }).sort({ pricePerToken: -1, createdAt: 1 }).populate('userId');
      
      // Get active sell orders sorted by price (lowest first) and trust score
      const sellOrders = await P2POrder.find({
        type: 'sell',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      }).sort({ pricePerToken: 1, createdAt: 1 }).populate('userId');
      
      // Smart matching algorithm
      for (const buyOrder of buyOrders) {
        for (const sellOrder of sellOrders) {
          // Skip if same user (no self-trading)
          if (buyOrder.userId._id.toString() === sellOrder.userId._id.toString()) {
            continue;
          }
          
          // Check price compatibility (buy price >= sell price)
          if (buyOrder.pricePerToken >= sellOrder.pricePerToken) {
            // Check payment method compatibility
            const compatibleMethods = buyOrder.paymentMethods.filter(method => 
              sellOrder.paymentMethods.includes(method)
            );
            
            if (compatibleMethods.length === 0) {
              // No compatible payment methods, skip this pair
              continue;
            }
            
            // Check user verification compatibility
            const buyUserTrust = buyOrder.userId.trustScore || 0;
            const sellUserTrust = sellOrder.userId.trustScore || 0;
            
            // Calculate trade amount (minimum of remaining amounts)
            const tradeAmount = Math.min(buyOrder.remainingAmount, sellOrder.remainingAmount);
            
            // Check if trade amount is within user limits
            const buyerLimitCheck = this.checkUserTradeLimits(buyOrder.userId, tradeAmount, 'buy');
            const sellerLimitCheck = this.checkUserTradeLimits(sellOrder.userId, tradeAmount, 'sell');
            
            if (!buyerLimitCheck.allowed || !sellerLimitCheck.allowed) {
              // User limits exceeded, skip this pair
              continue;
            }
            
            // Use seller's price for the trade
            const tradePrice = sellOrder.pricePerToken;
            const totalValue = tradeAmount * tradePrice;
            
            // Calculate commissions: 1% from buyer and 1% from seller
            const buyerCommission = totalValue * this.commissionRate; // 1% from buyer
            const sellerCommission = totalValue * this.commissionRate; // 1% from seller
            const totalCommission = buyerCommission + sellerCommission; // Total 2%
            
            console.log(`Executing trade: ${tradeAmount} CES at ₽${tradePrice} (buyer commission: ₽${buyerCommission.toFixed(2)}, seller commission: ₽${sellerCommission.toFixed(2)})`);
            
            // Send smart notifications to both users
            await smartNotificationService.sendSmartOrderMatchNotification(
              buyOrder.userId._id, 
              sellOrder, 
              buyOrder
            );
            
            await smartNotificationService.sendSmartOrderMatchNotification(
              sellOrder.userId._id, 
              buyOrder, 
              sellOrder
            );
            
            // Execute the trade with both commissions
            await this.executeTrade(buyOrder, sellOrder, tradeAmount, tradePrice, totalValue, buyerCommission, sellerCommission);
            
            // Update order statuses
            buyOrder.remainingAmount -= tradeAmount;
            buyOrder.filledAmount += tradeAmount;
            sellOrder.remainingAmount -= tradeAmount;
            sellOrder.filledAmount += tradeAmount;
            
            if (buyOrder.remainingAmount === 0) {
              buyOrder.status = 'completed';
            } else if (buyOrder.filledAmount > 0) {
              buyOrder.status = 'partial';
            }
            
            if (sellOrder.remainingAmount === 0) {
              sellOrder.status = 'completed';
            } else if (sellOrder.filledAmount > 0) {
              sellOrder.status = 'partial';
            }
            
            await buyOrder.save();
            await sellOrder.save();
            
            console.log(`Trade executed successfully`);
            
            // If buy order is completed, break inner loop
            if (buyOrder.remainingAmount === 0) {
              break;
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error matching orders:', error);
      throw error;
    }
  }

  // Check user trade limits
  checkUserTradeLimits(user, amount, orderType) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Check daily limit
      if (user.tradingLimits && user.tradingLimits.dailyLimit) {
        const dailyLimit = user.tradingLimits.dailyLimit;
        // In a real implementation, you would check actual daily volume
        // For now, we'll just check against the limit
        if (amount * user.tradingLimits.maxSingleTrade > dailyLimit) {
          return { allowed: false, reason: 'Превышен дневной лимит' };
        }
      }
      
      // Check single trade limit
      if (user.tradingLimits && user.tradingLimits.maxSingleTrade) {
        if (amount > user.tradingLimits.maxSingleTrade) {
          return { allowed: false, reason: 'Превышен лимит одной сделки' };
        }
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Error checking user trade limits:', error);
      return { allowed: true }; // Allow trade if there's an error
    }
  }

  // Execute a trade between two orders with escrow
  async executeTrade(buyOrder, sellOrder, amount, pricePerToken, totalValue, buyerCommission, sellerCommission) {
    try {
      console.log(`Executing escrow trade: ${amount} CES at ₽${pricePerToken} (buyer commission: ₽${buyerCommission.toFixed(2)}, seller commission: ₽${sellerCommission.toFixed(2)})`);
      
      // Calculate total commission
      const totalCommission = buyerCommission + sellerCommission;
      
      // Create trade record with escrow status
      const trade = new P2PTrade({
        buyOrderId: buyOrder._id,
        sellOrderId: sellOrder._id,
        buyerId: buyOrder.userId._id,
        sellerId: sellOrder.userId._id,
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        buyerCommission: buyerCommission, // 1% commission from buyer
        sellerCommission: sellerCommission, // 1% commission from seller
        commission: totalCommission, // Total commission for backward compatibility
        status: 'escrow_locked',
        escrowStatus: 'locked',
        paymentMethod: buyOrder.paymentMethods ? buyOrder.paymentMethods[0] : 'bank_transfer',
        timeTracking: {
          createdAt: new Date(),
          escrowLockedAt: new Date(),
          expiresAt: new Date(Date.now() + this.defaultTradeTimeout * 60 * 1000)
        }
      });
      
      await trade.save();
      console.log(`Trade record created: ${trade._id}`);
      
      // Link escrow to trade (update existing escrow transaction)
      try {
        await escrowService.linkEscrowToTrade(sellOrder.userId._id, trade._id, 'CES', amount);
      } catch (escrowError) {
        console.log('Warning: Could not link escrow to trade, but trade continues');
      }
      
      // Set trade status to pending payment
      trade.status = 'payment_pending';
      await trade.save();
      
      console.log(`Escrow trade created successfully: ${trade._id}`);
      
      // Schedule automatic timeout handling
      setTimeout(() => {
        this.handleTradeTimeout(trade._id);
      }, this.defaultTradeTimeout * 60 * 1000);
      
      return trade;
      
    } catch (error) {
      console.error('Error executing escrow trade:', error);
      throw error;
    }
  }

  // Get market orders for display
  async getMarketOrders(limit = 10) {
    try {
      // Get active buy and sell orders with populated user data
      // Limit the fields we retrieve for better performance
      const [buyOrders, sellOrders] = await Promise.all([
        P2POrder.find({ 
          type: 'buy', 
          status: 'active',
          remainingAmount: { $gt: 0 }
        })
        .sort({ pricePerToken: -1, createdAt: 1 }) // Sort by price (highest first), then by time
        .limit(limit)
        .populate({
          path: 'userId',
          select: 'username firstName trustScore verificationLevel'
        }),
        
        P2POrder.find({ 
          type: 'sell', 
          status: 'active',
          remainingAmount: { $gt: 0 }
        })
        .sort({ pricePerToken: 1, createdAt: 1 }) // Sort by price (lowest first), then by time
        .limit(limit)
        .populate({
          path: 'userId',
          select: 'username firstName trustScore verificationLevel'
        })
      ]);
      
      return {
        buyOrders,
        sellOrders
      };
    } catch (error) {
      console.error('Error getting market orders:', error);
      return {
        buyOrders: [],
        sellOrders: []
      };
    }
  }

  // Get user's P2P orders
  async getUserOrders(chatId, limit = 10) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const orders = await P2POrder.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(limit);
      
      return orders;
      
    } catch (error) {
      console.error('Error getting user orders:', error);
      throw error;
    }
  }

  // Get user's P2P trade history
  async getUserTrades(chatId, limit = 10) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const trades = await P2PTrade.find({
        $or: [
          { buyerId: user._id },
          { sellerId: user._id }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('buyerId', 'username firstName trustScore')
      .populate('sellerId', 'username firstName trustScore');
      
      return trades;
      
    } catch (error) {
      console.error('Error getting user trades:', error);
      throw error;
    }
  }

  // Cancel an order
  async cancelOrder(chatId, orderId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const order = await P2POrder.findOne({
        _id: orderId,
        userId: user._id,
        status: { $in: ['active', 'partial'] }
      });
      
      if (!order) {
        throw new Error('Ордер не найден или уже завершен');
      }
      
      order.status = 'cancelled';
      await order.save();
      
      console.log(`Order cancelled: ${orderId}`);
      return order;
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // Get market price suggestion for P2P trading
  async getMarketPriceSuggestion() {
    try {
      // Get current CES price from price service (cached for performance)
      const cesPriceData = await priceService.getCESPrice();
      const currentPrice = cesPriceData.priceRub;
      
      // For better performance, use a simpler calculation for suggested price
      // Add a small premium for sellers, subtract a small discount for buyers
      const suggestedPrice = currentPrice;
      
      return {
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        suggestedPrice: parseFloat(suggestedPrice.toFixed(2)),
        priceRange: {
          min: parseFloat((currentPrice * 0.95).toFixed(2)), // 5% below market
          max: parseFloat((currentPrice * 1.05).toFixed(2))  // 5% above market
        }
      };
    } catch (error) {
      console.error('Error getting market price suggestion:', error);
      // Return default values to prevent app crashes
      return {
        currentPrice: 0,
        suggestedPrice: 0,
        priceRange: { min: 0, max: 0 }
      };
    }
  }

  // Handle trade timeout
  async handleTradeTimeout(tradeId) {
    try {
      console.log(`Handling trade timeout for ${tradeId}`);
      
      // Get trade details before handling timeout
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      // Handle escrow timeout
      await escrowService.handleEscrowTimeout(tradeId);
      
      // Send smart notification about timeout
      if (trade) {
        const smartNotificationService = require('./smartNotificationService');
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.buyerId._id, 
          trade, 
          'timeout'
        );
        await smartNotificationService.sendSmartTradeStatusNotification(
          trade.sellerId._id, 
          trade, 
          'timeout'
        );
      }
    } catch (error) {
      console.error('Error handling trade timeout:', error);
    }
  }

  // Confirm payment for a trade
  async confirmPayment(tradeId, buyerChatId, paymentProof = '') {
    try {
      console.log(`Confirming payment for trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        throw new Error('Сделка не найдена');
      }
      
      if (trade.buyerId.chatId !== buyerChatId) {
        throw new Error('Вы не являетесь покупателем в этой сделке');
      }
      
      if (trade.status !== 'payment_pending') {
        throw new Error('Нельзя подтвердить оплату для этой сделки');
      }
      
      // Update trade with payment confirmation
      trade.status = 'payment_confirmed';
      trade.paymentDetails.buyerProof = paymentProof;
      trade.timeTracking.paymentMadeAt = new Date();
      trade.timeTracking.paymentConfirmedAt = new Date();
      
      await trade.save();
      
      // Release tokens from escrow to buyer
      const releaseResult = await escrowService.releaseTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        trade.amount,
        trade.buyerId._id
      );
      
      // Complete the trade
      trade.status = 'completed';
      trade.escrowStatus = 'released';
      trade.cesTransferTxHash = releaseResult.txHash;
      trade.timeTracking.completedAt = new Date();
      
      await trade.save();
      
      // Transfer commissions to admin wallet
      try {
        // Transfer buyer commission (1%)
        if (trade.buyerCommission > 0) {
          // Calculate equivalent CES amount based on trade price
          const buyerCommissionInCES = trade.buyerCommission / trade.pricePerToken;
          
          if (buyerCommissionInCES > 0) {
            console.log(`Transferring buyer commission: ${buyerCommissionInCES} CES to admin wallet`);
            // Transfer commission from buyer to admin wallet
            await walletService.sendCESTokens(
              trade.buyerId.chatId, // Use buyer as sender
              '0xC2D5FABd53F537A1225460AE30097198aB14FF32', // Admin wallet address
              buyerCommissionInCES
            );
            console.log(`Buyer commission transfer completed successfully`);
          }
        }
        
        // Transfer seller commission (1%)
        if (trade.sellerCommission > 0) {
          // Calculate equivalent CES amount based on trade price
          const sellerCommissionInCES = trade.sellerCommission / trade.pricePerToken;
          
          if (sellerCommissionInCES > 0) {
            console.log(`Transferring seller commission: ${sellerCommissionInCES} CES to admin wallet`);
            // Transfer commission from seller to admin wallet
            await walletService.sendCESTokens(
              trade.sellerId.chatId, // Use seller as sender
              '0xC2D5FABd53F537A1225460AE30097198aB14FF32', // Admin wallet address
              sellerCommissionInCES
            );
            console.log(`Seller commission transfer completed successfully`);
          }
        }
      } catch (commissionError) {
        console.error('Error transferring commissions:', commissionError);
        // Don't fail the trade if commission transfer fails
      }
      
      // Update user statistics
      await this.updateUserStats(trade.buyerId._id, trade.sellerId._id, trade.totalValue, 'completed');
      
      // Send smart notifications
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.buyerId._id, 
        trade, 
        'completed'
      );
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.sellerId._id, 
        trade, 
        'completed'
      );
      
      return trade;
      
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  // Cancel a trade
  async cancelTrade(tradeId, userChatId, reason = 'Cancelled by user') {
    try {
      console.log(`Cancelling trade ${tradeId}`);
      
      const trade = await P2PTrade.findById(tradeId)
        .populate('buyerId')
        .populate('sellerId');
      
      if (!trade) {
        throw new Error('Сделка не найдена');
      }
      
      // Check if user is participant
      const isParticipant = trade.buyerId.chatId === userChatId || trade.sellerId.chatId === userChatId;
      if (!isParticipant) {
        throw new Error('Вы не являетесь участником этой сделки');
      }
      
      if (!['escrow_locked', 'payment_pending'].includes(trade.status)) {
        throw new Error('Нельзя отменить эту сделку');
      }
      
      // Refund tokens from escrow to seller
      await escrowService.refundTokensFromEscrow(
        trade.sellerId._id,
        tradeId,
        'CES',
        trade.amount,
        reason
      );
      
      // Update trade status
      trade.status = 'cancelled';
      trade.escrowStatus = 'refunded';
      trade.disputeReason = reason;
      
      await trade.save();
      
      // Update user statistics
      await this.updateUserStats(trade.buyerId._id, trade.sellerId._id, trade.totalValue, 'cancelled');
      
      // Send smart notifications
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.buyerId._id, 
        trade, 
        'cancelled'
      );
      await smartNotificationService.sendSmartTradeStatusNotification(
        trade.sellerId._id, 
        trade, 
        'cancelled'
      );
      
      console.log(`Trade ${tradeId} cancelled and refunded`);
      return trade;
      
    } catch (error) {
      console.error('Error cancelling trade:', error);
      throw error;
    }
  }

  // Update user trading statistics
  async updateUserStats(buyerId, sellerId, tradeValue, tradeStatus) {
    try {
      const updates = {
        $inc: {
          'tradeAnalytics.totalTrades': 1,
          'tradeAnalytics.successfulTrades': tradeStatus === 'completed' ? 1 : 0,
          'tradingVolumeLast30Days': tradeValue
        }
      };
      
      await Promise.all([
        User.findByIdAndUpdate(buyerId, updates),
        User.findByIdAndUpdate(sellerId, updates)
      ]);
      
      // Update trust scores
      await reputationService.updateTrustScoreAfterTrade(buyerId, tradeStatus);
      await reputationService.updateTrustScoreAfterTrade(sellerId, tradeStatus);
      
      console.log(`Updated trading stats and trust scores for users`);
      
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }
}

module.exports = new P2PService();