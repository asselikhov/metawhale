/**
 * Balance Validation and Synchronization Service
 * Ensures consistency between database balances and blockchain reality
 */

const { User, EscrowTransaction } = require('../database/models');
const walletService = require('./walletService');
const smartContractService = require('./smartContractService');

class BalanceValidationService {
  constructor() {
    this.validationEnabled = true;
    this.autoFixEnabled = true;
  }

  /**
   * Validate and fix user balance discrepancies
   */
  async validateAndFixUserBalance(userId, options = {}) {
    try {
      const { 
        autoFix = this.autoFixEnabled,
        logDetails = true,
        checkEscrow = true 
      } = options;

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (logDetails) {
        console.log(`🔍 [BALANCE-VALIDATION] Checking user ${user.chatId} (${user.walletAddress})`);
      }

      // Check for balance protection flags - bypass validation if admin allocation is active
      if (user.balanceProtectionEnabled || user.adminAllocationAmount > 0 || user.adminProtected || user.skipBalanceSync || user.manualBalance) {
        if (logDetails) {
          console.log(`🔒 [BALANCE-VALIDATION] Balance protection enabled for user ${user.chatId}`);
          console.log(`    Admin allocation: ${user.adminAllocationAmount || 0} CES`);
          console.log(`    Protection flags: { balanceProtectionEnabled: ${user.balanceProtectionEnabled}, adminProtected: ${user.adminProtected}, skipBalanceSync: ${user.skipBalanceSync}, manualBalance: ${user.manualBalance} }`);
          console.log(`    Reason: ${user.adminAllocationReason || 'N/A'}`);
          console.log(`    Skipping automatic balance sync`);
        }
        
        return {
          userId: userId,
          chatId: user.chatId,
          walletAddress: user.walletAddress,
          issues: [],
          fixes: [],
          balances: {
            before: {
              cesDB: user.cesBalance || 0,
              cesEscrowDB: user.escrowCESBalance || 0,
              polDB: user.polBalance || 0,
              polEscrowDB: user.escrowPOLBalance || 0
            },
            blockchain: { protected: true },
            after: {}
          },
          protected: true,
          protectionReason: user.adminAllocationReason || 'Balance protection enabled'
        };
      }

      const results = {
        userId: userId,
        chatId: user.chatId,
        walletAddress: user.walletAddress,
        issues: [],
        fixes: [],
        balances: {
          before: {
            cesDB: user.cesBalance || 0,
            cesEscrowDB: user.escrowCESBalance || 0,
            polDB: user.polBalance || 0,
            polEscrowDB: user.escrowPOLBalance || 0
          },
          blockchain: {},
          after: {}
        }
      };

      // Get real blockchain balances
      if (user.walletAddress) {
        const [realCES, realPOL] = await Promise.all([
          walletService.getCESBalance(user.walletAddress),
          walletService.getPOLBalance(user.walletAddress)
        ]);

        results.balances.blockchain = {
          ces: realCES,
          pol: realPOL
        };

        // Check CES balance discrepancy
        // Fix: The expected blockchain balance should be just the available balance (cesDB)
        // because escrowed tokens are held elsewhere and not part of the blockchain balance
        const expectedCES = results.balances.before.cesDB;
        const cesDifference = Math.abs(results.balances.blockchain.ces - expectedCES);
        
        if (cesDifference > 0.0001) { // Allow small floating point differences
          results.issues.push({
            type: 'CES_BALANCE_MISMATCH',
            description: `CES balance mismatch: DB=${expectedCES}, Blockchain=${results.balances.blockchain.ces}, Difference=${cesDifference}`,
            severity: cesDifference > 0.1 ? 'HIGH' : 'MEDIUM'
          });

          if (autoFix) {
            // Fix: Sync database with blockchain reality
            // The available balance should match the blockchain balance
            const newCESBalance = results.balances.blockchain.ces;
            user.cesBalance = newCESBalance;
            
            results.fixes.push({
              type: 'CES_BALANCE_SYNC',
              description: `Updated CES balance from ${results.balances.before.cesDB} to ${newCESBalance}`,
              oldValue: results.balances.before.cesDB,
              newValue: newCESBalance
            });
          }
        }

        // Check POL balance discrepancy
        // Fix: The expected blockchain balance should be just the available balance (polDB)
        // because escrowed tokens are held elsewhere and not part of the blockchain balance
        const expectedPOL = results.balances.before.polDB;
        const polDifference = Math.abs(results.balances.blockchain.pol - expectedPOL);
        
        if (polDifference > 0.0001) { // Allow small floating point differences
          results.issues.push({
            type: 'POL_BALANCE_MISMATCH',
            description: `POL balance mismatch: DB=${expectedPOL}, Blockchain=${results.balances.blockchain.pol}, Difference=${polDifference}`,
            severity: polDifference > 0.1 ? 'HIGH' : 'MEDIUM'
          });

          if (autoFix) {
            // Fix: Sync database with blockchain reality
            // The available balance should match the blockchain balance
            const newPOLBalance = results.balances.blockchain.pol;
            user.polBalance = newPOLBalance;
            
            results.fixes.push({
              type: 'POL_BALANCE_SYNC',
              description: `Updated POL balance from ${results.balances.before.polDB} to ${newPOLBalance}`,
              oldValue: results.balances.before.polDB,
              newValue: newPOLBalance
            });
          }
        }

        // Check for negative escrow balances
        if (results.balances.before.cesEscrowDB < 0) {
          results.issues.push({
            type: 'NEGATIVE_ESCROW_BALANCE',
            description: `Negative CES escrow balance: ${results.balances.before.cesEscrowDB}`,
            severity: 'HIGH'
          });

          if (autoFix) {
            // Fix: Reset negative escrow to 0 and adjust main balance
            const negativeAmount = Math.abs(results.balances.before.cesEscrowDB);
            user.escrowCESBalance = 0;
            user.cesBalance = Math.max(0, (user.cesBalance || 0) + negativeAmount);

            results.fixes.push({
              type: 'NEGATIVE_ESCROW_FIX',
              description: `Reset negative escrow and adjusted main balance`,
              negativeAmount: negativeAmount
            });
          }
        }

        if (results.balances.before.polEscrowDB < 0) {
          results.issues.push({
            type: 'NEGATIVE_POL_ESCROW_BALANCE',
            description: `Negative POL escrow balance: ${results.balances.before.polEscrowDB}`,
            severity: 'HIGH'
          });

          if (autoFix) {
            user.escrowPOLBalance = 0;
            user.polBalance = Math.max(0, (user.polBalance || 0) + Math.abs(results.balances.before.polEscrowDB));

            results.fixes.push({
              type: 'NEGATIVE_POL_ESCROW_FIX',
              description: `Reset negative POL escrow balance`
            });
          }
        }
      }

      // Check for orphaned escrow transactions
      if (checkEscrow) {
        const orphanedEscrows = await this.findOrphanedEscrows(userId);
        if (orphanedEscrows.length > 0) {
          results.issues.push({
            type: 'ORPHANED_ESCROWS',
            description: `Found ${orphanedEscrows.length} orphaned escrow transactions`,
            severity: 'MEDIUM',
            count: orphanedEscrows.length
          });
        }
      }

      // Save fixes if any were made
      if (autoFix && results.fixes.length > 0) {
        await user.save();
        
        results.balances.after = {
          cesDB: user.cesBalance || 0,
          cesEscrowDB: user.escrowCESBalance || 0,
          polDB: user.polBalance || 0,
          polEscrowDB: user.escrowPOLBalance || 0
        };

        if (logDetails) {
          console.log(`✅ [BALANCE-VALIDATION] Fixed ${results.fixes.length} issues for user ${user.chatId}`);
        }
      }

      return results;

    } catch (error) {
      console.error('[BALANCE-VALIDATION] Error:', error);
      throw error;
    }
  }

