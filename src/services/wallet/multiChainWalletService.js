/**
 * Multi-Chain Wallet Service
 * Handles wallet operations across multiple blockchain networks
 */

const { ethers } = require('ethers');
const config = require('../../config/configuration');
const { User, Wallet } = require('../../database/models');
const walletService = require('./walletService');
const multiChainService = require('../multiChainService');
const userNetworkService = require('../userNetworkService');

// Properly import TronWeb with error handling
let TronWeb = null;
try {
  TronWeb = require('tronweb');
  // Check if TronWeb is a constructor function
  if (typeof TronWeb !== 'function') {
    console.warn('⚠️ TronWeb loaded but not a constructor, checking .default');
    TronWeb = TronWeb.default || null;
  }
} catch (error) {
  console.warn('⚠️ TronWeb not installed or failed to load:', error.message);
  TronWeb = null;
}

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
      console.log(`💼 Getting wallet info for user ${chatId} in network ${currentNetwork}`);
      
      const walletInfo = await userNetworkService.getUserWalletForNetwork(chatId, currentNetwork);
      console.log(`🔍 Wallet info result for ${chatId}:`, {
        hasWallet: walletInfo.hasWallet,
        network: walletInfo.network,
        address: walletInfo.address ? `${walletInfo.address.slice(0, 10)}...` : 'none'
      });

      if (!walletInfo.hasWallet) {
        console.log(`⚠️ User ${chatId} has no wallet in network ${currentNetwork} - returning no wallet info`);
        return {
          hasWallet: false,
          currentNetwork,
          networkInfo: await userNetworkService.getNetworkInfo(chatId)
        };
      }

      console.log(`💼 Getting balances for user ${chatId} in network ${currentNetwork} with address ${walletInfo.address}`);

      // Get balances for current network
      const balances = await this.getNetworkBalances(walletInfo.address, currentNetwork);
      console.log(`💰 Raw balances for ${chatId}:`, balances);
      
      const prices = await this.getTokenPrices(currentNetwork);
      console.log(`💱 Token prices for ${currentNetwork}:`, prices);

      // Format balance information
      const formattedBalances = this.formatBalances(currentNetwork, balances, prices);
      console.log(`📊 Formatted balances for ${chatId}:`, formattedBalances);

      const totalValue = this.calculateTotalValue(balances, prices);
      console.log(`💎 Total wallet value for ${chatId}: $${totalValue.usd} • ₽${totalValue.rub}`);

      return {
        hasWallet: true,
        address: walletInfo.address,
        currentNetwork,
        networkInfo: walletInfo.networkName,
        networkEmoji: walletInfo.networkEmoji,
        balances: formattedBalances,
        totalValue: totalValue
      };
    } catch (error) {
      console.error(`❌ Error getting multi-chain wallet info for ${chatId}:`, error);
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
          // Используем существующие методы walletService для Polygon
          balances.POL = await walletService.getPOLBalance(address);
          balances.CES = await walletService.getCESBalance(address);
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
          
        case 'ton':
          balances.TON = await this.getTonNativeBalance(address);
          balances.USDT = await this.getTonTokenBalance(address, 'USDT');
          balances.NOT = await this.getTonTokenBalance(address, 'NOT');
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

  // Get TON native balance
  async getTonNativeBalance(address) {
    try {
      // For now, return 0 as we need TON SDK integration
      console.warn('⚠️ TON balance fetching not yet implemented');
      return 0;
    } catch (error) {
      console.error('Error getting TON balance:', error);
      return 0;
    }
  }

  // Get TON token balance
  async getTonTokenBalance(address, tokenSymbol) {
    try {
      // For now, return 0 as we need TON SDK integration
      console.warn('⚠️ TON token balance fetching not yet implemented');
      return 0;
    } catch (error) {
      console.error(`Error getting TON ${tokenSymbol} balance:`, error);
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
            case 'TON':
              priceData = await priceService.getTONPrice();
              break;
            case 'NOT':
              priceData = await priceService.getNOTPrice();
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

  // Get network transaction fee estimate
  async getNetworkFeeEstimate(networkId, tokenSymbol) {
    try {
      const networkConfig = multiChainService.getNetworkConfig(networkId);
      if (!networkConfig) return { fee: 0, currency: 'USD' };

      // Return estimated fees based on network
      switch (networkId) {
        case 'polygon':
          return { fee: 0.01, currency: 'POL', usdValue: 0.01 };
        case 'tron':
          return { fee: 1, currency: 'TRX', usdValue: 0.05 };
        case 'bsc':
          return { fee: 0.001, currency: 'BNB', usdValue: 0.3 };
        case 'solana':
          return { fee: 0.00025, currency: 'SOL', usdValue: 0.05 };
        case 'arbitrum':
          return { fee: 0.0001, currency: 'ETH', usdValue: 0.2 };
        case 'avalanche':
          return { fee: 0.001, currency: 'AVAX', usdValue: 0.1 };
        case 'ton':
          return { fee: 0.1, currency: 'TON', usdValue: 0.5 };
        default:
          return { fee: 0, currency: 'USD', usdValue: 0 };
      }
    } catch (error) {
      console.error('Error getting network fee estimate:', error);
      return { fee: 0, currency: 'USD', usdValue: 0 };
    }
  }

  // Check if user has sufficient balance for transfer
  async hasSufficientBalance(chatId, tokenSymbol, amount, networkId = null) {
    try {
      if (!networkId) {
        networkId = await userNetworkService.getUserNetwork(chatId);
      }

      const walletInfo = await userNetworkService.getUserWalletForNetwork(chatId, networkId);
      if (!walletInfo.hasWallet) return false;

      const balances = await this.getNetworkBalances(walletInfo.address, networkId);
      const balance = balances[tokenSymbol] || 0;

      return parseFloat(balance) >= parseFloat(amount);
    } catch (error) {
      console.error('Error checking sufficient balance:', error);
      return false;
    }
  }

  // Get user's wallet address for current network
  async getUserWalletAddress(chatId) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const walletInfo = await userNetworkService.getUserWalletForNetwork(chatId, currentNetwork);
      
      return walletInfo.hasWallet ? walletInfo.address : null;
    } catch (error) {
      console.error('Error getting user wallet address:', error);
      return null;
    }
  }

  // Get all user's wallet addresses across networks
  async getAllUserWalletAddresses(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user || !user.wallets) return {};

      const addresses = {};
      for (const [networkId, wallet] of Object.entries(user.wallets)) {
        if (wallet && wallet.address) {
          addresses[networkId] = wallet.address;
        }
      }

      return addresses;
    } catch (error) {
      console.error('Error getting all user wallet addresses:', error);
      return {};
    }
  }

  // Format token amount for network
  formatTokenAmount(networkId, tokenSymbol, amount) {
    return multiChainService.formatTokenAmount(networkId, tokenSymbol, amount);
  }

  // Get network confirmation requirements
  getNetworkConfirmationRequirements(networkId) {
    return multiChainService.getConfirmationRequirements(networkId);
  }

  // Get network explorer URL
  getNetworkExplorerUrl(networkId, txHash) {
    return multiChainService.getExplorerUrl(networkId, txHash);
  }

  // Get network token information
  getNetworkTokenInfo(networkId, tokenSymbol) {
    return multiChainService.getTokenConfig(networkId, tokenSymbol);
  }

  // Check if token is supported on network
  isTokenSupportedOnNetwork(networkId, tokenSymbol) {
    return multiChainService.isTokenSupported(networkId, tokenSymbol);
  }

  // Get all supported tokens for network
  getSupportedTokensForNetwork(networkId) {
    return multiChainService.getNetworkTokens(networkId);
  }

  // Get network icon/emoji
  getNetworkIcon(networkId) {
    return multiChainService.getNetworkEmoji(networkId);
  }

  // Get network name
  getNetworkName(networkId) {
    return multiChainService.getNetworkName(networkId);
  }

  // Get all supported networks
  getAllSupportedNetworks() {
    return multiChainService.getAllNetworks();
  }

  // Check if network is enabled
  isNetworkEnabled(networkId) {
    return multiChainService.isNetworkEnabled(networkId);
  }

  // Get network RPC status
  async getNetworkRpcStatus(networkId) {
    try {
      const networkConfig = multiChainService.getNetworkConfig(networkId);
      if (!networkConfig || !networkConfig.rpcUrls || networkConfig.rpcUrls.length === 0) {
        return { status: 'disabled', message: 'No RPC URLs configured' };
      }

      // Test RPC connection
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpcUrls[0]);
      const network = await provider.getNetwork();
      
      return { 
        status: 'online', 
        message: 'RPC connection successful',
        chainId: network.chainId
      };
    } catch (error) {
      return { 
        status: 'offline', 
        message: `RPC connection failed: ${error.message}`
      };
    }
  }

  // Get all network statuses
  async getAllNetworkStatuses() {
    const networks = multiChainService.getAllNetworks();
    const statuses = {};

    for (const networkId of networks) {
      statuses[networkId] = await this.getNetworkRpcStatus(networkId);
    }

    return statuses;
  }

  // Get network gas price estimate
  async getNetworkGasPrice(networkId) {
    try {
      const networkConfig = multiChainService.getNetworkConfig(networkId);
      if (!networkConfig || !networkConfig.rpcUrls || networkConfig.rpcUrls.length === 0) {
        return { gasPrice: 0, currency: 'USD' };
      }

      const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpcUrls[0]);
      const gasPrice = await provider.getGasPrice();
      
      return { 
        gasPrice: parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei')),
        currency: 'Gwei'
      };
    } catch (error) {
      console.error(`Error getting gas price for ${networkId}:`, error);
      return { gasPrice: 0, currency: 'Gwei' };
    }
  }

  // Get estimated transaction cost
  async getEstimatedTransactionCost(networkId, tokenSymbol) {
    try {
      const feeEstimate = await this.getNetworkFeeEstimate(networkId, tokenSymbol);
      const gasPrice = await this.getNetworkGasPrice(networkId);
      
      return {
        ...feeEstimate,
        gasPrice: gasPrice.gasPrice,
        gasPriceCurrency: gasPrice.currency
      };
    } catch (error) {
      console.error(`Error getting estimated transaction cost for ${networkId}:`, error);
      return {
        fee: 0,
        currency: 'USD',
        usdValue: 0,
        gasPrice: 0,
        gasPriceCurrency: 'Gwei'
      };
    }
  }

  // Validate token transfer
  async validateTokenTransfer(chatId, tokenSymbol, amount, recipientAddress) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      
      // Check if token is supported
      if (!this.isTokenSupportedOnNetwork(currentNetwork, tokenSymbol)) {
        return {
          valid: false,
          error: `Token ${tokenSymbol} is not supported on ${this.getNetworkName(currentNetwork)}`
        };
      }

      // Validate recipient address
      if (!this.validateAddressForNetwork(chatId, recipientAddress)) {
        return {
          valid: false,
          error: 'Invalid recipient address for current network'
        };
      }

      // Check sufficient balance
      const hasBalance = await this.hasSufficientBalance(chatId, tokenSymbol, amount, currentNetwork);
      if (!hasBalance) {
        return {
          valid: false,
          error: 'Insufficient balance for transfer'
        };
      }

      // Check minimum transfer amount
      const minTransfer = await this.getMinimumTransfer(chatId, tokenSymbol);
      if (parseFloat(amount) < parseFloat(minTransfer)) {
        return {
          valid: false,
          error: `Minimum transfer amount is ${minTransfer} ${tokenSymbol}`
        };
      }

      return {
        valid: true,
        network: currentNetwork,
        feeEstimate: await this.getEstimatedTransactionCost(currentNetwork, tokenSymbol)
      };
    } catch (error) {
      console.error('Error validating token transfer:', error);
      return {
        valid: false,
        error: 'Failed to validate transfer'
      };
    }
  }

  // Get network statistics
  async getNetworkStatistics(networkId) {
    try {
      const networkConfig = multiChainService.getNetworkConfig(networkId);
      if (!networkConfig) return null;

      const stats = {
        network: networkId,
        name: this.getNetworkName(networkId),
        icon: this.getNetworkIcon(networkId),
        enabled: this.isNetworkEnabled(networkId),
        tokens: this.getSupportedTokensForNetwork(networkId)
      };

      // Add RPC status if enabled
      if (stats.enabled) {
        stats.rpcStatus = await this.getNetworkRpcStatus(networkId);
        stats.gasPrice = await this.getNetworkGasPrice(networkId);
      }

      return stats;
    } catch (error) {
      console.error(`Error getting network statistics for ${networkId}:`, error);
      return null;
    }
  }

  // Get all network statistics
  async getAllNetworkStatistics() {
    const networks = multiChainService.getAllNetworks();
    const statistics = {};

    for (const networkId of networks) {
      statistics[networkId] = await this.getNetworkStatistics(networkId);
    }

    return statistics;
  }
}

module.exports = MultiChainWalletService;
