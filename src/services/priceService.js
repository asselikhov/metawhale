/**
 * Price Service
 * Handles all price-related API calls and data aggregation
 */

const axios = require('axios');
const config = require('../config/configuration');
const { PriceHistory } = require('../database/models');

class PriceService {
  constructor() {
    this.lastApiCall = 0;
  }

  // Get USD to RUB exchange rate
  async getUSDToRUBRate() {
    try {
      const response = await axios.get(`${config.apis.exchangeRate.baseUrl}/USD`, {
        timeout: 5000
      });
      
      if (response.data?.rates?.RUB) {
        const rate = response.data.rates.RUB;
        console.log(`💱 USD/RUB rate: ${rate}`);
        return rate;
      }
      
      console.log('⚠️ RUB rate not found in API response');
      return 100; // Fallback rate
    } catch (error) {
      console.log('⚠️ Error getting USD/RUB rate:', error.message);
      return 100; // Fallback ~100 rubles per dollar
    }
  }

  // Scrape ATH from CoinMarketCap web page
  async scrapeATHFromWeb() {
    try {
      console.log('🌐 Attempting to get ATH via web scraping...');
      
      const response = await axios.get('https://coinmarketcap.com/currencies/whalebit/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 10000
      });
      
      const html = response.data;
      
      // Priority patterns for finding ATH
      const athPatterns = [
        {
          pattern: /All-Time High[^$]*\$([0-9,]+\.?[0-9]*)/gi,
          priority: 1,
          name: 'All-Time High text'
        },
        {
          pattern: /All Time High[^$]*\$([0-9,]+\.?[0-9]*)/gi,
          priority: 2,
          name: 'All Time High text'
        },
        {
          pattern: /"allTimeHigh"[^}]*"price"[^0-9]*([0-9\.]+)/gi,
          priority: 3,
          name: 'JSON allTimeHigh'
        },
        {
          pattern: /ATH[^$]*\$([0-9,]+\.?[0-9]*)/gi,
          priority: 4,
          name: 'ATH abbreviation'
        }
      ];
      
      let candidateValues = [];
      
      for (const {pattern, priority, name} of athPatterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex
        
        while ((match = pattern.exec(html)) !== null && candidateValues.length < 10) {
          const athValue = parseFloat(match[1].replace(',', ''));
          
          // Filter reasonable ATH values
          if (athValue >= 1 && athValue <= 100) { // ATH for CES should be in this range
            candidateValues.push({
              value: athValue,
              priority: priority,
              source: name,
              context: match[0].substring(0, 80)
            });
            
            console.log(`🔍 ATH candidate: $${athValue} (priority ${priority}, ${name})`);
          }
        }
      }
      