  /**
   * Find orphaned escrow transactions (locks without corresponding trades)
   */
  async findOrphanedEscrows(userId) {
    const orphanedEscrows = [];

    try {
      // Find lock transactions without valid trades
      const lockTxs = await EscrowTransaction.find({
        userId: userId,
        type: 'lock',
        status: 'completed'
      }).sort({ createdAt: -1 });

      for (const lockTx of lockTxs) {
        // Check if there's a corresponding refund or release
        const releaseOrRefund = await EscrowTransaction.findOne({
          userId: userId,
          tradeId: lockTx.tradeId,
          type: { $in: ['release', 'refund'] },
          status: 'completed'
        });

        if (!releaseOrRefund) {
          orphanedEscrows.push(lockTx);
        }
      }

    } catch (error) {
      console.error('Error finding orphaned escrows:', error);
    }

    return orphanedEscrows;
  }

  /**
   * Comprehensive system-wide balance validation
   */
  async validateAllUserBalances(options = {}) {
    try {
      const { 
        limit = 100, 
        autoFix = false,
        onlyWithIssues = true 
      } = options;

      console.log('🔍 [SYSTEM-VALIDATION] Starting system-wide balance validation...');

      const users = await User.find({ 
        walletAddress: { $exists: true, $ne: null } 
      }).limit(limit);

      const results = {
        totalUsers: users.length,
        usersWithIssues: 0,
        totalIssues: 0,
        totalFixes: 0,
        userResults: []
      };

      for (const user of users) {
        try {
          const userResult = await this.validateAndFixUserBalance(user._id, {
            autoFix: autoFix,
            logDetails: false
          });

          if (!onlyWithIssues || userResult.issues.length > 0) {
            results.userResults.push(userResult);
          }

          if (userResult.issues.length > 0) {
            results.usersWithIssues++;
            results.totalIssues += userResult.issues.length;
          }

          results.totalFixes += userResult.fixes.length;

        } catch (error) {
          console.error(`Error validating user ${user.chatId}:`, error.message);
        }
      }

      console.log(`✅ [SYSTEM-VALIDATION] Completed: ${results.usersWithIssues}/${results.totalUsers} users with issues`);
      return results;

    } catch (error) {
      console.error('[SYSTEM-VALIDATION] Error:', error);
      throw error;
    }
  }

