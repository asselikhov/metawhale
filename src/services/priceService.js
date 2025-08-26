/**
 * Price Service with CoinGecko API
 * Handles all price-related API calls and data aggregation
 */

const axios = require('axios');
const config = require('../config/configuration');
const { PriceHistory } = require('../database/models');

class PriceService {
  constructor() {
    this.lastApiCall = 0;
    this.cachedPriceData = null;
    this.cacheExpiry = 5000; // 5 seconds cache
    this.lastCacheTime = 0;
  }

  // Get USD to RUB exchange rate with caching
  async getUSDToRUBRate() {
    const now = Date.now();
    if (this.lastRUBRateTime && (now - this.lastRUBRateTime) < 60000) {
      return this.cachedRUBRate;
    }
    
    try {
      const response = await axios.get(`${config.apis.exchangeRate.baseUrl}/USD`, {
        timeout: 3000
      });
      
      if (response.data?.rates?.RUB) {
        const rate = response.data.rates.RUB;
        console.log(`💱 USD/RUB rate: ${rate}`);
        this.cachedRUBRate = rate;
        this.lastRUBRateTime = now;
        return rate;
      }
      
      return 100; // Fallback rate
    } catch (error) {
      console.log('⚠️ Error getting USD/RUB rate:', error.message);
      return 100; // Fallback ~100 rubles per dollar
    }
  }

