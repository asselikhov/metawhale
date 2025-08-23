/**
 * Wallet Service
 * Handles wallet creation, encryption, and blockchain operations
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const config = require('../config/configuration');
const { User, Wallet } = require('../database/models');

class WalletService {
  constructor() {
    // Ensure we have a 32-byte key for AES-256
    const keySource = config.wallet.encryptionKey || 'default-wallet-encryption-key-for-ces-bot';
    this.encryptionKey = crypto.scryptSync(keySource, 'salt', 32);
    this.ivLength = config.constants.ivLength;
  }

  // Encrypt private key
  encryptPrivateKey(privateKey) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  // Decrypt private key
  decryptPrivateKey(encryptedData) {
    const parts = encryptedData.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Create new wallet for user
  async createUserWallet(chatId) {
    try {
      // Check if user exists
      let user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('User not found. Please execute /start');
      }
      
      if (user.walletAddress) {
        throw new Error(`You already have a wallet: ${user.walletAddress}`);
      }
      
      // Create new wallet
      const wallet = ethers.Wallet.createRandom();
      const encryptedPrivateKey = this.encryptPrivateKey(wallet.privateKey);
      
      // Save to database
      const newWallet = new Wallet({
        userId: user._id,
        address: wallet.address,
        encryptedPrivateKey: encryptedPrivateKey
      });
      
      await newWallet.save();
      
      // Update user
      user.walletAddress = wallet.address;
      user.walletCreatedAt = new Date();
      await user.save();
      
      console.log(`✅ Wallet created for user ${chatId}: ${wallet.address}`);
      
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        user: user
      };
      
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  }

  // Get CES token balance from Polygon blockchain
  async getCESBalance(address) {
    try {
      console.log(`🔍 Checking real CES balance for address: ${address}`);
      
      // Setup Polygon provider with timeout
      const provider = new ethers.JsonRpcProvider(config.wallet.polygonRpcUrl, {
        name: 'polygon',
        chainId: 137
      });
      
      // Set timeout for requests (10 seconds)
      provider.pollingInterval = 10000;
      
      // ERC-20 ABI for balanceOf function
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];
      
      // Create contract instance
      const contract = new ethers.Contract(
        config.wallet.cesContractAddress, 
        erc20Abi, 
        provider
      );
      
      // Get balance and decimals with timeout
      const balancePromise = Promise.race([
        Promise.all([
          contract.balanceOf(address),
          contract.decimals()
        ]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC timeout')), 15000)
        )
      ]);
      
      const [balance, decimals] = await balancePromise;
      
      // Convert from wei to human readable format
      const formattedBalance = ethers.formatUnits(balance, decimals);
      
      console.log(`💰 Real CES balance for ${address}: ${formattedBalance} CES`);
      
      return parseFloat(formattedBalance);
      
    } catch (error) {
      console.error('Error getting CES balance from blockchain:', error.message);
      
      // Return 0 for new wallets or on error
      console.log(`ℹ️ Returning 0 balance for new/empty wallet: ${address}`);
      return 0;
    }
  }

  // Get user's wallet info
  async getUserWallet(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        return null;
      }

      if (!user.walletAddress) {
        return { hasWallet: false, user };
      }

      // Get current balance
      const cesBalance = await this.getCESBalance(user.walletAddress);
      
      // Update balance in database
      user.cesBalance = cesBalance;
      user.lastBalanceUpdate = new Date();
      await user.save();

      return {
        hasWallet: true,
        address: user.walletAddress,
        balance: cesBalance,
        lastUpdate: user.lastBalanceUpdate,
        user
      };
      
    } catch (error) {
      console.error('Error getting user wallet:', error);
      throw error;
    }
  }

  // Get private key for user (encrypted)
  async getUserPrivateKey(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user || !user.walletAddress) {
        throw new Error('Wallet not found');
      }
      
      const wallet = await Wallet.findOne({ userId: user._id });
      if (!wallet) {
        throw new Error('Private key not found');
      }
      
      const privateKey = this.decryptPrivateKey(wallet.encryptedPrivateKey);
      return privateKey;
      
    } catch (error) {
      console.error('Error getting private key:', error);
      throw error;
    }
  }

  // Delete user wallet
  async deleteUserWallet(chatId) {
    try {
      const user = await User.findOne({ chatId });
      if (!user || !user.walletAddress) {
        throw new Error('Wallet not found');
      }
      
      // Remove wallet from database
      await Wallet.deleteOne({ userId: user._id });
      
      // Update user
      user.walletAddress = null;
      user.walletCreatedAt = null;
      user.cesBalance = 0;
      user.lastBalanceUpdate = null;
      await user.save();
      
      console.log(`✅ Wallet deleted for user ${chatId}`);
      return true;
      
    } catch (error) {
      console.error('Error deleting wallet:', error);
      throw error;
    }
  }
}

module.exports = new WalletService();