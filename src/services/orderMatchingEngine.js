/**
 * Advanced Order Matching Engine
 * Provides intelligent order matching with price-time priority and user preferences
 */

const { P2POrder, User } = require('../database/models');

class OrderMatchingEngine {
  constructor() {
    this.matchingInterval = 5000; // 5 seconds
    this.priceTolerancePercent = 2; // 2% price tolerance for matching
  }

  // Advanced order matching with multiple criteria
  async intelligentOrderMatching() {
    try {
      console.log('🔄 Starting intelligent order matching...');

      // Get all active buy and sell orders
      const [buyOrders, sellOrders] = await Promise.all([
        this.getQualifiedBuyOrders(),
        this.getQualifiedSellOrders()
      ]);

      console.log(`📊 Found ${buyOrders.length} buy orders and ${sellOrders.length} sell orders`);

      let matchedTrades = 0;

      for (const buyOrder of buyOrders) {
        for (const sellOrder of sellOrders) {
          // Check if orders can be matched
          if (await this.canMatchOrders(buyOrder, sellOrder)) {
            try {
              await this.executeAdvancedMatch(buyOrder, sellOrder);
              matchedTrades++;
              console.log(`✅ Matched trade between buy order ${buyOrder._id} and sell order ${sellOrder._id}`);
            } catch (error) {
              console.error(`❌ Failed to execute match: ${error.message}`);
            }
          }
        }
      }

      console.log(`🎯 Matching complete. ${matchedTrades} trades executed.`);
      return matchedTrades;

    } catch (error) {
      console.error('Error in intelligent order matching:', error);
      throw error;
    }
  }

  // Get qualified buy orders with user filtering
  async getQualifiedBuyOrders() {
    return await P2POrder.find({
      type: 'buy',
      status: { $in: ['active', 'partial'] },
      remainingAmount: { $gt: 0 }
    })
    .populate({
      path: 'userId',
      match: { 
        p2pTradingEnabled: true,
        restrictedUntil: { $lt: new Date() }
      }
    })
    .sort({ 
      pricePerToken: -1, // Highest price first
      createdAt: 1 // Older orders first (FIFO)
    });
  }

  // Get qualified sell orders with user filtering
  async getQualifiedSellOrders() {
    return await P2POrder.find({
      type: 'sell',
      status: { $in: ['active', 'partial'] },
      remainingAmount: { $gt: 0 },
      escrowLocked: true
    })
    .populate({
      path: 'userId',
      match: { 
        p2pTradingEnabled: true,
        restrictedUntil: { $lt: new Date() }
      }
    })
    .sort({ 
      pricePerToken: 1, // Lowest price first
      createdAt: 1 // Older orders first (FIFO)
    });
  }