      if (candidateValues.length > 0) {
        // Sort by priority, then by value (maximum)
        candidateValues.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority; // Lower priority = better
          }
          return b.value - a.value; // Higher value = better
        });
        
        const bestCandidate = candidateValues[0];
        console.log(`✅ Best ATH: $${bestCandidate.value} (source: ${bestCandidate.source})`);
        return bestCandidate.value;
      }
      
      console.log('❌ ATH not found via web scraping');
      return null;
      
    } catch (error) {
      console.log('⚠️ ATH web scraping error:', error.message);
      return null;
    }
  }

  // Get price data from CoinMarketCap API
  async getCMCPrice() {
    try {
      if (!config.apis.coinMarketCap.apiKey) {
        console.log('⚠️ CMC API key not found, skipping CoinMarketCap');
        return null;
      }

      console.log('🔍 Getting CES token data from Polygon...');
      
      // Method 1: Direct request by ID 36465 (Whalebit CES on Polygon)
      try {
        const response = await axios.get(
          `${config.apis.coinMarketCap.baseUrl}/v2/cryptocurrency/quotes/latest`,
          {
            headers: {
              'X-CMC_PRO_API_KEY': config.apis.coinMarketCap.apiKey,
              'Accept': 'application/json'
            },
            params: {
              id: '36465',
              convert: 'USD'
            },
            timeout: 10000
          }
        );
        
        if (response.data?.data?.['36465']?.quote?.USD) {
          const quote = response.data.data['36465'].quote.USD;
          
          // Get USD/RUB conversion rate
          const usdToRubRate = await this.getUSDToRUBRate();
          const priceRub = quote.price * usdToRubRate;
          
          return {
            price: quote.price,
            priceRub: priceRub,
            change24h: quote.percent_change_24h,
            marketCap: quote.market_cap,
            volume24h: quote.volume_24h,
            ath: null, // ATH not available in free plan
            source: 'coinmarketcap'
          };
        }
      } catch (idError) {
        console.log('⚠️ Search by ID 36465 failed:', idError.message);
      }
      
      // Method 2: Fallback - search by symbol with filtering
      console.log('🔄 Fallback: searching by CES symbol...');
      
      try {
        const response = await axios.get(
          `${config.apis.coinMarketCap.baseUrl}/v2/cryptocurrency/quotes/latest`,
          {
            headers: {
              'X-CMC_PRO_API_KEY': config.apis.coinMarketCap.apiKey,
              'Accept': 'application/json'
            },
            params: {
              symbol: config.constants.cesSymbol,
              convert: 'USD'
            },
            timeout: 10000
          }
        );
        
        if (response.data?.data?.CES) {
          const cesTokens = response.data.data.CES;
          
          // Find Polygon CES token
          const polygonCES = cesTokens.find(token => 
            token.platform?.name?.toLowerCase().includes('polygon') || 
            token.platform?.symbol?.toLowerCase() === 'matic'
          );
          
          if (polygonCES?.quote?.USD) {
            const quote = polygonCES.quote.USD;
            
            // Get USD/RUB conversion rate
            const usdToRubRate = await this.getUSDToRUBRate();
            const priceRub = quote.price * usdToRubRate;
            
            return {
              price: quote.price,
              priceRub: priceRub,
              change24h: quote.percent_change_24h,
              marketCap: quote.market_cap,
              volume24h: quote.volume_24h,
              ath: null,
              source: 'coinmarketcap'
            };
          }
        }
      } catch (symbolError) {
        console.log('⚠️ Search by CES symbol failed:', symbolError.message);
      }

      console.log('⚠️ CES token not found in CoinMarketCap with all methods');
      return null;
    } catch (error) {
      console.log('⚠️ General CoinMarketCap API error:', error.message);
      return null;
    }
  }

  // Main function to get CES price with all sources
  async getCESPrice() {
    try {
      // Check API call interval
      const now = Date.now();
      const timeSinceLastCall = now - this.lastApiCall;
      
      if (timeSinceLastCall < config.telegram.apiCallInterval) {
        const waitTime = config.telegram.apiCallInterval - timeSinceLastCall;
        console.log(`⏳ Waiting ${waitTime}ms between /price commands`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.lastApiCall = Date.now();
      
      // Get data from CoinMarketCap
      const cmcData = await this.getCMCPrice();
      if (cmcData) {
        // Get ATH from multiple sources for maximum accuracy
        console.log('🔍 Getting ATH from multiple sources...');
        
        // 1. ATH from database
        const maxPriceRecord = await PriceHistory.findOne().sort({ price: -1 });
        const databaseATH = maxPriceRecord ? maxPriceRecord.price : cmcData.price;
        console.log(`📊 Database ATH: $${databaseATH.toFixed(2)}`);
        
        // 2. Attempt to get ATH via web scraping
        let webATH = null;
        try {
          webATH = await this.scrapeATHFromWeb();
          if (webATH) {
            console.log(`🌐 Web scraping ATH: $${webATH.toFixed(2)}`);
          }
        } catch (error) {
          console.log('⚠️ Web scraping ATH unavailable:', error.message);
        }
        
        // 3. Determine final ATH (maximum from all sources)
        const athSources = [databaseATH, cmcData.price];
        if (webATH && webATH > 0) {
          athSources.push(webATH);
        }
        
        const finalATH = Math.max(...athSources);
        
        if (cmcData.price >= finalATH) {
          console.log(`🏆 New ATH detected! $${cmcData.price.toFixed(2)}`);
        }
        
        console.log(`📊 ATH sources: Database=${databaseATH.toFixed(2)}, Web=${webATH ? webATH.toFixed(2) : 'N/A'}`);
        console.log(`📊 Final ATH: $${finalATH.toFixed(2)}`);
        
        return {
          price: cmcData.price,
          priceRub: cmcData.priceRub,
          change24h: cmcData.change24h,
          changeRub24h: 0, // CMC doesn't provide ruble data
          marketCap: cmcData.marketCap,
          volume24h: cmcData.volume24h,
          ath: finalATH, // Best ATH from all sources
          athSource: webATH ? 'web+database' : 'database',
          source: 'coinmarketcap'
        };
      }

      throw new Error('Failed to get CES data from CoinMarketCap');
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

  // Format number for display
  formatNumber(num) {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }
}

module.exports = new PriceService();