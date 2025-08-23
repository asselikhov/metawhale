/**
 * P2P Trading Service with Escrow
 * Handles buying and selling CES tokens for rubles with 1% commission
 * Includes advanced escrow system for maximum security
 */

const { P2POrder, P2PTrade, User } = require('../database/models');
const walletService = require('./walletService');
const priceService = require('./priceService');
const escrowService = require('./escrowService');

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
      console.log(`📈 Creating buy order: ${amount} CES at ₽${pricePerToken} per token (chatId: ${chatId})`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        console.log(`❌ User not found for chatId: ${chatId}`);
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        console.log(`❌ User ${chatId} has no wallet`);
        throw new Error('Сначала создайте кошелек');
      }
      
      // Validate input
      if (amount <= 0 || pricePerToken <= 0) {
        console.log(`❌ Invalid input: amount=${amount}, price=${pricePerToken}`);
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      const totalValue = amount * pricePerToken;
      console.log(`💸 Total order value: ₽${totalValue.toFixed(2)}`);
      
      // Check for existing active buy orders with same price
      const existingOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'buy',
        pricePerToken: pricePerToken,
        status: 'active'
      });
      
      if (existingOrder) {
        // Update existing order
        console.log(`🔄 Updating existing buy order: ${existingOrder._id}`);
        existingOrder.amount += amount;
        existingOrder.remainingAmount += amount;
        existingOrder.totalValue = existingOrder.amount * pricePerToken;
        existingOrder.updatedAt = new Date();
        await existingOrder.save();
        
        console.log(`✅ Updated existing buy order: ${existingOrder._id}`);
        return existingOrder;
      }
      
      // Create new buy order
      console.log(`🆕 Creating new buy order`);
      const buyOrder = new P2POrder({
        userId: user._id,
        type: 'buy',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        remainingAmount: amount
      });
      
      await buyOrder.save();
      
      console.log(`✅ Buy order created: ${buyOrder._id}`);
      
      // Try to match with existing sell orders
      console.log(`🔍 Attempting to match orders...`);
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
      console.log(`📉 Creating sell order: ${amount} CES at ₽${pricePerToken} per token (chatId: ${chatId})`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        console.log(`❌ User not found for chatId: ${chatId}`);
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        console.log(`❌ User ${chatId} has no wallet`);
        throw new Error('Сначала создайте кошелек');
      }
      
      // Validate input
      if (amount <= 0 || pricePerToken <= 0) {
        console.log(`❌ Invalid input: amount=${amount}, price=${pricePerToken}`);
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      if (amount < this.minOrderAmount || amount > this.maxOrderAmount) {
        throw new Error(`Количество должно быть от ${this.minOrderAmount} до ${this.maxOrderAmount} CES`);
      }
      
      // Check CES balance
      const cesBalance = await walletService.getCESBalance(user.walletAddress);
      if (cesBalance < amount) {
        console.log(`❌ Insufficient CES balance: ${cesBalance} < ${amount}`);
        throw new Error(`Недостаточно CES токенов. Доступно: ${cesBalance.toFixed(4)} CES`);
      }
      
      const totalValue = amount * pricePerToken;
      console.log(`💸 Total order value: ₽${totalValue.toFixed(2)}`);
      
      // Check for existing active sell orders with same price
      const existingOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'sell',
        pricePerToken: pricePerToken,
        status: 'active'
      });
      
      if (existingOrder) {
        // Update existing order and lock additional tokens in escrow
        console.log(`🔄 Updating existing sell order: ${existingOrder._id}`);
        
        // Lock additional tokens in escrow
        await escrowService.lockTokensInEscrow(user._id, null, 'CES', amount);
        
        existingOrder.amount += amount;
        existingOrder.remainingAmount += amount;
        existingOrder.escrowAmount += amount;
        existingOrder.totalValue = existingOrder.amount * pricePerToken;
        existingOrder.updatedAt = new Date();
        existingOrder.escrowLocked = true;
        await existingOrder.save();
        
        console.log(`✅ Updated existing sell order: ${existingOrder._id}`);
        return existingOrder;
      }
      
      // Lock tokens in escrow before creating order
      console.log(`🔒 Locking ${amount} CES in escrow`);
      await escrowService.lockTokensInEscrow(user._id, null, 'CES', amount);
      
      // Create new sell order
      console.log(`🆕 Creating new sell order`);
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
      
      console.log(`✅ Sell order created: ${sellOrder._id}`);
      
      // Try to match with existing buy orders
      console.log(`🔍 Attempting to match orders...`);
      await this.matchOrders();
      
      return sellOrder;
      
    } catch (error) {
      console.error('Error creating sell order:', error);
      throw error;
    }
  }

  // Match buy and sell orders
  async matchOrders() {
    try {
      console.log('🔄 Matching orders...');
      
      // Get active buy orders sorted by price (highest first)
      const buyOrders = await P2POrder.find({
        type: 'buy',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      }).sort({ pricePerToken: -1, createdAt: 1 });
      
      // Get active sell orders sorted by price (lowest first)
      const sellOrders = await P2POrder.find({
        type: 'sell',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      }).sort({ pricePerToken: 1, createdAt: 1 });
      
      for (const buyOrder of buyOrders) {
        for (const sellOrder of sellOrders) {
          // Check if prices match (buy price >= sell price)
          if (buyOrder.pricePerToken >= sellOrder.pricePerToken) {
            // Prevent self-trading
            if (buyOrder.userId.toString() === sellOrder.userId.toString()) {
              continue;
            }
            
            // Calculate trade amount
            const tradeAmount = Math.min(buyOrder.remainingAmount, sellOrder.remainingAmount);
            const tradePrice = sellOrder.pricePerToken; // Use seller's price
            const totalValue = tradeAmount * tradePrice;
            const commission = totalValue * this.commissionRate;
            
            console.log(`💱 Executing trade: ${tradeAmount} CES at ₽${tradePrice} (commission: ₽${commission.toFixed(2)})`);
            
            // Execute the trade
            await this.executeTrade(buyOrder, sellOrder, tradeAmount, tradePrice, totalValue, commission);
            
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
            
            console.log(`✅ Trade executed successfully`);
            
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

  // Execute a trade between two orders with escrow
  async executeTrade(buyOrder, sellOrder, amount, pricePerToken, totalValue, commission) {
    try {
      console.log(`💱 Executing escrow trade: ${amount} CES at ₽${pricePerToken} (commission: ₽${commission.toFixed(2)})`);
      
      // Create trade record with escrow status
      const trade = new P2PTrade({
        buyOrderId: buyOrder._id,
        sellOrderId: sellOrder._id,
        buyerId: buyOrder.userId,
        sellerId: sellOrder.userId,
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        commission: commission,
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
      console.log(`📝 Trade record created: ${trade._id}`);
      
      // Link escrow to trade (update existing escrow transaction)
      try {
        await escrowService.linkEscrowToTrade(sellOrder.userId, trade._id, 'CES', amount);
      } catch (escrowError) {
        console.log('Warning: Could not link escrow to trade, but trade continues');
      }
      
      // Set trade status to pending payment
      trade.status = 'payment_pending';
      await trade.save();
      
      console.log(`✅ Escrow trade created successfully: ${trade._id}`);
      
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

  // Get current market orders
  async getMarketOrders(limit = 10) {
    try {
      const buyOrders = await P2POrder.find({
        type: 'buy',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      })
      .sort({ pricePerToken: -1 })
      .limit(limit)
      .populate('userId', 'username firstName');
      
      const sellOrders = await P2POrder.find({
        type: 'sell',
        status: { $in: ['active', 'partial'] },
        remainingAmount: { $gt: 0 }
      })
      .sort({ pricePerToken: 1 })
      .limit(limit)
      .populate('userId', 'username firstName');
      
      return {
        buyOrders,
        sellOrders
      };
      
    } catch (error) {
      console.error('Error getting market orders:', error);
      throw error;
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
      .populate('buyerId', 'username firstName')
      .populate('sellerId', 'username firstName');
      
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
      
      console.log(`✅ Order cancelled: ${orderId}`);
      return order;
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // Get current market price suggestion
  async getMarketPriceSuggestion() {
    try {
      // Get CES price in rubles from price service
      const priceData = await priceService.getCESPrice();
      const currentPriceRub = priceData.priceRub;
      
      // Get recent trade prices for market analysis
      const recentTrades = await P2PTrade.find({
        status: 'completed',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).sort({ createdAt: -1 }).limit(10);
      
      let marketPrice = currentPriceRub;
      
      if (recentTrades.length > 0) {
        // Calculate average trade price
        const avgTradePrice = recentTrades.reduce((sum, trade) => sum + trade.pricePerToken, 0) / recentTrades.length;
        
        // Use weighted average (70% current price, 30% market trades)
        marketPrice = (currentPriceRub * 0.7) + (avgTradePrice * 0.3);
      }
      
      return {
        currentPrice: currentPriceRub,
        suggestedPrice: marketPrice,
        recentTradesCount: recentTrades.length
      };
      
    } catch (error) {
      console.error('Error getting market price suggestion:', error);
      return {
        currentPrice: 250, // Fallback
        suggestedPrice: 250,
        recentTradesCount: 0
      };
    }
  }

  // Handle trade timeout
  async handleTradeTimeout(tradeId) {
    try {
      console.log(`⏰ Handling trade timeout for ${tradeId}`);
      await escrowService.handleEscrowTimeout(tradeId);
    } catch (error) {
      console.error('Error handling trade timeout:', error);
    }
  }

  // Confirm payment for a trade
  async confirmPayment(tradeId, buyerChatId, paymentProof = '') {
    try {
      console.log(`💳 Confirming payment for trade ${tradeId}`);
      
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
      
      // Update user statistics
      await this.updateUserStats(trade.buyerId._id, trade.sellerId._id, trade.totalValue);
      
      console.log(`✅ Trade ${tradeId} completed successfully`);
      return trade;
      
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  // Cancel a trade
  async cancelTrade(tradeId, userChatId, reason = 'Cancelled by user') {
    try {
      console.log(`❌ Cancelling trade ${tradeId}`);
      
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
      
      console.log(`✅ Trade ${tradeId} cancelled and refunded`);
      return trade;
      
    } catch (error) {
      console.error('Error cancelling trade:', error);
      throw error;
    }
  }

  // Update user trading statistics
  async updateUserStats(buyerId, sellerId, tradeValue) {
    try {
      const updates = {
        $inc: {
          successfulTrades: 1,
          totalTradeVolume: tradeValue
        }
      };
      
      await Promise.all([
        User.findByIdAndUpdate(buyerId, updates),
        User.findByIdAndUpdate(sellerId, updates)
      ]);
      
      console.log(`📊 Updated trading stats for users`);
      
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }
}

module.exports = new P2PService();