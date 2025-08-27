/**
 * Background Processing Service
 * Handles heavy operations asynchronously to provide instant button responses
 */

const EventEmitter = require('events');

class BackgroundProcessingService extends EventEmitter {
  constructor() {
    super();
    this.taskQueue = [];
    this.isProcessing = false;
    this.activeJobs = new Map();
  }

  /**
   * Queue a task for background processing
   * @param {string} taskId - Unique task identifier
   * @param {Function} task - Async function to execute
   * @param {Object} options - Task options
   * @returns {Promise} Promise that resolves when task completes
   */
  async queueTask(taskId, task, options = {}) {
    return new Promise((resolve, reject) => {
      const taskItem = {
        id: taskId,
        task: task,
        resolve: resolve,
        reject: reject,
        priority: options.priority || 0,
        timeout: options.timeout || 30000,
        createdAt: Date.now()
      };

      // Add to queue with priority ordering
      this.taskQueue.push(taskItem);
      this.taskQueue.sort((a, b) => b.priority - a.priority);

      console.log(`📋 [BACKGROUND] Queued task: ${taskId} (priority: ${taskItem.priority})`);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the task queue
   */
  async processQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 [BACKGROUND] Starting queue processing`);

    while (this.taskQueue.length > 0) {
      const taskItem = this.taskQueue.shift();
      
      try {
        console.log(`⚡ [BACKGROUND] Processing task: ${taskItem.id}`);
        this.activeJobs.set(taskItem.id, taskItem);

        // Set timeout for task execution
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Task ${taskItem.id} timed out`)), taskItem.timeout);
        });

        // Race between task execution and timeout
        const result = await Promise.race([
          taskItem.task(),
          timeoutPromise
        ]);

        this.activeJobs.delete(taskItem.id);
        taskItem.resolve(result);
        
        console.log(`✅ [BACKGROUND] Completed task: ${taskItem.id}`);
        this.emit('taskCompleted', { id: taskItem.id, result });

      } catch (error) {
        this.activeJobs.delete(taskItem.id);
        console.error(`❌ [BACKGROUND] Task failed: ${taskItem.id}`, error.message);
        taskItem.reject(error);
        this.emit('taskFailed', { id: taskItem.id, error });
      }

      // Small delay to prevent CPU overload
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
    console.log(`✅ [BACKGROUND] Queue processing completed`);
  }

  /**
   * Execute wallet operations in background
   */
  async processWalletData(chatId) {
    const taskId = `wallet_${chatId}_${Date.now()}`;
    
    return this.queueTask(taskId, async () => {
      const multiChainWalletService = require('./multiChainWalletService');
      
      console.log(`💼 [BACKGROUND] Loading wallet data for ${chatId}`);
      
      // Get multi-chain wallet info
      const walletInfo = await multiChainWalletService.getMultiChainWalletInfo(chatId);

      if (!walletInfo || !walletInfo.hasWallet) {
        return { hasWallet: false };
      }

      // Return the formatted multi-chain wallet data
      return {
        hasWallet: true,
        currentNetwork: walletInfo.currentNetwork,
        networkInfo: walletInfo.networkInfo,
        balances: walletInfo.balances,
        totalValue: walletInfo.totalValue,
        address: walletInfo.address
      };
    }, { priority: 1 });
  }

  /**
   * Execute P2P data operations in background
   */
  async processP2PData(chatId) {
    const taskId = `p2p_${chatId}_${Date.now()}`;
    
    return this.queueTask(taskId, async () => {
      const reputationService = require('./reputationService');
      const { User } = require('../database/models');
      
      console.log(`🔄 [BACKGROUND] Loading P2P data for ${chatId}`);
      
      // Get user and reputation data
      const [user, stats] = await Promise.all([
        User.findOne({ chatId }),
        reputationService.getUserStats(chatId)
      ]);

      const userName = user ? (user.firstName || user.username || 'Пользователь') : 'Пользователь';

      return {
        userName,
        stats: stats || {
          ordersLast30Days: 0,
          completionRateLast30Days: 0,
          avgTransferTime: 0,
          avgPaymentTime: 0,
          rating: 0
        }
      };
    }, { priority: 1 });
  }

  /**
   * Get active job count
   */
  getActiveJobCount() {
    return this.activeJobs.size;
  }

  /**
   * Get queue size
   */
  getQueueSize() {
    return this.taskQueue.length;
  }

  /**
   * Clear all tasks (emergency stop)
   */
  clearAll() {
    console.log(`🧹 [BACKGROUND] Clearing all tasks`);
    
    // Reject all queued tasks
    this.taskQueue.forEach(task => {
      task.reject(new Error('Service stopped'));
    });
    this.taskQueue = [];

    // Clear active jobs
    this.activeJobs.forEach((task, id) => {
      task.reject(new Error('Service stopped'));
    });
    this.activeJobs.clear();

    this.isProcessing = false;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.getQueueSize(),
      activeJobs: this.getActiveJobCount(),
      totalMemoryUsage: process.memoryUsage()
    };
  }
}

module.exports = new BackgroundProcessingService();