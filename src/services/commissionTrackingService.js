/**
 * Commission Tracking Service
 * Tracks and calculates total commission fees received from successful maker trades
 */

const { ethers } = require('ethers');
const { P2PTrade } = require('../database/models');
const walletService = require('../services/wallet/walletService');
const config = require('../config/configuration');

const ADMIN_WALLET_ADDRESS = '0xC2D5FABd53F537A1225460AE30097198aB14FF32';

class CommissionTrackingService {
  constructor() {
    this.adminWallet = ADMIN_WALLET_ADDRESS;
  }

  /**
   * Calculate total commission from completed trades in database
   * @returns {Object} Commission statistics
   */
  async getTotalCommissionFromTrades() {
    try {
      console.log('📊 Calculating total commission from completed trades...');

      // Find all completed trades with commission
      const completedTrades = await P2PTrade.find({
        status: 'completed',
        $or: [
          { buyerCommission: { $gt: 0 } },
          { sellerCommission: { $gt: 0 } }
        ]
      }).populate('buyerId sellerId', 'chatId username');

      let totalCommissionInCES = 0;
      let totalCommissionInRubles = 0;
      let tradeCount = 0;
      const tradeDetails = [];

      for (const trade of completedTrades) {
        // Calculate commission in CES (maker commission only)
        let commissionInCES = 0;
        let makerType = '';

        if (trade.buyerCommission > 0) {
          // Buyer is maker
          commissionInCES = trade.buyerCommission / trade.pricePerToken;
          makerType = 'buyer';
        } else if (trade.sellerCommission > 0) {
          // Seller is maker
          commissionInCES = trade.sellerCommission / trade.pricePerToken;
          makerType = 'seller';
        }

        if (commissionInCES > 0) {
          totalCommissionInCES += commissionInCES;
          totalCommissionInRubles += (commissionInCES * trade.pricePerToken);
          tradeCount++;

          tradeDetails.push({
            tradeId: trade._id.toString().substr(0, 8),
            amount: trade.amount,
            price: trade.pricePerToken,
            commission: commissionInCES,
            makerType: makerType,
            completedAt: trade.timeTracking?.completedAt || trade.updatedAt
          });
        }
      }

      return {
        totalCommissionInCES,
        totalCommissionInRubles,
        tradeCount,
        tradeDetails,
        calculated: true
      };

    } catch (error) {
      console.error('Error calculating commission from trades:', error);
      throw error;
    }
  }

