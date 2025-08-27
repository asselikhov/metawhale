/**
 * Multi-Chain Wallet Service
 * Handles wallet operations across different blockchain networks
 */

const { ethers } = require('ethers');
let TronWeb = null;
try {
  TronWeb = require('tronweb');
  // Проверяем, что TronWeb является конструктором
  if (typeof TronWeb !== 'function') {
    console.warn('⚠️ TronWeb loaded but not a constructor, checking .default');
    TronWeb = TronWeb.default || null;
  }
} catch (error) {
  console.warn('⚠️ TronWeb not installed or failed to load:', error.message);
  TronWeb = null;
}
const multiChainService = require('./multiChainService');
const userNetworkService = require('./userNetworkService');
const walletService = require('./walletService');
const priceService = require('./priceService');
const rpcService = require('./rpcService');

class MultiChainWalletService {
  constructor() {
    this.tronWeb = null;
    this.initializeTronWeb();
  }

  // Initialize TronWeb instance
  async initializeTronWeb() {
    try {
      if (!TronWeb) {
        console.warn('⚠️ TronWeb not available - skipping TRON initialization');
        return;
      }
      
      if (typeof TronWeb !== 'function') {
        console.warn('⚠️ TronWeb is not a constructor function');
        return;
      }
      
      this.tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' }
      });
      console.log('✅ TronWeb initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize TronWeb:', error.message);
      this.tronWeb = null;
    }
  }

  // Get comprehensive wallet info for user's current network
  async getMultiChainWalletInfo(chatId) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const walletInfo = await userNetworkService.getUserWalletForNetwork(chatId, currentNetwork);

      if (!walletInfo.hasWallet) {
        return {
          hasWallet: false,
          currentNetwork,
          networkInfo: await userNetworkService.getNetworkInfo(chatId)
        };
      }

      // Get balances for current network
      const balances = await this.getNetworkBalances(walletInfo.address, currentNetwork);
      const prices = await this.getTokenPrices(currentNetwork);

      // Format balance information
      const formattedBalances = this.formatBalances(currentNetwork, balances, prices);

      return {
        hasWallet: true,
        address: walletInfo.address,
        currentNetwork,
        networkInfo: walletInfo.networkName,
        networkEmoji: walletInfo.networkEmoji,
        balances: formattedBalances,
        totalValue: this.calculateTotalValue(balances, prices)
      };
    } catch (error) {
      console.error('Error getting multi-chain wallet info:', error);
      throw error;
    }
  }

  // Get balances for specific network
  async getNetworkBalances(address, networkId) {
    try {
      const networkConfig = multiChainService.getNetworkConfig(networkId);
      if (!networkConfig) {
        throw new Error(`Unsupported network: ${networkId}`);
      }

      const balances = {};

      switch (networkId) {
        case 'polygon':
          balances.POL = await this.getPolygonNativeBalance(address);
          balances.CES = await this.getPolygonTokenBalance(address, 'CES');
          balances.USDT = await this.getPolygonTokenBalance(address, 'USDT');
          break;
        
        case 'tron':
          balances.TRX = await this.getTronNativeBalance(address);
          balances.USDT = await this.getTronTokenBalance(address, 'USDT');
          break;
          
        case 'bsc':
          balances.BNB = await this.getEVMNativeBalance(address, networkId);
          balances.USDT = await this.getEVMTokenBalance(address, networkId, 'USDT');
          balances.BUSD = await this.getEVMTokenBalance(address, networkId, 'BUSD');
          balances.USDC = await this.getEVMTokenBalance(address, networkId, 'USDC');
          break;
          
        case 'solana':
          balances.SOL = await this.getSolanaNativeBalance(address);
          balances.USDT = await this.getSolanaTokenBalance(address, 'USDT');
          balances.USDC = await this.getSolanaTokenBalance(address, 'USDC');
          break;
          
        case 'arbitrum':
          balances.ETH = await this.getEVMNativeBalance(address, networkId);
          balances.USDT = await this.getEVMTokenBalance(address, networkId, 'USDT');
          balances.USDC = await this.getEVMTokenBalance(address, networkId, 'USDC');
          balances.ARB = await this.getEVMTokenBalance(address, networkId, 'ARB');
          break;
          
        case 'avalanche':
          balances.AVAX = await this.getEVMNativeBalance(address, networkId);
          balances.USDT = await this.getEVMTokenBalance(address, networkId, 'USDT');
          balances.USDC = await this.getEVMTokenBalance(address, networkId, 'USDC');
          break;
      }

      return balances;
    } catch (error) {
      console.error(`Error getting balances for network ${networkId}:`, error);
      return {};
    }
  }

  // Get Polygon native token balance
  async getPolygonNativeBalance(address) {
    try {
      return await walletService.getPOLBalance(address);
    } catch (error) {
      console.error('Error getting POL balance:', error);
      return 0;
    }
  }

  // Get Polygon token balance
  async getPolygonTokenBalance(address, tokenSymbol) {
    try {
      if (tokenSymbol === 'CES') {
        return await walletService.getCESBalance(address);
      }
      
      const tokenConfig = multiChainService.getTokenConfig('polygon', tokenSymbol);
      if (!tokenConfig) return 0;

      const { balance, decimals } = await rpcService.getTokenBalance(
        tokenConfig.address,
        address
      );

      return parseFloat(ethers.utils.formatUnits(balance, decimals));
    } catch (error) {
      console.error(`Error getting ${tokenSymbol} balance:`, error);
      return 0;
    }
  }

  // Get TRON native token balance
  async getTronNativeBalance(address) {
    try {
      if (!this.tronWeb) {
        console.warn('⚠️ TronWeb not available - returning 0 balance');
        return 0;
      }
      
      const balance = await this.tronWeb.trx.getBalance(address);
      return this.tronWeb.fromSun(balance);
    } catch (error) {
      console.error('Error getting TRX balance:', error);
      return 0;
    }
  }

  // Get TRON token balance
  async getTronTokenBalance(address, tokenSymbol) {
    try {
      if (!this.tronWeb) {
        console.warn('⚠️ TronWeb not available - returning 0 balance');
        return 0;
      }

      const tokenConfig = multiChainService.getTokenConfig('tron', tokenSymbol);
      if (!tokenConfig || tokenConfig.address === 'native') return 0;

      const contract = await this.tronWeb.contract().at(tokenConfig.address);
      const balance = await contract.balanceOf(address).call();
      
      return parseFloat(balance) / Math.pow(10, tokenConfig.decimals);
    } catch (error) {
      console.error(`Error getting TRON ${tokenSymbol} balance:`, error);
      return 0;
    }
  }

  // Get EVM native token balance (BSC, Arbitrum, Avalanche)
  async getEVMNativeBalance(address, networkId) {
    try {
      const networkConfig = multiChainService.getNetworkConfig(networkId);
      if (!networkConfig || !networkConfig.rpcUrls) return 0;
      
      // Use ethers with the network RPC
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpcUrls[0]);
      const balance = await provider.getBalance(address);
      
      return parseFloat(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error(`Error getting ${networkId} native balance:`, error);
      return 0;
    }
  }

  // Get EVM token balance (BSC, Arbitrum, Avalanche)
  async getEVMTokenBalance(address, networkId, tokenSymbol) {
    try {
      const tokenConfig = multiChainService.getTokenConfig(networkId, tokenSymbol);
      if (!tokenConfig || tokenConfig.address === 'native') return 0;

      const networkConfig = multiChainService.getNetworkConfig(networkId);
      if (!networkConfig || !networkConfig.rpcUrls) return 0;

      const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpcUrls[0]);
      
      // Standard ERC20 ABI for balanceOf
      const abi = ['function balanceOf(address owner) view returns (uint256)'];
      const contract = new ethers.Contract(tokenConfig.address, abi, provider);
      
      const balance = await contract.balanceOf(address);
      return parseFloat(ethers.utils.formatUnits(balance, tokenConfig.decimals));
    } catch (error) {
      console.error(`Error getting ${networkId} ${tokenSymbol} balance:`, error);
      return 0;
    }
  }

  // Get Solana native balance
  async getSolanaNativeBalance(address) {
    try {
      // For now, return 0 as we need Solana Web3.js integration
      console.warn('⚠️ Solana balance fetching not yet implemented');
      return 0;
    } catch (error) {
      console.error('Error getting SOL balance:', error);
      return 0;
    }
  }

  // Get Solana token balance
  async getSolanaTokenBalance(address, tokenSymbol) {
    try {
      // For now, return 0 as we need Solana Web3.js integration
      console.warn('⚠️ Solana token balance fetching not yet implemented');
      return 0;
    } catch (error) {
      console.error(`Error getting Solana ${tokenSymbol} balance:`, error);
      return 0;
    }
  }

  // Get token prices for network
  async getTokenPrices(networkId) {
    try {
      const prices = {};
      const tokens = multiChainService.getNetworkTokens(networkId);

      for (const tokenSymbol of Object.keys(tokens)) {
        try {
          let priceData;
          
          switch (tokenSymbol) {
            case 'CES':
              priceData = await priceService.getCESPrice();
              break;
            case 'POL':
              priceData = await priceService.getPOLPrice();
              break;
            case 'TRX':
              priceData = await priceService.getTRXPrice();
              break;
            case 'BNB':
              priceData = await priceService.getBNBPrice();
              break;
            case 'SOL':
              priceData = await priceService.getSOLPrice();
              break;
            case 'ETH':
              priceData = await priceService.getETHPrice();
              break;
            case 'ARB':
              priceData = await priceService.getARBPrice();
              break;
            case 'AVAX':
              priceData = await priceService.getAVAXPrice();
              break;
            case 'USDT':
              priceData = await priceService.getUSDTPrice();
              break;
            case 'USDC':
              priceData = await priceService.getUSDCPrice();
              break;
            case 'BUSD':
              priceData = await priceService.getBUSDPrice();
              break;
            default:
              priceData = { price: 0, priceRub: 0 };
          }

          prices[tokenSymbol] = priceData;
        } catch (error) {
          console.error(`Error getting ${tokenSymbol} price:`, error);
          prices[tokenSymbol] = { price: 0, priceRub: 0 };
        }
      }

      return prices;
    } catch (error) {
      console.error('Error getting token prices:', error);
      return {};
    }
  }

  // Format balances for display
  formatBalances(networkId, balances, prices) {
    const formatted = {};
    
    for (const [tokenSymbol, balance] of Object.entries(balances)) {
      const price = prices[tokenSymbol] || { price: 0, priceRub: 0 };
      
      formatted[tokenSymbol] = {
        balance: parseFloat(balance) || 0,
        balanceFormatted: (parseFloat(balance) || 0).toFixed(4),
        usdValue: ((parseFloat(balance) || 0) * price.price).toFixed(2),
        rubValue: ((parseFloat(balance) || 0) * price.priceRub).toFixed(2),
        displayText: multiChainService.formatBalance(
          networkId, 
          tokenSymbol, 
          parseFloat(balance) || 0, 
          price.price, 
          price.priceRub
        )
      };
    }

    return formatted;
  }

  // Calculate total portfolio value
  calculateTotalValue(balances, prices) {
    let totalUsd = 0;
    let totalRub = 0;

    for (const [tokenSymbol, balance] of Object.entries(balances)) {
      const price = prices[tokenSymbol] || { price: 0, priceRub: 0 };
      totalUsd += (parseFloat(balance) || 0) * price.price;
      totalRub += (parseFloat(balance) || 0) * price.priceRub;
    }

    return {
      usd: totalUsd.toFixed(2),
      rub: totalRub.toFixed(2)
    };
  }

  // Generate network selector keyboard
  generateNetworkSelector(currentNetwork) {
    const { Markup } = require('telegraf');
    
    const buttons = multiChainService.getNetworkSelectorButtons(currentNetwork);
    buttons.push([Markup.button.callback('🔙 Назад', 'personal_cabinet')]);
    
    return Markup.inlineKeyboard(buttons);
  }

  // Validate address for current network
  async validateAddressForNetwork(chatId, address) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.validateAddress(currentNetwork, address);
    } catch (error) {
      console.error('Error validating address:', error);
      return false;
    }
  }

  // Get minimum transfer amount for token
  async getMinimumTransfer(chatId, tokenSymbol) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.getMinimumTransferAmount(currentNetwork, tokenSymbol);
    } catch (error) {
      console.error('Error getting minimum transfer:', error);
      return 0.001;
    }
  }

  // Get network fee estimation
  async getNetworkFeeEstimate(chatId, tokenSymbol) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.estimateNetworkFee(currentNetwork, tokenSymbol);
    } catch (error) {
      console.error('Error getting fee estimate:', error);
      return { estimatedFee: 0 };
    }
  }
}

module.exports = new MultiChainWalletService();