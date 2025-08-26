/**
 * Wallet Service
 * Handles wallet creation, encryption, and blockchain operations
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const config = require('../config/configuration');
const { User, Wallet, Transaction } = require('../database/models');
const rpcService = require('./rpcService');

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
      
      // Use reliable RPC service
      const { balance, decimals } = await rpcService.getTokenBalance(
        config.wallet.cesContractAddress,
        address
      );
      
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
      
      // Use reliable RPC service
      const balance = await rpcService.getBalance(address);
      
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

  // Auto-approve CES tokens for escrow contract
  async autoApproveCESTokens(chatId, amount) {
    try {
      console.log(`🔐 Auto-approving ${amount} CES tokens for user ${chatId}`);
      
      // Get user
      const user = await User.findOne({ chatId });
      if (!user || !user.walletAddress) {
        throw new Error('Пользователь или кошелек не найден');
      }
      
      // Get user's private key
      const privateKey = await this.getUserPrivateKey(chatId);
      if (!privateKey) {
        throw new Error('Не удалось получить приватный ключ');
      }
      
      // Setup wallet and contracts
      const provider = new providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
      const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
      
      if (!cesTokenAddress || !escrowContractAddress) {
        throw new Error('Адреса контрактов не настроены');
      }
      
      const erc20Abi = [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)"
      ];
      
      const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, wallet);
      const amountWei = utils.parseEther(amount.toString());
      
      // Check current allowance
      const currentAllowance = await cesContract.allowance(user.walletAddress, escrowContractAddress);
      
      console.log(`📊 Current allowance: ${utils.formatEther(currentAllowance)} CES`);
      console.log(`📊 Required amount: ${amount} CES`);
      
      // If allowance is sufficient, no need to approve again
      if (currentAllowance.gte(amountWei)) {
        console.log('✅ Sufficient allowance already exists');
        return { success: true, txHash: null, message: 'Одобрение уже есть' };
      }
      
      // Execute approval transaction with proper EIP-1559 gas pricing
      console.log('🔐 Executing automatic approval transaction...');
      
      // Get current gas prices for EIP-1559
      const feeData = await rpcService.getFeeData();
      
      // Set gas prices with proper values for Polygon network
      const minGasPrice = utils.parseUnits('30', 'gwei'); // 30 Gwei minimum
      const maxGasPrice = utils.parseUnits('200', 'gwei'); // 200 Gwei maximum
      
      let maxFeePerGas, maxPriorityFeePerGas;
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // Use network suggested prices with 150% buffer and enforce minimums
        maxFeePerGas = feeData.maxFeePerGas.mul(150).div(100);
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(150).div(100);
        
        // Enforce minimum values
        if (maxFeePerGas.lt(minGasPrice)) maxFeePerGas = minGasPrice;
        if (maxPriorityFeePerGas.lt(minGasPrice)) maxPriorityFeePerGas = minGasPrice;
        
        // Enforce maximum values to prevent overpaying
        if (maxFeePerGas.gt(maxGasPrice)) maxFeePerGas = maxGasPrice;
        if (maxPriorityFeePerGas.gt(maxGasPrice)) maxPriorityFeePerGas = maxGasPrice;
      } else {
        // Fallback to safe defaults for Polygon
        maxFeePerGas = utils.parseUnits('50', 'gwei');
        maxPriorityFeePerGas = utils.parseUnits('30', 'gwei');
      }
      
      console.log(`🔥 Approval Gas prices: maxFeePerGas=${utils.formatUnits(maxFeePerGas, 'gwei')} Gwei, maxPriorityFeePerGas=${utils.formatUnits(maxPriorityFeePerGas, 'gwei')} Gwei`);
      
      const tx = await cesContract.approve(escrowContractAddress, amountWei, {
        gasLimit: 100000,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        type: 2 // EIP-1559 transaction
      });
      
      console.log(`⏳ Approval transaction sent: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Approval transaction confirmed: ${tx.hash}`);
        return { 
          success: true, 
          txHash: tx.hash, 
          message: 'Токены успешно одобрены для эскроу' 
        };
      } else {
        throw new Error('Транзакция одобрения не удалась');
      }
      
    } catch (error) {
      console.error('Error auto-approving CES tokens:', error);
      throw new Error(`Ошибка автоматического одобрения: ${error.message}`);
    }
  }

  // Get available balance (excluding escrow)
  async getAvailableBalance(user, tokenType) {
    try {
      // Check for balance protection for CES tokens
      if (tokenType === 'CES' && (user.balanceProtectionEnabled || user.adminAllocationAmount > 0 || user.adminProtected || user.skipBalanceSync || user.manualBalance)) {
        console.log(`🔒 [AVAILABLE-BALANCE] CES balance protected for user ${user.chatId}`);
        console.log(`    Using database balance: ${user.cesBalance || 0} CES`);
        
        // For protected CES, use database balance minus escrow
        const escrowedAmount = user.escrowCESBalance || 0;
        const availableBalance = Math.max(0, (user.cesBalance || 0) - escrowedAmount);
        
        console.log(`🔍 Protected CES balance for user ${user.chatId}: DB: ${user.cesBalance || 0}, Escrowed: ${escrowedAmount}, Available: ${availableBalance}`);
        return availableBalance;
      }
      
      // For unprotected tokens or POL, get real blockchain balance
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

  // Check transaction status asynchronously
  async checkTransactionAsync(transactionId, txHash) {
    try {
      console.log(`🔍 Starting async check for transaction ${txHash}`);
      
      // Wait for confirmation with longer timeout in background
      const receipt = await rpcService.waitForTransactionAsync(txHash, 1, 300000); // 5 minute timeout
      
      // Update transaction status
      const transaction = await Transaction.findById(transactionId);
      if (transaction) {
        if (receipt.status === 1) {
          transaction.status = 'completed';
          transaction.completedAt = new Date();
          console.log(`✅ Transaction ${txHash} confirmed successfully`);
        } else {
          transaction.status = 'failed';
          console.log(`❌ Transaction ${txHash} failed`);
        }
        await transaction.save();
      }
      
    } catch (error) {
      console.error(`⚠️ Async transaction check failed for ${txHash}:`, error.message);
      
      // Mark as pending if we can't confirm (might still be processing)
      try {
        const transaction = await Transaction.findById(transactionId);
        if (transaction && transaction.status === 'pending') {
          // Keep as pending - transaction might still be processing
          console.log(`🕰️ Transaction ${txHash} still pending after timeout`);
        }
      } catch (dbError) {
        console.error('Error updating transaction status:', dbError);
      }
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

      // Check for balance protection FIRST - don't overwrite admin allocations
      const hasBalanceProtection = user.balanceProtectionEnabled || 
                                   user.adminAllocationAmount > 0 || 
                                   user.adminProtected ||
                                   user.skipBalanceSync ||
                                   user.manualBalance;
      
      if (hasBalanceProtection) {
        console.log(`🔒 [WALLET-SERVICE] Balance protection active for user ${user.chatId}`);
        console.log(`    Admin allocation: ${user.adminAllocationAmount || 0} CES`);
        console.log(`    Protection flags: { balanceProtectionEnabled: ${user.balanceProtectionEnabled}, adminProtected: ${user.adminProtected}, skipBalanceSync: ${user.skipBalanceSync}, manualBalance: ${user.manualBalance} }`);
        console.log(`    Skipping automatic balance update`);
        
        // For protected accounts, get POL balance only (CES is protected)
        const polBalance = await this.getPOLBalance(user.walletAddress);
        const availablePOLBalance = await this.getAvailableBalance(user, 'POL');
        
        // Return current database balances without blockchain sync
        return {
          hasWallet: true,
          address: user.walletAddress,
          cesBalance: user.cesBalance || 0, // Use protected database balance
          polBalance: polBalance, // POL can still be updated
          totalCESBalance: user.cesBalance || 0,
          totalPOLBalance: polBalance,
          availableCESBalance: user.cesBalance || 0, // Protected CES balance
          availablePOLBalance: availablePOLBalance,
          escrowCESBalance: user.escrowCESBalance || 0,
          escrowPOLBalance: user.escrowPOLBalance || 0,
          lastUpdate: user.lastBalanceUpdate,
          protected: true,
          protectionReason: user.adminAllocationReason || 'Balance protection enabled',
          user
        };
      }

      // For unprotected accounts, get current balances from blockchain
      const [cesBalance, polBalance] = await Promise.all([
        this.getCESBalance(user.walletAddress),
        this.getPOLBalance(user.walletAddress)
      ]);
      
      // Calculate available balances (excluding escrowed amounts)
      const availableCESBalance = await this.getAvailableBalance(user, 'CES');
      const availablePOLBalance = await this.getAvailableBalance(user, 'POL');
      
      // Update balances in database (only if not protected)
      user.cesBalance = cesBalance;
      user.polBalance = polBalance;
      user.lastBalanceUpdate = new Date();
      await user.save();

      return {
        hasWallet: true,
        address: user.walletAddress,
        cesBalance: cesBalance, // Show total balance instead of available only
        polBalance: polBalance, // Show total balance instead of available only  
        totalCESBalance: cesBalance, // Keep total for reference
        totalPOLBalance: polBalance, // Keep total for reference
        availableCESBalance: availableCESBalance, // Available for spending
        availablePOLBalance: availablePOLBalance, // Available for spending
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

  // Calculate estimated CES transfer fee in POL
  async calculateCESTransferFee(fromAddress, toAddress, amount) {
    try {
      const { decimals } = await rpcService.getTokenBalance(
        config.wallet.cesContractAddress,
        fromAddress
      );
      const transferAmount = utils.parseUnits(amount.toString(), decimals);
      
      // Prepare transaction data
      const erc20Interface = new ethers.utils.Interface([
        "function transfer(address to, uint256 amount) returns (bool)"
      ]);
      const txData = erc20Interface.encodeFunctionData('transfer', [toAddress, transferAmount]);
      
      // Get current gas prices
      const feeData = await rpcService.getFeeData();
      
      // Estimate gas for the transfer
      const gasEstimate = await rpcService.estimateGas({
        to: config.wallet.cesContractAddress,
        data: txData,
        from: fromAddress
      });
      
      // Calculate gas with buffer
      const gasEstimateBigInt = BigInt(gasEstimate.toString());
      const gasLimit = gasEstimateBigInt * 115n / 100n; // 15% buffer
      
      // Calculate gas prices with minimums
      const minGasPrice = utils.parseUnits('28', 'gwei');
      const maxGasPrice = utils.parseUnits('150', 'gwei');
      
      let maxFeePerGas, maxPriorityFeePerGas;
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        maxFeePerGas = feeData.maxFeePerGas.mul(140).div(100);
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(140).div(100);
        
        if (maxFeePerGas.lt(minGasPrice)) maxFeePerGas = minGasPrice;
        if (maxPriorityFeePerGas.lt(minGasPrice)) maxPriorityFeePerGas = minGasPrice;
        
        if (maxFeePerGas.gt(maxGasPrice)) maxFeePerGas = maxGasPrice;
        if (maxPriorityFeePerGas.gt(maxGasPrice)) maxPriorityFeePerGas = maxGasPrice;
      } else {
        maxFeePerGas = utils.parseUnits('45', 'gwei');
        maxPriorityFeePerGas = utils.parseUnits('28', 'gwei');
      }
      
      // Calculate total fee: gasLimit * maxFeePerGas
      const totalFeeWei = ethers.BigNumber.from(gasLimit.toString()).mul(maxFeePerGas);
      const totalFeePOL = parseFloat(utils.formatEther(totalFeeWei));
      
      return {
        estimatedFee: totalFeePOL,
        gasLimit: gasLimit.toString(),
        maxFeePerGas: utils.formatUnits(maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: utils.formatUnits(maxPriorityFeePerGas, 'gwei')
      };
      
    } catch (error) {
      console.error('Error calculating CES transfer fee:', error);
      // Return conservative estimate
      return {
        estimatedFee: 0.0015, // 0.0015 POL conservative estimate for token transfers
        gasLimit: '65000',
        maxFeePerGas: '45',
        maxPriorityFeePerGas: '28'
      };
    }
  }

  // Calculate estimated POL transfer fee
  async calculatePOLTransferFee(fromAddress, toAddress, amount) {
    try {
      const transferAmount = utils.parseEther(amount.toString());
      
      // Get current gas prices
      const feeData = await rpcService.getFeeData();
      
      // Estimate gas for the transfer
      const gasEstimate = await rpcService.estimateGas({
        to: toAddress,
        value: transferAmount,
        from: fromAddress
      });
      
      // Calculate gas with minimal buffer
      const gasEstimateBigInt = BigInt(gasEstimate.toString());
      const gasLimit = (gasEstimateBigInt * 110n) / 100n; // 10% buffer
      
      // Calculate gas prices with minimums
      const minGasPrice = utils.parseUnits('25', 'gwei'); // Slightly lower minimum for estimation
      const maxGasPrice = utils.parseUnits('200', 'gwei');
      
      let maxFeePerGas, maxPriorityFeePerGas;
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        maxFeePerGas = feeData.maxFeePerGas.mul(130).div(100); // 130% buffer for estimation
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(130).div(100);
        
        if (maxFeePerGas.lt(minGasPrice)) maxFeePerGas = minGasPrice;
        if (maxPriorityFeePerGas.lt(minGasPrice)) maxPriorityFeePerGas = minGasPrice;
        
        if (maxFeePerGas.gt(maxGasPrice)) maxFeePerGas = maxGasPrice;
        if (maxPriorityFeePerGas.gt(maxGasPrice)) maxPriorityFeePerGas = maxGasPrice;
      } else {
        maxFeePerGas = utils.parseUnits('40', 'gwei'); // Lower fallback
        maxPriorityFeePerGas = utils.parseUnits('25', 'gwei');
      }
      
      // Calculate total fee: gasLimit * maxFeePerGas
      const totalFeeWei = ethers.BigNumber.from(gasLimit.toString()).mul(maxFeePerGas);
      const totalFeePOL = parseFloat(utils.formatEther(totalFeeWei));
      
      return {
        estimatedFee: totalFeePOL,
        gasLimit: gasLimit.toString(),
        maxFeePerGas: utils.formatUnits(maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: utils.formatUnits(maxPriorityFeePerGas, 'gwei')
      };
      
    } catch (error) {
      console.error('Error calculating POL transfer fee:', error);
      // Return conservative estimate
      return {
        estimatedFee: 0.001, // 0.001 POL conservative estimate
        gasLimit: '21000',
        maxFeePerGas: '30',
        maxPriorityFeePerGas: '25'
      };
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
      if (availableBalance - amount < gasReserve) {
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
      
      // Get sender's private key
      const privateKey = await this.getUserPrivateKey(fromChatId);
      const wallet = new ethers.Wallet(privateKey);
      
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
        // Get current gas prices
        const feeData = await rpcService.getFeeData();
        
        // Estimate gas and set appropriate gas limit with minimal buffer
        const gasEstimate = await rpcService.estimateGas({
          to: toAddress,
          value: transferAmount,
          from: fromUser.walletAddress
        });
        
        // Fix BigInt operations by converting to BigInt first
        const gasEstimateBigInt = BigInt(gasEstimate.toString());
        const gasLimit = (gasEstimateBigInt * 110n) / 100n; // Add only 10% buffer for simple transfers
        
        // Set gas prices with proper values for Polygon network
        // Ensure minimum values to avoid "gas price below minimum" errors
        const minGasPrice = utils.parseUnits('30', 'gwei'); // 30 Gwei minimum
        const maxGasPrice = utils.parseUnits('200', 'gwei'); // 200 Gwei maximum
        
        let maxFeePerGas, maxPriorityFeePerGas;
        
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          // Use network suggested prices with 150% buffer and enforce minimums
          maxFeePerGas = feeData.maxFeePerGas.mul(150).div(100);
          maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(150).div(100);
          
          // Enforce minimum values
          if (maxFeePerGas.lt(minGasPrice)) maxFeePerGas = minGasPrice;
          if (maxPriorityFeePerGas.lt(minGasPrice)) maxPriorityFeePerGas = minGasPrice;
          
          // Enforce maximum values to prevent overpaying
          if (maxFeePerGas.gt(maxGasPrice)) maxFeePerGas = maxGasPrice;
          if (maxPriorityFeePerGas.gt(maxGasPrice)) maxPriorityFeePerGas = maxGasPrice;
        } else {
          // Fallback to safe defaults for Polygon
          maxFeePerGas = utils.parseUnits('40', 'gwei'); // Lower fallback for POL
          maxPriorityFeePerGas = utils.parseUnits('28', 'gwei'); // Optimized minimum
        }
        
        console.log(`🔥 POL Gas prices: maxFeePerGas=${utils.formatUnits(maxFeePerGas, 'gwei')} Gwei, maxPriorityFeePerGas=${utils.formatUnits(maxPriorityFeePerGas, 'gwei')} Gwei`);
        
        const tx = await rpcService.sendTransaction(wallet, {
          to: toAddress,
          value: transferAmount,
          gasLimit: gasLimit,
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas,
          type: 2 // EIP-1559 transaction
        });
        
        console.log(`⏳ POL Transaction sent to blockchain: ${tx.hash}`);
        
        // Update transaction with hash
        transaction.txHash = tx.hash;
        await transaction.save();
        
        console.log(`✅ POL transfer sent to blockchain: ${tx.hash}`);
        
        // Don't wait for confirmation here - return immediately and check async
        this.checkTransactionAsync(transaction._id, tx.hash);
        
        return {
          success: true,
          txHash: tx.hash,
          amount: amount,
          toAddress: toAddress,
          transaction: transaction,
          status: 'pending'
        };
        
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
      if (!utils.isAddress(toAddress)) {
        throw new Error('Неверный адрес получателя');
      }
      
      // Prevent self-transfer
      if (fromUser.walletAddress.toLowerCase() === toAddress.toLowerCase()) {
        throw new Error('Нельзя переводить самому себе');
      }
      
      // Get recipient user (if exists in our system)
      const toUser = await User.findOne({ walletAddress: toAddress });
      
      // Get sender's private key
      const privateKey = await this.getUserPrivateKey(fromChatId);
      const wallet = new ethers.Wallet(privateKey);
      
      // Get token info using RPC service
      const { decimals } = await rpcService.getTokenBalance(
        config.wallet.cesContractAddress,
        fromUser.walletAddress
      );
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
        // Get current gas prices
        const feeData = await rpcService.getFeeData();
        
        // Prepare transaction data
        const erc20Interface = new ethers.utils.Interface([
          "function transfer(address to, uint256 amount) returns (bool)"
        ]);
        const txData = erc20Interface.encodeFunctionData('transfer', [toAddress, transferAmount]);
        
        // Estimate gas
        const gasEstimate = await rpcService.estimateGas({
          to: config.wallet.cesContractAddress,
          data: txData,
          from: fromUser.walletAddress
        });
        
        // Fix BigInt operations by converting to BigInt first
        const gasEstimateBigInt = BigInt(gasEstimate.toString());
        const gasLimit = gasEstimateBigInt * 115n / 100n; // Add 15% buffer for token transfers
        
        // Set gas prices with proper values for Polygon network
        // Ensure minimum values to avoid "gas price below minimum" errors
        const minGasPrice = utils.parseUnits('30', 'gwei'); // 30 Gwei minimum
        const maxGasPrice = utils.parseUnits('200', 'gwei'); // 200 Gwei maximum
        
        let maxFeePerGas, maxPriorityFeePerGas;
        
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          // Use network suggested prices with 150% buffer and enforce minimums
          maxFeePerGas = feeData.maxFeePerGas.mul(150).div(100);
          maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.mul(150).div(100);
          
          // Enforce minimum values
          if (maxFeePerGas.lt(minGasPrice)) maxFeePerGas = minGasPrice;
          if (maxPriorityFeePerGas.lt(minGasPrice)) maxPriorityFeePerGas = minGasPrice;
          
          // Enforce maximum values to prevent overpaying
          if (maxFeePerGas.gt(maxGasPrice)) maxFeePerGas = maxGasPrice;
          if (maxPriorityFeePerGas.gt(maxGasPrice)) maxPriorityFeePerGas = maxGasPrice;
        } else {
          // Fallback to safe defaults for Polygon
          maxFeePerGas = utils.parseUnits('45', 'gwei'); // Lower fallback
          maxPriorityFeePerGas = utils.parseUnits('28', 'gwei'); // Optimized minimum
        }
        
        console.log(`🔥 CES Gas prices: maxFeePerGas=${utils.formatUnits(maxFeePerGas, 'gwei')} Gwei, maxPriorityFeePerGas=${utils.formatUnits(maxPriorityFeePerGas, 'gwei')} Gwei`);
        
        const tx = await rpcService.sendTransaction(wallet, {
          to: config.wallet.cesContractAddress,
          data: txData,
          gasLimit: gasLimit,
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas,
          type: 2 // EIP-1559 transaction
        });
        
        console.log(`⏳ Transaction sent to blockchain: ${tx.hash}`);
        
        // Update transaction with hash
        transaction.txHash = tx.hash;
        await transaction.save();
        
        console.log(`✅ CES transfer sent to blockchain: ${tx.hash}`);
        
        // Don't wait for confirmation here - return immediately and check async
        this.checkTransactionAsync(transaction._id, tx.hash);
        
        return {
          success: true,
          txHash: tx.hash,
          amount: amount,
          toAddress: toAddress,
          transaction: transaction,
          status: 'pending'
        };
        
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