  // Check if two orders can be matched
  async canMatchOrders(buyOrder, sellOrder) {
    try {
      // Basic price check
      if (buyOrder.pricePerToken < sellOrder.pricePerToken) {
        return false;
      }

      // Prevent self-trading
      if (buyOrder.userId._id.toString() === sellOrder.userId._id.toString()) {
        return false;
      }

      // Check if users have blocked each other
      const buyerBlockedSeller = buyOrder.userId.blockedUsers.includes(sellOrder.userId._id);
      const sellerBlockedBuyer = sellOrder.userId.blockedUsers.includes(buyOrder.userId._id);
      
      if (buyerBlockedSeller || sellerBlockedBuyer) {
        return false;
      }

      // Check payment method compatibility
      const compatibleMethods = buyOrder.paymentMethods?.some(method => 
        sellOrder.paymentMethods?.includes(method)
      );
      
      if (!compatibleMethods && buyOrder.paymentMethods && sellOrder.paymentMethods) {
        return false;
      }

      // Check minimum trade amounts
      const potentialTradeAmount = Math.min(buyOrder.remainingAmount, sellOrder.remainingAmount);
      
      if (potentialTradeAmount < sellOrder.minTradeAmount) {
        return false;
      }

      // Check maximum trade amounts
      if (sellOrder.maxTradeAmount && potentialTradeAmount > sellOrder.maxTradeAmount) {
        return false;
      }

      // Check trading limits
      const tradeValue = potentialTradeAmount * sellOrder.pricePerToken;
      
      if (tradeValue > buyOrder.userId.tradingLimits.maxSingleTrade ||
          tradeValue > sellOrder.userId.tradingLimits.maxSingleTrade) {
        return false;
      }

      // Verification level compatibility
      if (sellOrder.userId.verificationLevel === 'premium' && 
          buyOrder.userId.verificationLevel === 'unverified') {
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error checking order compatibility:', error);
      return false;
    }
  }

  // Execute advanced match with smart pricing
  async executeAdvancedMatch(buyOrder, sellOrder) {
    try {
      // Calculate optimal trade amount
      const tradeAmount = Math.min(buyOrder.remainingAmount, sellOrder.remainingAmount);
      
      // Use seller's price (better for seller, fair for buyer who accepted higher price)
      const executionPrice = sellOrder.pricePerToken;
      
      // Calculate values
      const totalValue = tradeAmount * executionPrice;
      
      // NEW COMMISSION LOGIC: Only charge MAKERS (order creators), not TAKERS
      // Determine who is maker based on order creation time
      const buyOrderTime = new Date(buyOrder.createdAt).getTime();
      const sellOrderTime = new Date(sellOrder.createdAt).getTime();
      
      let buyerCommission = 0;
      let sellerCommission = 0;
      
      if (buyOrderTime < sellOrderTime) {
        // Buy order was created first → Buyer is MAKER
        const makerCommissionInCES = tradeAmount * 0.01; // 1% of CES amount
        buyerCommission = makerCommissionInCES * executionPrice; // Convert to rubles
        sellerCommission = 0; // Seller (taker) pays nothing
      } else {
        // Sell order was created first → Seller is MAKER
        const makerCommissionInCES = tradeAmount * 0.01; // 1% of CES amount  
        sellerCommission = makerCommissionInCES * executionPrice; // Convert to rubles
        buyerCommission = 0; // Buyer (taker) pays nothing
      }

      console.log(`💱 Executing advanced trade: ${tradeAmount} CES at ₽${executionPrice} (buyer commission: ₽${buyerCommission.toFixed(2)}, seller commission: ₽${sellerCommission.toFixed(2)})`);

      // Import p2pService to execute the trade
      const p2pService = require('./p2pService');
      
      // Execute the trade using existing method with correct commission assignment
      const trade = await p2pService.executeTrade(
        buyOrder, 
        sellOrder, 
        tradeAmount, 
        executionPrice, 
        totalValue, 
        buyerCommission,
        sellerCommission
      );

      // Update order statuses
      buyOrder.remainingAmount -= tradeAmount;
      buyOrder.filledAmount += tradeAmount;
      sellOrder.remainingAmount -= tradeAmount;
      sellOrder.filledAmount += tradeAmount;

      // Update order statuses
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

      await Promise.all([
        buyOrder.save(),
        sellOrder.save()
      ]);

      return trade;

    } catch (error) {
      console.error('Error executing advanced match:', error);
      throw error;
    }
  }

  // Smart order book analysis
  async getOrderBookAnalysis() {
    try {
      const [buyOrders, sellOrders] = await Promise.all([
        P2POrder.find({ 
          type: 'buy', 
          status: { $in: ['active', 'partial'] },
          remainingAmount: { $gt: 0 }
        }).sort({ pricePerToken: -1 }),
        
        P2POrder.find({ 
          type: 'sell', 
          status: { $in: ['active', 'partial'] },
          remainingAmount: { $gt: 0 }
        }).sort({ pricePerToken: 1 })
      ]);

      // Calculate spread
      const highestBid = buyOrders[0]?.pricePerToken || 0;
      const lowestAsk = sellOrders[0]?.pricePerToken || 0;
      const spread = lowestAsk > 0 ? ((lowestAsk - highestBid) / lowestAsk * 100) : 0;

      // Calculate total volumes
      const totalBuyVolume = buyOrders.reduce((sum, order) => sum + (order.remainingAmount * order.pricePerToken), 0);
      const totalSellVolume = sellOrders.reduce((sum, order) => sum + (order.remainingAmount * order.pricePerToken), 0);

      return {
        highestBid,
        lowestAsk,
        spread: parseFloat(spread.toFixed(2)),
        totalBuyVolume,
        totalSellVolume,
        buyOrdersCount: buyOrders.length,
        sellOrdersCount: sellOrders.length,
        marketDepth: {
          bids: buyOrders.slice(0, 10).map(order => ({
            price: order.pricePerToken,
            amount: order.remainingAmount,
            total: order.remainingAmount * order.pricePerToken
          })),
          asks: sellOrders.slice(0, 10).map(order => ({
            price: order.pricePerToken,
            amount: order.remainingAmount,
            total: order.remainingAmount * order.pricePerToken
          }))
        }
      };

    } catch (error) {
      console.error('Error getting order book analysis:', error);
      throw error;
    }
  }

  // Dynamic pricing suggestions based on order book
  async getDynamicPricingSuggestions() {
    try {
      const analysis = await this.getOrderBookAnalysis();
      const priceService = require('./priceService');
      const marketPrice = (await priceService.getCESPrice()).priceRub;

      return {
        marketPrice: marketPrice,
        suggestedBuyPrice: analysis.highestBid > 0 ? analysis.highestBid + 0.01 : marketPrice * 0.98,
        suggestedSellPrice: analysis.lowestAsk > 0 ? analysis.lowestAsk - 0.01 : marketPrice * 1.02,
        quickBuyPrice: analysis.lowestAsk > 0 ? analysis.lowestAsk : marketPrice * 1.01,
        quickSellPrice: analysis.highestBid > 0 ? analysis.highestBid : marketPrice * 0.99,
        spread: analysis.spread
      };

    } catch (error) {
      console.error('Error getting dynamic pricing suggestions:', error);
      throw error;
    }
  }

  // Start automatic matching service
  startMatchingService() {
    console.log('🚀 Starting automatic order matching service...');
    
    setInterval(async () => {
      try {
        await this.intelligentOrderMatching();
      } catch (error) {
        console.error('Error in automatic matching:', error);
      }
    }, this.matchingInterval);
  }
}

module.exports = new OrderMatchingEngine();