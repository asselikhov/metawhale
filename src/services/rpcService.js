/**
 * RPC Service
 * Manages reliable blockchain connections with automatic fallback
 */

const { ethers } = require('ethers');
const config = require('../config/configuration');

// Ensure ethers providers are available
const providers = ethers.providers || ethers;

class RpcService {
  constructor() {
    this.rpcUrls = [
      config.wallet.polygonRpcUrl,
      ...config.wallet.alternativeRpcUrls
    ].filter((url, index, arr) => arr.indexOf(url) === index); // Remove duplicates
    
    this.currentRpcIndex = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Get current provider with fallback logic
  async getProvider() {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.rpcUrls.length; attempt++) {
      const rpcUrl = this.rpcUrls[this.currentRpcIndex];
      
      try {
        const provider = new providers.JsonRpcProvider(rpcUrl);
        
        // Test the connection with a simple call
        await Promise.race([
          provider.getNetwork(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 5000)
          )
        ]);
        
        console.log(`✅ Connected to RPC: ${rpcUrl}`);
        return provider;
        
      } catch (error) {
        console.log(`❌ RPC connection failed for ${rpcUrl}: ${error.message}`);
        lastError = error;
        
        // Move to next RPC endpoint
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
      }
    }
    
    throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
  }

  // Execute blockchain call with retry logic
  async executeWithRetry(operation) {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const provider = await this.getProvider();
        return await operation(provider);
        
      } catch (error) {
        lastError = error;
        
        // Check if it's a rate limit or network error
        if (this.isRetryableError(error)) {
          console.log(`⚠️ Attempt ${attempt + 1}/${this.maxRetries} failed: ${error.message}`);
          
          // Switch to next RPC if rate limited
          if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
            this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
          continue;
        }
        
        // Non-retryable error, throw immediately
        throw error;
      }
    }
    
    throw new Error(`Operation failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  // Check if error is retryable
  isRetryableError(error) {
    const retryablePatterns = [
      'rate limit',
      'too many requests',
      'network error',
      'connection timeout',
      'could not detect network',
      'processing response error',
      'timeout'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  // Get balance with retry logic
  async getBalance(address) {
    return this.executeWithRetry(async (provider) => {
      return await provider.getBalance(address);
    });
  }

  // Get ERC-20 token balance with retry logic
  async getTokenBalance(tokenAddress, walletAddress) {
    return this.executeWithRetry(async (provider) => {
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];
      
      const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
      
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals()
      ]);
      
      return { balance, decimals };
    });
  }

  // Get network gas prices with retry logic
  async getFeeData() {
    return this.executeWithRetry(async (provider) => {
      return await provider.getFeeData();
    });
  }

  // Estimate gas with retry logic
  async estimateGas(transaction) {
    return this.executeWithRetry(async (provider) => {
      return await provider.estimateGas(transaction);
    });
  }

  // Send transaction with retry logic
  async sendTransaction(wallet, transaction) {
    return this.executeWithRetry(async (provider) => {
      // Make sure wallet is connected to this provider
      const connectedWallet = wallet.connect(provider);
      return await connectedWallet.sendTransaction(transaction);
    });
  }

  // Wait for transaction receipt with retry logic
  async waitForTransaction(txHash, confirmations = 1, timeoutMs = 30000) {
    return this.executeWithRetry(async (provider) => {
      return await provider.waitForTransaction(txHash, confirmations, timeoutMs);
    });
  }

  // Check transaction status without waiting (non-blocking)
  async getTransactionReceipt(txHash) {
    return this.executeWithRetry(async (provider) => {
      return await provider.getTransactionReceipt(txHash);
    });
  }

  // Get transaction details
  async getTransaction(txHash) {
    return this.executeWithRetry(async (provider) => {
      return await provider.getTransaction(txHash);
    });
  }

  // Wait for transaction with shorter timeout and status checking
  async waitForTransactionAsync(txHash, confirmations = 1, maxWaitTime = 30000) {
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const receipt = await this.getTransactionReceipt(txHash);
        if (receipt && receipt.confirmations >= confirmations) {
          return receipt;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.log(`⚠️ Error checking transaction ${txHash}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }
    
    // If we reach here, transaction is still pending
    throw new Error('Transaction confirmation timeout - transaction may still be pending');
  }

  // Get current network info
  async getNetworkInfo() {
    return this.executeWithRetry(async (provider) => {
      const [network, blockNumber, gasPrice] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
        provider.getGasPrice().catch(() => null)
      ]);
      
      return {
        chainId: network.chainId,
        name: network.name,
        blockNumber,
        gasPrice: gasPrice ? ethers.utils.formatUnits(gasPrice, 'gwei') : 'N/A'
      };
    });
  }
}

module.exports = new RpcService();