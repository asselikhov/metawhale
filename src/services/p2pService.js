/**
 * P2P Trading Service
 * Handles buying and selling CES tokens for rubles with 1% commission
 */

const { P2POrder, P2PTrade, User } = require('../database/models');
const walletService = require('./walletService');
const priceService = require('./priceService');

class P2PService {
  constructor() {
    this.commissionRate = 0.01; // 1% commission
  }

  // Create a buy order (user wants to buy CES for rubles)
  async createBuyOrder(chatId, amount, pricePerToken) {
    try {
      console.log(`📈 Creating buy order: ${amount} CES at ₽${pricePerToken} per token`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        throw new Error('Сначала создайте кошелек');
      }
      
      // Validate input
      if (amount <= 0 || pricePerToken <= 0) {
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      const totalValue = amount * pricePerToken;
      
      // Check for existing active buy orders with same price
      const existingOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'buy',
        pricePerToken: pricePerToken,
        status: 'active'
      });
      
      if (existingOrder) {
        // Update existing order
        existingOrder.amount += amount;
        existingOrder.remainingAmount += amount;
        existingOrder.totalValue = existingOrder.amount * pricePerToken;
        existingOrder.updatedAt = new Date();
        await existingOrder.save();
        
        console.log(`✅ Updated existing buy order: ${existingOrder._id}`);
        return existingOrder;
      }
      
      // Create new buy order
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
      await this.matchOrders();
      
      return buyOrder;
      
    } catch (error) {
      console.error('Error creating buy order:', error);
      throw error;
    }
  }

  // Create a sell order (user wants to sell CES for rubles)
  async createSellOrder(chatId, amount, pricePerToken) {
    try {
      console.log(`📉 Creating sell order: ${amount} CES at ₽${pricePerToken} per token`);
      
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (!user.walletAddress) {
        throw new Error('Сначала создайте кошелек');
      }
      
      // Validate input
      if (amount <= 0 || pricePerToken <= 0) {
        throw new Error('Количество и цена должны быть больше 0');
      }
      
      // Check CES balance
      const cesBalance = await walletService.getCESBalance(user.walletAddress);
      if (cesBalance < amount) {
        throw new Error(`Недостаточно CES токенов. Доступно: ${cesBalance.toFixed(4)} CES`);
      }
      
      const totalValue = amount * pricePerToken;
      
      // Check for existing active sell orders with same price
      const existingOrder = await P2POrder.findOne({
        userId: user._id,
        type: 'sell',
        pricePerToken: pricePerToken,
        status: 'active'
      });
      
      if (existingOrder) {
        // Update existing order
        existingOrder.amount += amount;
        existingOrder.remainingAmount += amount;
        existingOrder.totalValue = existingOrder.amount * pricePerToken;
        existingOrder.updatedAt = new Date();
        await existingOrder.save();
        
        console.log(`✅ Updated existing sell order: ${existingOrder._id}`);
        return existingOrder;
      }
      
      // Create new sell order
      const sellOrder = new P2POrder({
        userId: user._id,
        type: 'sell',
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        remainingAmount: amount
      });
      
      await sellOrder.save();
      
      console.log(`✅ Sell order created: ${sellOrder._id}`);
      
      // Try to match with existing buy orders
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

  // Execute a trade between two orders
  async executeTrade(buyOrder, sellOrder, amount, pricePerToken, totalValue, commission) {
    try {
      // Create trade record
      const trade = new P2PTrade({
        buyOrderId: buyOrder._id,
        sellOrderId: sellOrder._id,
        buyerId: buyOrder.userId,
        sellerId: sellOrder.userId,
        amount: amount,
        pricePerToken: pricePerToken,
        totalValue: totalValue,
        commission: commission,
        status: 'pending'
      });
      
      await trade.save();
      
      // Get user details
      const buyer = await User.findById(buyOrder.userId);
      const seller = await User.findById(sellOrder.userId);
      
      // Execute CES token transfer from seller to buyer
      try {
        const transferResult = await walletService.sendCESTokens(
          seller.chatId,
          buyer.walletAddress,
          amount
        );
        
        // Update trade with transaction hash
        trade.cesTransferTxHash = transferResult.txHash;
        trade.status = 'completed';
        trade.completedAt = new Date();
        await trade.save();
        
        console.log(`✅ CES transfer completed: ${transferResult.txHash}`);
        
        return trade;
        
      } catch (transferError) {
        // Mark trade as failed
        trade.status = 'failed';
        await trade.save();
        
        console.error('CES transfer failed:', transferError);
        throw new Error(`Ошибка перевода CES токенов: ${transferError.message}`);
      }
      
    } catch (error) {
      console.error('Error executing trade:', error);
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
}

module.exports = new P2PService();