  /**
   * Real-time balance validation (to be called after escrow operations)
   */
  async validateAfterEscrowOperation(userId, operation, amount, tokenType) {
    try {
      console.log(`🔍 [POST-ESCROW-VALIDATION] After ${operation} of ${amount} ${tokenType}`);

      const validationResult = await this.validateAndFixUserBalance(userId, {
        autoFix: true,
        logDetails: true
      });

      if (validationResult.issues.length > 0) {
        console.warn(`⚠️ [POST-ESCROW-VALIDATION] Found ${validationResult.issues.length} issues after ${operation}`);
        
        // Log critical issues
        validationResult.issues.forEach(issue => {
          if (issue.severity === 'HIGH') {
            console.error(`🚨 [CRITICAL-ISSUE] ${issue.description}`);
          }
        });
      }

      return validationResult;

    } catch (error) {
      console.error('[POST-ESCROW-VALIDATION] Error:', error);
    }
  }

  /**
   * Schedule periodic balance validation
   */
  startPeriodicValidation(intervalMinutes = 60) {
    setInterval(async () => {
      try {
        console.log('🔄 [PERIODIC-VALIDATION] Running scheduled balance validation...');
        
        const results = await this.validateAllUserBalances({
          limit: 50,
          autoFix: true,
          onlyWithIssues: true
        });

        if (results.usersWithIssues > 0) {
          console.warn(`⚠️ [PERIODIC-VALIDATION] Found issues in ${results.usersWithIssues} users, ${results.totalFixes} fixes applied`);
        }

      } catch (error) {
        console.error('[PERIODIC-VALIDATION] Error:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`🔄 [PERIODIC-VALIDATION] Scheduled every ${intervalMinutes} minutes`);
  }
}

module.exports = new BalanceValidationService();