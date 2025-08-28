/**
 * User Network Preferences Service
 * Manages user's selected blockchain network and related settings
 */

const { User } = require('../database/models');
const multiChainService = require('./multiChainService');

class UserNetworkService {
  constructor() {
    this.defaultNetwork = 'polygon';
  }

  // Get user's current network
  async getUserNetwork(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        return this.defaultNetwork;
      }

      // Return stored network or default
      return user.selectedNetwork || this.defaultNetwork;
    } catch (error) {
      console.error('Error getting user network:', error);
      return this.defaultNetwork;
    }
  }

  // Set user's network preference
  async setUserNetwork(chatId, networkId) {
    try {
      // Validate network
      if (!multiChainService.isNetworkSupported(networkId)) {
        throw new Error(`Unsupported network: ${networkId}`);
      }

      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('User not found');
      }

      // Update user's network preference
      user.selectedNetwork = networkId;
      user.lastNetworkSwitch = new Date();
      await user.save();

      console.log(`✅ User ${chatId} switched to network: ${networkId}`);
      return true;
    } catch (error) {
      console.error('Error setting user network:', error);
      throw error;
    }
  }

  // Get user's wallet info for current network
  async getUserWalletForNetwork(chatId, networkId = null) {
    try {
      const user = await User.findOne({ chatId });
      if (!user || !user.walletAddress) {
        return { hasWallet: false };
      }

      const currentNetwork = networkId || await this.getUserNetwork(chatId);
      const networkConfig = multiChainService.getNetworkConfig(currentNetwork);
      
      if (!networkConfig) {
        throw new Error(`Invalid network: ${currentNetwork}`);
      }

      // Check if wallet actually exists in the specified network
      const hasActualWallet = await this.checkWalletExistsInNetwork(user.walletAddress, currentNetwork);
      
      // For networks where wallet can be used (EVM-compatible), return wallet info even if not specifically created there
      if (hasActualWallet || 
          (user.walletAddress && ['bsc', 'arbitrum', 'avalanche'].includes(currentNetwork))) {
        console.log(`✅ User ${chatId} has wallet available in network ${currentNetwork}`);
        return {
          hasWallet: true,
          address: user.walletAddress,
          network: currentNetwork,
          networkName: networkConfig.name,
          networkEmoji: multiChainService.getNetworkEmoji(currentNetwork)
        };
      }

      console.log(`⚠️ User ${chatId} has no wallet in network ${currentNetwork} - wallet exists only in networks where it was created`);
      return { 
        hasWallet: false,
        address: user.walletAddress,
        network: currentNetwork,
        networkName: networkConfig.name,
        networkEmoji: multiChainService.getNetworkEmoji(currentNetwork)
      };
    } catch (error) {
      console.error('Error getting user wallet for network:', error);
      return { hasWallet: false };
    }
  }

  // Check if wallet actually exists in the specified network
  async checkWalletExistsInNetwork(address, networkId) {
    try {
      // For simplicity, we'll check if the address has any activity/balance in the network
      // This is a basic implementation - in production you might want more sophisticated checks
      
      switch (networkId) {
        case 'polygon':
          // For Polygon, if user has walletAddress in database, assume wallet exists
          // This is because wallets are created in Polygon by default
          // We don't check balance because wallet can exist with zero balance
          const { User } = require('../database/models');
          const user = await User.findOne({ walletAddress: address });
          
          if (user) {
            console.log(`✅ Wallet ${address} exists in Polygon (found in database)`);
            return true;
          }
          
          console.log(`❌ Wallet ${address} not found in database for Polygon`);
          return false;
          
        case 'tron':
        case 'bsc':
        case 'solana':
        case 'arbitrum':
        case 'avalanche':
        case 'ton':
          // For other networks, if user has walletAddress in database, assume wallet can be used
          // The same wallet address can be used across EVM-compatible chains (Polygon, BSC, Arbitrum, Avalanche)
          // For non-EVM chains (Tron, Solana, TON), we need to check specifically
          
          const { User: UserModel } = require('../database/models');
          const existingUser = await UserModel.findOne({ walletAddress: address });
          
          if (existingUser) {
            // For EVM-compatible chains, the same wallet can be used
            if (['bsc', 'arbitrum', 'avalanche'].includes(networkId)) {
              console.log(`✅ Wallet ${address} can be used in EVM-compatible network ${networkId}`);
              return true;
            }
            
            // For non-EVM chains, we would need specific checks
            // For now, we'll assume the wallet exists but may need special handling
            console.log(`⚠️ Wallet ${address} exists but may need special handling for ${networkId}`);
            return true;
          }
          
          console.log(`❌ Wallet ${address} not found in database for network ${networkId}`);
          return false;
          
        default:
          console.log(`❌ Unknown network ${networkId}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Error checking wallet existence in ${networkId}:`, error);
      // On error, be conservative and assume wallet doesn't exist
      return false;
    }
  }

  // Get formatted network info for user
  async getNetworkInfo(chatId) {
    try {
      const currentNetwork = await this.getUserNetwork(chatId);
      const networkConfig = multiChainService.getNetworkConfig(currentNetwork);
      
      if (!networkConfig) {
        return 'Unknown Network';
      }

      const emoji = multiChainService.getNetworkEmoji(currentNetwork);
      return `${emoji} ${networkConfig.name}`;
    } catch (error) {
      console.error('Error getting network info:', error);
      return '🔗 Unknown Network';
    }
  }

  // Get all supported tokens for user's current network
  async getUserSupportedTokens(chatId) {
    try {
      const currentNetwork = await this.getUserNetwork(chatId);
      return multiChainService.getNetworkTokens(currentNetwork);
    } catch (error) {
      console.error('Error getting user supported tokens:', error);
      return {};
    }
  }

  // Check if user can switch to network
  async canSwitchToNetwork(chatId, networkId) {
    try {
      // Basic validation
      if (!multiChainService.isNetworkSupported(networkId)) {
        return { allowed: false, reason: 'Network not supported' };
      }

      const user = await User.findOne({ chatId });
      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      // Check if user has wallet
      if (!user.walletAddress) {
        return { allowed: false, reason: 'Wallet required for network switching' };
      }

      // Check rate limiting (max 10 switches per day)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentSwitches = user.networkSwitches?.filter(
        switchDate => new Date(switchDate) > dayAgo
      ).length || 0;

      if (recentSwitches >= 10) {
        return { allowed: false, reason: 'Too many network switches today (max 10)' };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking network switch permission:', error);
      return { allowed: false, reason: 'Error checking permissions' };
    }
  }

  // Record network switch
  async recordNetworkSwitch(chatId, fromNetwork, toNetwork) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) return;

      // Initialize array if not exists
      if (!user.networkSwitches) {
        user.networkSwitches = [];
      }

      // Add switch record
      user.networkSwitches.push({
        from: fromNetwork,
        to: toNetwork,
        timestamp: new Date()
      });

      // Keep only last 20 switches
      if (user.networkSwitches.length > 20) {
        user.networkSwitches = user.networkSwitches.slice(-20);
      }

      await user.save();
    } catch (error) {
      console.error('Error recording network switch:', error);
    }
  }

  // Get network switching statistics
  async getNetworkStats(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user || !user.networkSwitches) {
        return {
          totalSwitches: 0,
          todaySwitches: 0,
          favoriteNetwork: this.defaultNetwork
        };
      }

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const todaySwitches = user.networkSwitches.filter(
        record => new Date(record.timestamp) > dayAgo
      ).length;

      // Calculate favorite network
      const networkCounts = {};
      user.networkSwitches.forEach(record => {
        networkCounts[record.to] = (networkCounts[record.to] || 0) + 1;
      });

      const favoriteNetwork = Object.keys(networkCounts).reduce((a, b) => 
        networkCounts[a] > networkCounts[b] ? a : b
      , this.defaultNetwork);

      return {
        totalSwitches: user.networkSwitches.length,
        todaySwitches,
        favoriteNetwork
      };
    } catch (error) {
      console.error('Error getting network stats:', error);
      return {
        totalSwitches: 0,
        todaySwitches: 0,
        favoriteNetwork: this.defaultNetwork
      };
    }
  }
}

module.exports = new UserNetworkService();