  /**
   * Get current CES balance of admin wallet from blockchain
   * @returns {Number} Current CES balance
   */
  async getAdminWalletBalance() {
    try {
      console.log('🔍 Checking admin wallet CES balance...');

      const provider = new ethers.providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      const cesTokenAddress = config.wallet.cesContractAddress;
      
      const erc20Abi = [
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];
      
      const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);
      
      const [balanceWei, decimals] = await Promise.all([
        cesContract.balanceOf(this.adminWallet),
        cesContract.decimals()
      ]);
      
      const balance = ethers.utils.formatUnits(balanceWei, decimals);
      
      console.log(`💰 Admin wallet balance: ${balance} CES`);
      
      return parseFloat(balance);

    } catch (error) {
      console.error('Error getting admin wallet balance:', error);
      throw error;
    }
  }

  /**
   * Get commission transfer history from blockchain
   * @param {Number} blocksToCheck Number of blocks to check (default: 500)
   * @returns {Array} Array of commission transfer events
   */
  async getCommissionTransferHistory(blocksToCheck = 500) {
    try {
      console.log(`📋 Checking commission transfer history (last ${blocksToCheck} blocks)...`);

      const provider = new ethers.providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
      const cesTokenAddress = config.wallet.cesContractAddress;
      
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - blocksToCheck);
      
      // Create filter for Transfer events to admin wallet
      const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
      const toAddressTopic = ethers.utils.hexZeroPad(this.adminWallet, 32);
      
      const filter = {
        address: cesTokenAddress,
        topics: [transferTopic, null, toAddressTopic], // Transfer(from, to=admin, amount)
        fromBlock: fromBlock,
        toBlock: 'latest'
      };
      
      let logs = [];
      
      try {
        logs = await provider.getLogs(filter);
      } catch (logError) {
        if (logError.message.includes('too large') || logError.message.includes('Block range')) {
          // Try with smaller range
          console.log('⚠️ Block range too large, trying with smaller range...');
          const smallerRange = Math.min(100, blocksToCheck);
          const smallerFromBlock = Math.max(0, latestBlock - smallerRange);
          
          const smallerFilter = {
            ...filter,
            fromBlock: smallerFromBlock
          };
          
          try {
            logs = await provider.getLogs(smallerFilter);
            console.log(`✅ Successfully retrieved logs with smaller range (${smallerRange} blocks)`);
          } catch (smallerError) {
            console.log('❌ Even smaller range failed, returning empty results');
            logs = [];
          }
        } else {
          throw logError;
        }
      }
      
      const transfers = [];
      let totalTransferred = 0;
      
      for (const log of logs) {
        try {
          const amount = ethers.utils.formatEther(log.data);
          const fromAddress = ethers.utils.getAddress('0x' + log.topics[1].slice(26));
          
          const block = await provider.getBlock(log.blockNumber);
          const timestamp = new Date(block.timestamp * 1000);
          
          transfers.push({
            amount: parseFloat(amount),
            fromAddress,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            timestamp
          });
          
          totalTransferred += parseFloat(amount);
        } catch (parseError) {
          console.log(`⚠️ Error parsing transfer log: ${parseError.message}`);
          continue;
        }
      }
      
      console.log(`📊 Found ${transfers.length} commission transfers totaling ${totalTransferred.toFixed(4)} CES`);
      
      return {
        transfers,
        totalTransferred,
        blocksChecked: blocksToCheck,
        actualBlocksChecked: latestBlock - fromBlock,
        fromBlock,
        toBlock: latestBlock
      };

    } catch (error) {
      console.error('Error getting commission transfer history:', error);
      
      // Return empty result on error
      return {
        transfers: [],
        totalTransferred: 0,
        blocksChecked: blocksToCheck,
        actualBlocksChecked: 0,
        fromBlock: 0,
        toBlock: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate comprehensive fee report
   * @returns {Object} Complete fee report
   */
  async generateFeeReport() {
    try {
      console.log('📊 Generating comprehensive fee report...');

      // Get data with error handling for each component
      let tradeCommissions, walletBalance, transferHistory;
      
      try {
        tradeCommissions = await this.getTotalCommissionFromTrades();
      } catch (error) {
        console.log('⚠️ Error getting trade commissions, using defaults:', error.message);
        tradeCommissions = {
          totalCommissionInCES: 0,
          totalCommissionInRubles: 0,
          tradeCount: 0,
          error: error.message
        };
      }
      
      try {
        walletBalance = await this.getAdminWalletBalance();
      } catch (error) {
        console.log('⚠️ Error getting wallet balance, using 0:', error.message);
        walletBalance = 0;
      }
      
      try {
        transferHistory = await this.getCommissionTransferHistory(500); // Smaller range by default
      } catch (error) {
        console.log('⚠️ Error getting transfer history, using empty:', error.message);
        transferHistory = {
          transfers: [],
          totalTransferred: 0,
          blocksChecked: 0,
          error: error.message
        };
      }

      // Get current CES price for ruble conversion
      let cesPrice;
      try {
        const priceService = require('./priceService');
        cesPrice = await priceService.getCESPrice();
      } catch (error) {
        console.log('⚠️ Error getting CES price, using default:', error.message);
        cesPrice = { priceRub: 250 }; // Default fallback price
      }

      const report = {
        // Database calculations
        database: {
          totalCommissionCES: tradeCommissions.totalCommissionInCES,
          totalCommissionRubles: tradeCommissions.totalCommissionInRubles,
          completedTrades: tradeCommissions.tradeCount,
          calculatedFromTrades: !tradeCommissions.error,
          error: tradeCommissions.error
        },
        
        // Blockchain data
        blockchain: {
          currentBalance: walletBalance,
          currentBalanceRubles: walletBalance * cesPrice.priceRub,
          totalReceived: transferHistory.totalTransferred,
          totalReceivedRubles: transferHistory.totalTransferred * cesPrice.priceRub,
          transferCount: transferHistory.transfers.length,
          blocksChecked: transferHistory.actualBlocksChecked || transferHistory.blocksChecked,
          hasError: !!transferHistory.error,
          error: transferHistory.error
        },
        
        // Analysis
        analysis: {
          commissionRate: '1%',
          onlyFromMakers: true,
          adminWallet: this.adminWallet,
          cesPrice: cesPrice.priceRub,
          lastUpdated: new Date(),
          hasErrors: !!(tradeCommissions.error || transferHistory.error)
        },
        
        // Recent transfers (last 5)
        recentTransfers: transferHistory.transfers
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 5)
      };

      return report;

    } catch (error) {
      console.error('Error generating fee report:', error);
      
      // Return minimal report on complete failure
      return {
        database: {
          totalCommissionCES: 0,
          totalCommissionRubles: 0,
          completedTrades: 0,
          calculatedFromTrades: false,
          error: 'Database unavailable'
        },
        blockchain: {
          currentBalance: 0,
          currentBalanceRubles: 0,
          totalReceived: 0,
          totalReceivedRubles: 0,
          transferCount: 0,
          blocksChecked: 0,
          hasError: true,
          error: 'Blockchain unavailable'
        },
        analysis: {
          commissionRate: '1%',
          onlyFromMakers: true,
          adminWallet: this.adminWallet,
          cesPrice: 250,
          lastUpdated: new Date(),
          hasErrors: true,
          criticalError: error.message
        },
        recentTransfers: []
      };
    }
  }

  /**
   * Format fee report for display
   * @param {Object} report Fee report from generateFeeReport
   * @returns {String} Formatted message
   */
  formatFeeReport(report) {
    try {
      let message = `💰 ОТЧЕТ ПО КОМИССИЯМ\n`;
      message += `➖➖➖➖➖➖➖➖➖➖➖\n\n`;
      
      // Current status
      message += `📊 ТЕКУЩЕЕ СОСТОЯНИЕ:\n`;
      message += `💳 Баланс кошелька: ${report.blockchain.currentBalance.toFixed(4)} CES\n`;
      message += `💵 В рублях: ₽${report.blockchain.currentBalanceRubles.toFixed(2)}\n\n`;
      
      // Statistics from blockchain
      if (report.blockchain.hasError) {
        message += `🔗 ДАННЫЕ ИЗ БЛОКЧЕЙНА:\n`;
        message += `⚠️ Ошибка получения данных из блокчейна\n`;
        message += `💳 Баланс кошелька: ${report.blockchain.currentBalance.toFixed(4)} CES\n`;
        message += `💵 В рублях: ₽${report.blockchain.currentBalanceRubles.toFixed(2)}\n\n`;
      } else {
        message += `🔗 ДАННЫЕ ИЗ БЛОКЧЕЙНА:\n`;
        message += `📈 Всего получено: ${report.blockchain.totalReceived.toFixed(4)} CES\n`;
        message += `💰 В рублях: ₽${report.blockchain.totalReceivedRubles.toFixed(2)}\n`;
        message += `📋 Количество переводов: ${report.blockchain.transferCount}\n`;
        message += `💳 Баланс кошелька: ${report.blockchain.currentBalance.toFixed(4)} CES\n\n`;
      }
      
      // Statistics from database  
      if (report.database.error) {
        message += `💾 ДАННЫЕ ИЗ БД:\n`;
        message += `⚠️ Ошибка получения данных из БД\n\n`;
      } else {
        message += `💾 ДАННЫЕ ИЗ БД:\n`;
        message += `📊 Комиссий из сделок: ${report.database.totalCommissionCES.toFixed(4)} CES\n`;
        message += `💵 В рублях: ₽${report.database.totalCommissionRubles.toFixed(2)}\n`;
        message += `🤝 Завершенных сделок: ${report.database.completedTrades}\n\n`;
      }
      
      // Commission info
      message += `⚙️ НАСТРОЙКИ КОМИССИЙ:\n`;
      message += `📊 Ставка: ${report.analysis.commissionRate} только с мейкеров\n`;
      message += `💳 Кошелек: ${report.analysis.adminWallet}\n`;
      message += `💱 Курс CES: ₽${report.analysis.cesPrice.toFixed(2)}\n\n`;
      
      // Recent transfers
      if (report.recentTransfers.length > 0) {
        message += `📋 ПОСЛЕДНИЕ ПЕРЕВОДЫ:\n`;
        report.recentTransfers.forEach((transfer, index) => {
          const timeAgo = this.getTimeAgo(transfer.timestamp);
          message += `${index + 1}. ${transfer.amount.toFixed(4)} CES (${timeAgo})\n`;
        });
        message += `\n`;
      }
      
      // Error warning if any
      if (report.analysis.hasErrors) {
        message += `⚠️ ПРИМЕЧАНИЕ:\n`;
        message += `Некоторые данные могут быть недоступны из-за ошибок\n\n`;
      }
      
      message += `🕐 Обновлено: ${report.analysis.lastUpdated.toLocaleString('ru-RU')}`;
      
      return message;

    } catch (error) {
      console.error('Error formatting fee report:', error);
      return '❌ Ошибка формирования отчета';
    }
  }

  /**
   * Get human-readable time ago string
   * @param {Date} date Date to compare
   * @returns {String} Time ago string
   */
  getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}д назад`;
    } else if (hours > 0) {
      return `${hours}ч назад`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}м назад`;
    }
  }
}

module.exports = new CommissionTrackingService();