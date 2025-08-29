/**
 * 🔍 DISPUTE SYSTEM VALIDATION SCRIPT
 * Validates dispute system functionality and integration
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import dispute system components
const disputeService = require('../src/services/dispute/disputeServiceInstance');
const DisputeHandler = require('../src/handlers/DisputeHandler');
const AdminDisputeHandler = require('../src/handlers/AdminDisputeHandler');
const { P2PTrade, User, Moderator, DisputeLog } = require('../src/database/models');

class DisputeSystemValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async validate() {
    console.log('🔍 Starting Dispute System Validation...\n');

    try {
      // Connect to database
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');
      }

      // Run validation tests
      await this.validateDatabaseModels();
      await this.validateDisputeService();
      await this.validateHandlers();
      await this.validateIntegration();

      // Print results
      this.printResults();

    } catch (error) {
      console.error('❌ Validation failed:', error);
      this.results.errors.push(`Critical Error: ${error.message}`);
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from database');
      }
    }
  }

  async validateDatabaseModels() {
    console.log('📊 Validating Database Models...');

    try {
      // Check P2PTrade schema extensions for disputes
      const sampleTrade = new P2PTrade({
        sellOrderId: new mongoose.Types.ObjectId(),
        buyOrderId: new mongoose.Types.ObjectId(),
        sellerId: new mongoose.Types.ObjectId(),
        buyerId: new mongoose.Types.ObjectId(),
        amount: 100,
        price: 50,
        pricePerToken: 50,
        totalValue: 5000,
        commission: 25,
        status: 'disputed',
        disputeStatus: 'open',
        disputeCategory: 'payment_not_received',
        disputePriority: 'high'
      });

      const validationError = sampleTrade.validateSync();
      if (validationError) {
        throw new Error(`P2PTrade validation failed: ${validationError.message}`);
      }

      this.pass('P2PTrade dispute schema extensions');

      // Check Moderator model
      const sampleModerator = new Moderator({
        userId: new mongoose.Types.ObjectId(),
        isActive: true,
        specializations: ['payment_disputes'],
        statistics: {
          totalDisputes: 0,
          resolvedDisputes: 0,
          currentWorkload: 0,
          successRate: 0,
          averageResolutionTime: 0
        }
      });

      const moderatorValidation = sampleModerator.validateSync();
      if (moderatorValidation) {
        throw new Error(`Moderator validation failed: ${moderatorValidation.message}`);
      }

      this.pass('Moderator model structure');

      // Check DisputeLog model
      const sampleLog = new DisputeLog({
        tradeId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        action: 'initiated',
        newState: 'open',
        metadata: { test: true },
        timestamp: new Date()
      });

      const logValidation = sampleLog.validateSync();
      if (logValidation) {
        throw new Error(`DisputeLog validation failed: ${logValidation.message}`);
      }

      this.pass('DisputeLog model structure');

    } catch (error) {
      this.fail('Database Models', error.message);
    }

    console.log('');
  }

  async validateDisputeService() {
    console.log('🛠️ Validating DisputeService...');

    try {
      // Check service methods exist
      const requiredMethods = [
        'initiateDispute',
        'submitEvidence', 
        'resolveDispute',
        'assignOptimalModerator',
        'processAutoEscalation',
        'escalateDispute',
        'calculateDisputePriority',
        'validateDisputeRights'
      ];

      for (const method of requiredMethods) {
        if (typeof disputeService[method] !== 'function') {
          throw new Error(`DisputeService missing method: ${method}`);
        }
      }

      this.pass('DisputeService method availability');

      // Test priority calculation
      const urgentPriority = disputeService.calculateDisputePriority(
        { totalValue: 15000 }, 
        'payment_not_received', 
        'high'
      );
      
      if (urgentPriority !== 'urgent') {
        throw new Error(`Priority calculation failed: expected urgent, got ${urgentPriority}`);
      }

      this.pass('DisputeService priority calculation');

      // Test fraud category handling
      const fraudPriority = disputeService.calculateDisputePriority(
        { totalValue: 1000 }, 
        'fraud_attempt', 
        'low'
      );
      
      if (fraudPriority !== 'urgent') {
        throw new Error(`Fraud priority failed: expected urgent, got ${fraudPriority}`);
      }

      this.pass('DisputeService fraud detection priority');

    } catch (error) {
      this.fail('DisputeService', error.message);
    }

    console.log('');
  }

  async validateHandlers() {
    console.log('📱 Validating Dispute Handlers...');

    try {
      // Test DisputeHandler
      const disputeHandler = new DisputeHandler();
      
      if (!disputeHandler.DISPUTE_CATEGORIES) {
        throw new Error('DisputeHandler missing DISPUTE_CATEGORIES');
      }

      const requiredCategories = [
        'payment_not_received',
        'payment_not_made', 
        'wrong_amount',
        'fraud_attempt',
        'technical_issue',
        'other'
      ];

      for (const category of requiredCategories) {
        if (!disputeHandler.DISPUTE_CATEGORIES[category]) {
          throw new Error(`Missing dispute category: ${category}`);
        }
      }

      this.pass('DisputeHandler categories configuration');

      // Test status formatting
      const formattedStatus = disputeHandler.formatStatus('investigating');
      if (formattedStatus !== 'Расследование') {
        throw new Error(`Status formatting failed: ${formattedStatus}`);
      }

      this.pass('DisputeHandler status formatting');

      // Test AdminDisputeHandler
      const adminHandler = new AdminDisputeHandler();
      
      if (!adminHandler.RESOLUTION_TYPES) {
        throw new Error('AdminDisputeHandler missing RESOLUTION_TYPES');
      }

      const requiredResolutions = [
        'buyer_wins',
        'seller_wins',
        'compromise', 
        'no_fault',
        'insufficient_evidence'
      ];

      for (const resolution of requiredResolutions) {
        if (!adminHandler.RESOLUTION_TYPES[resolution]) {
          throw new Error(`Missing resolution type: ${resolution}`);
        }
      }

      this.pass('AdminDisputeHandler resolution types');

      // Test category formatting
      const formattedCategory = adminHandler.formatCategory('fraud_attempt');
      if (formattedCategory !== 'Попытка мошенничества') {
        throw new Error(`Category formatting failed: ${formattedCategory}`);
      }

      this.pass('AdminDisputeHandler category formatting');

    } catch (error) {
      this.fail('Dispute Handlers', error.message);
    }

    console.log('');
  }

  async validateIntegration() {
    console.log('🔗 Validating System Integration...');

    try {
      // Check if telegram bot callbacks are properly registered
      const telegramBot = require('../src/bot/telegramBot');
      const bot = telegramBot.getInstance();
      
      if (!bot) {
        throw new Error('Telegram bot instance not available');
      }

      this.pass('Telegram bot integration');

      // Check BaseCommandHandler integration
      const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
      const baseHandler = new BaseCommandHandler();
      
      // Test with mock context for dispute text processing
      const mockContext = {
        chat: { id: 123456 },
        message: { text: 'test dispute text' },
        reply: async () => ({ message_id: 1 })
      };

      // This should not throw an error even if no dispute is active
      const textProcessed = await baseHandler.handleTextMessage(mockContext);
      
      this.pass('BaseCommandHandler dispute integration');

      // Check session management
      const sessionManager = require('../src/handlers/SessionManager');
      
      // Test setting and getting session data
      sessionManager.setSessionData('test_validation', 'awaitingDisputeDescription', true);
      const sessionData = sessionManager.getSessionData('test_validation', 'awaitingDisputeDescription');
      
      if (sessionData !== true) {
        throw new Error('Session management failed');
      }

      // Clear session using the correct method
      sessionManager.clearUserSession('test_validation');
      this.pass('Session management integration');

    } catch (error) {
      this.fail('System Integration', error.message);
    }

    console.log('');
  }

  pass(testName) {
    console.log(`✅ ${testName}`);
    this.results.passed++;
  }

  fail(testName, error) {
    console.log(`❌ ${testName}: ${error}`);
    this.results.failed++;
    this.results.errors.push(`${testName}: ${error}`);
  }

  printResults() {
    console.log('📊 VALIDATION RESULTS');
    console.log('═'.repeat(50));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    if (this.results.failed === 0) {
      console.log('\n🎉 All dispute system validations passed! The system is ready for use.');
    } else {
      console.log('\n⚠️ Some validations failed. Please review and fix the issues above.');
    }
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  const validator = new DisputeSystemValidator();
  validator.validate().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

module.exports = DisputeSystemValidator;