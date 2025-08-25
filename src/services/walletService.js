/**
 * Wallet Service
 * Handles wallet creation, encryption, and blockchain operations
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const config = require('../config/configuration');
const { User, Wallet, Transaction } = require('../database/models');

// Ensure ethers providers are available
const providers = ethers.providers || ethers;
const utils = ethers.utils || ethers;

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
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      
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
      const formattedBalance = utils.formatUnits(balance, decimals);
      
      console.log(`💰 Real CES balance for ${address}: ${formattedBalance} CES`);
      
      return parseFloat(formattedBalance);
      
    } catch (error) {
      console.error('Error getting CES balance from blockchain:', error.message);
      
      // Return 0 for new wallets or on error
      console.log(`ℹ️ Returning 0 balance for new/empty wallet: ${address}`);
      return 0;
    }
  }

  // Get POL (native token) balance from Polygon blockchain
  async getPOLBalance(address) {
    try {
      console.log(`🔍 Checking POL balance for address: ${address}`);
      
      // Setup Polygon provider with timeout
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      
      // Set timeout for requests (10 seconds)
      provider.pollingInterval = 10000;
      
      // Get native POL balance with timeout
      const balancePromise = Promise.race([
        provider.getBalance(address),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC timeout')), 15000)
        )
      ]);
      
      const balance = await balancePromise;
      
      // Convert from wei to human readable format (POL has 18 decimals)
      const formattedBalance = utils.formatEther(balance);
      
      console.log(`💎 POL balance for ${address}: ${formattedBalance} POL`);
      
      return parseFloat(formattedBalance);
      
    } catch (error) {
      console.error('Error getting POL balance from blockchain:', error.message);
      
      // Return 0 for new wallets or on error
      console.log(`ℹ️ Returning 0 POL balance for new/empty wallet: ${address}`);
      return 0;
    }
  }

  // Get available balance (excluding escrow)
  async getAvailableBalance(user, tokenType) {
    try {
      // Get real blockchain balance
      const realBalance = tokenType === 'CES' 
        ? await this.getCESBalance(user.walletAddress)
        : await this.getPOLBalance(user.walletAddress);
      
      // Subtract escrowed amount
      const escrowedAmount = tokenType === 'CES' 
        ? (user.escrowCESBalance || 0)
        : (user.escrowPOLBalance || 0);
      
      const availableBalance = Math.max(0, realBalance - escrowedAmount);
      
      console.log(`🔍 ${tokenType} balance for user ${user.chatId}: Real: ${realBalance}, Escrowed: ${escrowedAmount}, Available: ${availableBalance}`);
      
      return availableBalance;
      
    } catch (error) {
      console.error(`Error getting available ${tokenType} balance:`, error);
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

      // Get current balances for both CES and POL
      const [cesBalance, polBalance] = await Promise.all([
        this.getCESBalance(user.walletAddress),
        this.getPOLBalance(user.walletAddress)
      ]);
      
      // Calculate available balances (excluding escrowed amounts)
      const availableCESBalance = await this.getAvailableBalance(user, 'CES');
      const availablePOLBalance = await this.getAvailableBalance(user, 'POL');
      
      // Update balances in database
      user.cesBalance = cesBalance;
      user.polBalance = polBalance;
      user.lastBalanceUpdate = new Date();
      await user.save();

      return {
        hasWallet: true,
        address: user.walletAddress,
        cesBalance: availableCESBalance, // Return available balance instead of total
        polBalance: availablePOLBalance, // Return available balance instead of total
        totalCESBalance: cesBalance, // Keep total for reference
        totalPOLBalance: polBalance, // Keep total for reference
        escrowCESBalance: user.escrowCESBalance || 0,
        escrowPOLBalance: user.escrowPOLBalance || 0,
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

  // Send POL tokens (native currency) to another user
  async sendPOLTokens(fromChatId, toAddress, amount) {
    try {
      console.log(`💸 Initiating POL transfer: ${amount} POL from ${fromChatId} to ${toAddress}`);
      
      // Get sender info
      const fromUser = await User.findOne({ chatId: fromChatId });
      if (!fromUser || !fromUser.walletAddress) {
        throw new Error('Отправитель не найден или у него нет кошелька');
      }
      
      // Validate amount
      if (amount <= 0) {
        throw new Error('Сумма должна быть больше 0');
      }
      
      // Check balance - use available balance excluding escrow
      const availableBalance = await this.getAvailableBalance(fromUser, 'POL');
      if (availableBalance < amount) {
        throw new Error(`Недостаточно POL. Доступно: ${availableBalance.toFixed(4)} POL`);
      }
      
      // Reserve some POL for gas (0.001 POL minimum)
      const gasReserve = 0.001;
      if (currentBalance - amount < gasReserve) {
        throw new Error(`Оставьте минимум ${gasReserve} POL для комиссии`);
      }
      
      // Validate recipient address
      if (!utils.isAddress(toAddress)) {
        throw new Error('Неверный адрес получателя');
      }
      
      // Prevent self-transfer
      if (fromUser.walletAddress.toLowerCase() === toAddress.toLowerCase()) {
        throw new Error('Нельзя переводить самому себе');
      }
      
      // Get recipient user (if exists in our system)
      const toUser = await User.findOne({ walletAddress: toAddress });
      
      // Setup blockchain transaction
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      
      // Get sender's private key
      const privateKey = await this.getUserPrivateKey(fromChatId);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      // Convert amount to wei
      const transferAmount = utils.parseEther(amount.toString());
      
      // Create transaction record
      const transaction = new Transaction({
        fromUserId: fromUser._id,
        toUserId: toUser ? toUser._id : null,
        fromAddress: fromUser.walletAddress,
        toAddress: toAddress,
        amount: amount,
        tokenType: 'POL',
        type: 'p2p',
        status: 'pending'
      });
      
      await transaction.save();
      
      console.log(`📝 POL Transaction record created: ${transaction._id}`);
      
      // Execute blockchain transaction (native transfer)
      try {
        // Estimate gas and set appropriate gas limit
        const gasEstimate = await provider.estimateGas({
          to: toAddress,
          value: transferAmount,
          from: fromUser.walletAddress
        });
        
        const tx = await wallet.sendTransaction({
          to: toAddress,
          value: transferAmount,
          gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
          gasPrice: await provider.getFeeData().then(feeData => feeData.gasPrice)
        });
        
        console.log(`⏳ POL Transaction sent to blockchain: ${tx.hash}`);
        
        // Update transaction with hash
        transaction.txHash = tx.hash;
        await transaction.save();
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          // Transaction successful
          transaction.status = 'completed';
          transaction.completedAt = new Date();
          await transaction.save();
          
          console.log(`✅ POL transfer completed: ${tx.hash}`);
          
          return {
            success: true,
            txHash: tx.hash,
            amount: amount,
            toAddress: toAddress,
            transaction: transaction
          };
        } else {
          throw new Error('Transaction failed on blockchain');
        }
        
      } catch (blockchainError) {
        // Mark transaction as failed
        try {
          transaction.status = 'failed';
          await transaction.save();
        } catch (saveError) {
          console.error('Failed to save transaction status:', saveError);
        }
        
        console.error('POL Blockchain transaction error:', blockchainError);
        throw new Error(`Ошибка выполнения транзакции: ${blockchainError.message || blockchainError}`);
      }
      
    } catch (error) {
      console.error('Error sending POL tokens:', error);
      throw error;
    }
  }
  async sendCESTokens(fromChatId, toAddress, amount) {
    try {
      console.log(`💸 Initiating CES transfer: ${amount} CES from ${fromChatId} to ${toAddress}`);
      
      // Get sender info
      const fromUser = await User.findOne({ chatId: fromChatId });
      if (!fromUser || !fromUser.walletAddress) {
        throw new Error('Отправитель не найден или у него нет кошелька');
      }
      
      // Validate amount
      if (amount <= 0) {
        throw new Error('Сумма должна быть больше 0');
      }
      
      // Check balance - use available balance excluding escrow
      const availableBalance = await this.getAvailableBalance(fromUser, 'CES');
      if (availableBalance < amount) {
        throw new Error(`Недостаточно доступных средств. Доступно: ${availableBalance.toFixed(4)} CES (некоторые средства могут быть заблокированы в эскроу)`);
      }
      
      // Validate recipient address
      if (!ethers.isAddress(toAddress)) {
        throw new Error('Неверный адрес получателя');
      }
      
      // Prevent self-transfer
      if (fromUser.walletAddress.toLowerCase() === toAddress.toLowerCase()) {
        throw new Error('Нельзя переводить самому себе');
      }
      
      // Get recipient user (if exists in our system)
      const toUser = await User.findOne({ walletAddress: toAddress });
      
      // Setup blockchain transaction
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      
      // Get sender's private key
      const privateKey = await this.getUserPrivateKey(fromChatId);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      // ERC-20 ABI for transfer
      const erc20Abi = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address owner) view returns (uint256)"
      ];
      
      // Create contract instance
      const contract = new ethers.Contract(
        config.wallet.cesContractAddress,
        erc20Abi,
        wallet
      );
      
      // Get token decimals
      const decimals = await contract.decimals();
      const transferAmount = utils.parseUnits(amount.toString(), decimals);
      
      // Create transaction record
      const transaction = new Transaction({
        fromUserId: fromUser._id,
        toUserId: toUser ? toUser._id : null,
        fromAddress: fromUser.walletAddress,
        toAddress: toAddress,
        amount: amount,
        tokenType: 'CES',
        type: 'p2p',
        status: 'pending'
      });
      
      await transaction.save();
      
      console.log(`📝 Transaction record created: ${transaction._id}`);
      
      // Execute blockchain transaction
      try {
        // Estimate gas and set appropriate gas limit for ERC-20 transfer
        const gasEstimate = await contract.transfer.estimateGas(toAddress, transferAmount);
        
        const tx = await contract.transfer(toAddress, transferAmount, {
          gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
        });
        
        console.log(`⏳ Transaction sent to blockchain: ${tx.hash}`);
        
        // Update transaction with hash
        transaction.txHash = tx.hash;
        await transaction.save();
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          // Transaction successful
          transaction.status = 'completed';
          transaction.completedAt = new Date();
          await transaction.save();
          
          console.log(`✅ CES transfer completed: ${tx.hash}`);
          
          return {
            success: true,
            txHash: tx.hash,
            amount: amount,
            toAddress: toAddress,
            transaction: transaction
          };
        } else {
          throw new Error('Transaction failed on blockchain');
        }
        
      } catch (blockchainError) {
        // Mark transaction as failed
        try {
          transaction.status = 'failed';
          await transaction.save();
        } catch (saveError) {
          console.error('Failed to save transaction status:', saveError);
        }
        
        console.error('Blockchain transaction error:', blockchainError);
        throw new Error(`Ошибка выполнения транзакции: ${blockchainError.message || blockchainError}`);
      }
      
    } catch (error) {
      console.error('Error sending CES tokens:', error);
      throw error;
    }
  }

  // Get user's transaction history
  async getUserTransactions(chatId, limit = 10) {
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        throw new Error('User not found');
      }
      
      const transactions = await Transaction.find({
        $or: [
          { fromUserId: user._id },
          { toUserId: user._id }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('fromUserId', 'username firstName')
      .populate('toUserId', 'username firstName');
      
      return transactions;
      
    } catch (error) {
      console.error('Error getting user transactions:', error);
      throw error;
    }
  }

  // Find user by wallet address
  async findUserByAddress(address) {
    try {
      const user = await User.findOne({ walletAddress: address });
      return user;
    } catch (error) {
      console.error('Error finding user by address:', error);
      return null;
    }
  }
}

module.exports = new WalletService();