  // Format number for display
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(2);
  }

  // Get CES token price from CoinGecko API
  async getCESPriceFromCoinGecko() {
    try {
      console.log('🦎 Getting CES token data from CoinGecko...');
      
      // Try detailed endpoint first
      try {
        const response = await axios.get(
          `${config.apis.coinGecko.baseUrl}/coins/whalebit`,
          {
            headers: {
              'X-CG-Demo-API-Key': config.apis.coinGecko.apiKey,
              'Accept': 'application/json'
            },
            params: {
              localization: false,
              tickers: false,
              market_data: true,
              community_data: false,
              developer_data: false,
              sparkline: false
            },
            timeout: 10000
          }
        );
        
        if (response.data?.market_data) {
          const marketData = response.data.market_data;
          const usdToRubRate = await this.getUSDToRUBRate();
          const priceUSD = marketData.current_price?.usd || 0;
          const priceRub = priceUSD * usdToRubRate;
          
          console.log(`🦎 CES price from CoinGecko: $${priceUSD.toFixed(6)}`);
          
          return {
            price: priceUSD,
            priceRub: priceRub,
            change24h: marketData.price_change_percentage_24h || 0,
            marketCap: marketData.market_cap?.usd || 0,
            volume24h: marketData.total_volume?.usd || 0,
            ath: marketData.ath?.usd || priceUSD,
            athDate: marketData.ath_date?.usd ? new Date(marketData.ath_date.usd) : new Date(),
            source: 'coingecko'
          };
        }
      } catch (detailError) {
        console.log('⚠️ Detailed endpoint failed, trying simple price...');
      }
      
      // Fallback to simple price endpoint
      const response = await axios.get(
        `${config.apis.coinGecko.baseUrl}/simple/price`,
        {
          headers: {
            'X-CG-Demo-API-Key': config.apis.coinGecko.apiKey,
            'Accept': 'application/json'
          },
          params: {
            ids: 'whalebit',
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_market_cap: true,
            include_24hr_vol: true
          },
          timeout: 8000
        }
      );
      
      if (response.data?.whalebit) {
        const data = response.data.whalebit;
        const usdToRubRate = await this.getUSDToRUBRate();
        const priceUSD = data.usd;
        const priceRub = priceUSD * usdToRubRate;
        
        console.log(`🦎 CES price from CoinGecko (simple): $${priceUSD.toFixed(6)}`);
        
        return {
          price: priceUSD,
          priceRub: priceRub,
          change24h: data.usd_24h_change || 0,
          marketCap: data.usd_market_cap || 0,
          volume24h: data.usd_24h_vol || 0,
          ath: null, // ATH not available in simple endpoint
          source: 'coingecko'
        };
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ CoinGecko API error for CES:', error.message);
      return null;
    }
  }

  // Get POL token price from CoinGecko API
  async getPOLPriceFromCoinGecko() {
    try {
      console.log('🦎 Getting POL token data from CoinGecko...');
      
      const response = await axios.get(
        `${config.apis.coinGecko.baseUrl}/simple/price`,
        {
          headers: {
            'X-CG-Demo-API-Key': config.apis.coinGecko.apiKey,
            'Accept': 'application/json'
          },
          params: {
            ids: 'polygon-ecosystem-token',
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_market_cap: true,
            include_24hr_vol: true
          },
          timeout: 8000
        }
      );
      
      if (response.data?.['polygon-ecosystem-token']) {
        const data = response.data['polygon-ecosystem-token'];
        const usdToRubRate = await this.getUSDToRUBRate();
        const priceUSD = data.usd;
        const priceRub = priceUSD * usdToRubRate;
        
        console.log(`🦎 POL price from CoinGecko: $${priceUSD.toFixed(4)}`);
        
        return {
          price: priceUSD,
          priceRub: priceRub,
          change24h: data.usd_24h_change || 0,
          marketCap: data.usd_market_cap || 0,
          volume24h: data.usd_24h_vol || 0,
          source: 'coingecko'
        };
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ CoinGecko API error for POL:', error.message);
      return null;
    }
  }

  // Main function to get POL price
  async getPOLPrice() {
    try {
      console.log('🔍 Getting POL price from CoinGecko...');
      
      const coinGeckoData = await this.getPOLPriceFromCoinGecko();
      if (coinGeckoData) {
        console.log(`✅ POL price from CoinGecko: $${coinGeckoData.price.toFixed(4)}`);
        return coinGeckoData;
      }
      
      throw new Error('Failed to get POL data from CoinGecko');
    } catch (error) {
      console.error('Error getting POL price:', error.message);
      
      // Return fallback price as last resort
      console.log('⚠️ Using fallback POL price values');
      return {
        price: 0.45,
        priceRub: 45.0,
        change24h: 0,
        source: 'fallback'
      };
    }
  }

  // Main function to get CES price
  async getCESPrice() {
    try {
      // Check API call interval
      const now = Date.now();
      const timeSinceLastCall = now - this.lastApiCall;
      
      if (timeSinceLastCall < config.telegram.apiCallInterval) {
        const waitTime = config.telegram.apiCallInterval - timeSinceLastCall;
        console.log(`⏳ Waiting ${waitTime}ms between /ces commands`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.lastApiCall = Date.now();
      
      // Get data from CoinGecko
      const coinGeckoData = await this.getCESPriceFromCoinGecko();
      if (coinGeckoData) {
        // Get ATH from multiple sources for maximum accuracy
        console.log('🔍 Getting ATH from multiple sources...');
        
        // 1. ATH from database
        const maxPriceRecord = await PriceHistory.findOne().sort({ price: -1 });
        const databaseATH = maxPriceRecord ? maxPriceRecord.price : coinGeckoData.price;
        console.log(`📊 Database ATH: $${databaseATH.toFixed(2)}`);
        
        // 2. ATH from CoinGecko (if available)
        let finalATH = databaseATH;
        if (coinGeckoData.ath && coinGeckoData.ath > databaseATH) {
          finalATH = coinGeckoData.ath;
          console.log(`🦎 CoinGecko ATH: $${coinGeckoData.ath.toFixed(2)}`);
        }
        
        // 3. Current price could be new ATH
        if (coinGeckoData.price > finalATH) {
          finalATH = coinGeckoData.price;
          console.log(`🏆 New ATH detected! $${coinGeckoData.price.toFixed(2)}`);
        }
        
        console.log(`📊 Final ATH: $${finalATH.toFixed(2)}`);
        
        return {
          price: coinGeckoData.price,
          priceRub: coinGeckoData.priceRub,
          change24h: coinGeckoData.change24h,
          changeRub24h: 0, // Not directly available
          marketCap: coinGeckoData.marketCap,
          volume24h: coinGeckoData.volume24h,
          ath: finalATH,
          athSource: coinGeckoData.ath ? 'coingecko+database' : 'database',
          source: 'coingecko'
        };
      }

      throw new Error('Failed to get CES data from CoinGecko');
    } catch (error) {
      console.error('Error getting CES price:', error.message);
      
      // Return last saved price from database
      const lastPrice = await PriceHistory.findOne().sort({ timestamp: -1 });
      if (lastPrice) {
        console.log('⚡ Using last saved price from database');
        
        // Convert to rubles if needed
        let priceRub = lastPrice.priceRub || 0;
        if (!priceRub && lastPrice.price) {
          const usdToRubRate = await this.getUSDToRUBRate();
          priceRub = lastPrice.price * usdToRubRate;
        }
        
        return {
          price: lastPrice.price,
          priceRub: priceRub,
          change24h: lastPrice.change24h || 0,
          changeRub24h: lastPrice.changeRub24h || 0,
          marketCap: lastPrice.marketCap || 0,
          volume24h: lastPrice.volume24h || 0,
          ath: lastPrice.ath || lastPrice.price,
          athSource: 'database',
          source: 'database',
          cached: true
        };
      }
      
      throw error;
    }
  }
}

module.exports = new PriceService();