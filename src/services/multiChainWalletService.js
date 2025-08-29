/**
 * Multi-Chain Wallet Service
 * Handles wallet operations across different blockchain networks
 */

const { ethers } = require('ethers');

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

  // Get user's current network wallet info
  async getCurrentNetworkWalletInfo(chatId) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const walletInfo = await userNetworkService.getUserWalletForNetwork(chatId, currentNetwork);
      
      if (!walletInfo.hasWallet) {
        return {
          hasWallet: false,
          network: currentNetwork,
          networkName: multiChainService.getNetworkName(currentNetwork),
          networkEmoji: multiChainService.getNetworkEmoji(currentNetwork)
        };
      }

      // Get balances for the network
      const balances = await this.getNetworkBalances(walletInfo.address, currentNetwork);
      const prices = await this.getTokenPrices(currentNetwork);
      
      // Format the data
      const formattedBalances = this.formatBalances(currentNetwork, balances, prices);
      const totalValue = this.calculateTotalValue(balances, prices);

      return {
        hasWallet: true,
        network: currentNetwork,
        networkName: multiChainService.getNetworkName(currentNetwork),
        networkEmoji: multiChainService.getNetworkEmoji(currentNetwork),
        address: walletInfo.address,
        balances: formattedBalances,
        totalValue: totalValue
      };
    } catch (error) {
      console.error('Error getting current network wallet info:', error);
      throw error;
    }
  }

  // Check if user has sufficient balance for a token on current network
  async hasSufficientBalance(chatId, tokenSymbol, amount) {
    try {
      const walletInfo = await this.getCurrentNetworkWalletInfo(chatId);
      if (!walletInfo.hasWallet) return false;

      const balance = walletInfo.balances[tokenSymbol]?.balance || 0;
      return parseFloat(balance) >= parseFloat(amount);
    } catch (error) {
      console.error('Error checking sufficient balance:', error);
      return false;
    }
  }

  // Get formatted wallet display for user
  async getWalletDisplayForUser(chatId) {
    try {
      const walletInfo = await this.getCurrentNetworkWalletInfo(chatId);
      
      if (!walletInfo.hasWallet) {
        return {
          hasWallet: false,
          message: 'У вас нет кошелька в текущей сети.',
          networkInfo: `${walletInfo.networkEmoji} ${walletInfo.networkName}`
        };
      }

      let message = `👛 ${walletInfo.networkEmoji} ${walletInfo.networkName}\n`;
      message += `➖➖➖➖➖➖➖➖➖➖➖\n`;
      message += `Адрес: \`${walletInfo.address}\`\n\n`;
      message += `💰 Балансы:\n`;

      // Add each token balance
      for (const [tokenSymbol, tokenData] of Object.entries(walletInfo.balances)) {
        if (parseFloat(tokenData.balance) > 0) {
          message += `${tokenData.displayText}\n`;
        }
      }

      message += `\n💎 Общая стоимость: $${walletInfo.totalValue.usd} • ₽${walletInfo.totalValue.rub}`;

      return {
        hasWallet: true,
        message: message,
        networkInfo: `${walletInfo.networkEmoji} ${walletInfo.networkName}`,
        address: walletInfo.address,
        totalValue: walletInfo.totalValue
      };
    } catch (error) {
      console.error('Error getting wallet display for user:', error);
      throw error;
    }
  }

  // Get network selector options
  getNetworkSelectorOptions(currentNetwork) {
    return multiChainService.getNetworkSelectorButtons(currentNetwork);
  }

  // Validate that a token is supported on the current network
  async isTokenSupportedOnCurrentNetwork(chatId, tokenSymbol) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.isTokenSupported(currentNetwork, tokenSymbol);
    } catch (error) {
      console.error('Error checking token support:', error);
      return false;
    }
  }

  // Get all supported tokens for current network
  async getSupportedTokensForCurrentUser(chatId) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.getNetworkTokens(currentNetwork);
    } catch (error) {
      console.error('Error getting supported tokens:', error);
      return {};
    }
  }

  // Get minimum transfer amount for current network
  async getMinimumTransferForCurrentUser(chatId, tokenSymbol) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.getMinimumTransferAmount(currentNetwork, tokenSymbol);
    } catch (error) {
      console.error('Error getting minimum transfer amount:', error);
      return 0.001;
    }
  }

  // Format token amount for display
  async formatTokenAmountForCurrentUser(chatId, tokenSymbol, amount) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.formatTokenAmount(currentNetwork, tokenSymbol, amount);
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return amount.toString();
    }
  }

  // Get network transaction fee estimate
  async getNetworkFeeEstimateForCurrentUser(chatId, tokenSymbol) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.estimateNetworkFee(currentNetwork, tokenSymbol);
    } catch (error) {
      console.error('Error getting network fee estimate:', error);
      return { estimatedFee: 0, currency: 'USD' };
    }
  }

  // Get network explorer URL for transaction
  async getNetworkExplorerUrlForTransaction(chatId, txHash) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      return multiChainService.getExplorerUrl(currentNetwork, txHash);
    } catch (error) {
      console.error('Error getting explorer URL:', error);
      return null;
    }
  }

  // Get network status information
  async getNetworkStatus(chatId) {
    try {
      const currentNetwork = await userNetworkService.getUserNetwork(chatId);
      const networkConfig = multiChainService.getNetworkConfig(currentNetwork);
      
      if (!networkConfig) {
        return {
          network: currentNetwork,
          status: 'unsupported',
          message: 'Сеть не поддерживается'
        };
      }

      // Check if network is enabled
      if (!multiChainService.isNetworkEnabled(currentNetwork)) {
        return {
          network: currentNetwork,
          status: 'disabled',
          message: 'Сеть временно отключена'
        };
      }

      return {
        network: currentNetwork,
        status: 'active',
        message: 'Сеть активна и доступна',
        name: multiChainService.getNetworkName(currentNetwork),
        emoji: multiChainService.getNetworkEmoji(currentNetwork)
      };
    } catch (error) {
      console.error('Error getting network status:', error);
      return {
        network: 'unknown',
        status: 'error',
        message: 'Ошибка проверки статуса сети'
      };
    }
  }

  // Get all network information for user
  async getAllNetworkInfoForUser(chatId) {
    try {
      const networks = multiChainService.getAllNetworks();
      const userNetwork = await userNetworkService.getUserNetwork(chatId);
      const info = {};

      for (const networkId of networks) {
        const networkConfig = multiChainService.getNetworkConfig(networkId);
        if (!networkConfig) continue;

        const isCurrent = networkId === userNetwork;
        const isEnabled = multiChainService.isNetworkEnabled(networkId);
        const tokens = multiChainService.getNetworkTokens(networkId);

        info[networkId] = {
          id: networkId,
          name: multiChainService.getNetworkName(networkId),
          emoji: multiChainService.getNetworkEmoji(networkId),
          enabled: isEnabled,
          current: isCurrent,
          tokens: Object.keys(tokens)
        };
      }

      return info;
    } catch (error) {
      console.error('Error getting all network info:', error);
      return {};
    }
  }
}

module.exports = MultiChainWalletService;