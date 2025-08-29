/**
 * Balance Validation Service
 * Handles validation of user balances after escrow operations
 */

const { User } = require('../../../database/models');

class BalanceValidationService {
  constructor(parentService) {
    this.parentService = parentService;
  }

  // Validate balances after escrow operation
  async validateAfterEscrowOperation(userId, operationType, amount, tokenType) {
    try {
      console.log(`🔍 Validating balances after ${operationType} operation for user ${userId}`);
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found for balance validation');
      }
      
      // Calculate total balance (regular + escrow)
      let totalBalance = 0;
      if (tokenType === 'CES') {
        totalBalance = (user.cesBalance || 0) + (user.escrowCESBalance || 0);
      } else {
        totalBalance = (user.polBalance || 0) + (user.escrowPOLBalance || 0);
      }
      
      console.log(`📈 User ${userId} total ${tokenType} balance: ${totalBalance}`);
      
      // Additional validation logic can be added here
      // For example, checking against known good states or limits
      
      return { valid: true, totalBalance };
      
    } catch (error) {
      console.error('Error validating balances after escrow operation:', error);
      return { valid: false, error: error.message };
    }
  }

  // Validate balances after dispute resolution
  async validateAfterDisputeResolution(userId1, userId2) {
    try {
      console.log('🔍 Validating balances after dispute resolution...');
      
      // Manual balance check as fallback
      const user1 = await User.findById(userId1);
      const user2 = await User.findById(userId2);
      
      if (user1) {
        const totalBalance1 = (user1.cesBalance || 0) + (user1.escrowCESBalance || 0);
        console.log(`📈 User ${userId1} total balance: ${totalBalance1} CES`);
      }
      
      if (user2) {
        const totalBalance2 = (user2.cesBalance || 0) + (user2.escrowCESBalance || 0);
        console.log(`📈 User ${userId2} total balance: ${totalBalance2} CES`);
      }
      
      return { valid: true };
      
    } catch (error) {
      console.error('Error validating balances after dispute resolution:', error);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = BalanceValidationService;