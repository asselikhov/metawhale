/**
 * 🧪 COMPREHENSIVE DISPUTE SYSTEM TESTS
 * Tests for all dispute system components
 */

const assert = require('assert');
const mongoose = require('mongoose');

// Mock environment for testing
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/metawhale-test-disputes';

// Import modules
const disputeService = require('../src/services/dispute/disputeServiceInstance');
const DisputeHandler = require('../src/handlers/DisputeHandler');
const AdminDisputeHandler = require('../src/handlers/AdminDisputeHandler');
const { P2PTrade, User, DisputeLog, Moderator } = require('../src/database/models');
const sessionManager = require('../src/handlers/SessionManager');

// Test data
let testUser1, testUser2, testModerator, testTrade;

describe('🏛️ Dispute System Tests', function() {
  this.timeout(30000); // 30 second timeout for each test

  before(async function() {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Connect to test database
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to test database');
      }
      
      // Clean up existing test data
      await P2PTrade.deleteMany({ sellOrderId: { $regex: 'test' } });
      await User.deleteMany({ chatId: { $regex: 'test' } });
      await DisputeLog.deleteMany({});
      await Moderator.deleteMany({ 'userId.chatId': { $regex: 'test' } });
      
      // Create test users
      testUser1 = await User.create({
        chatId: 'test_user_1',
        username: 'TestBuyer',
        firstName: 'Test',
        lastName: 'Buyer',
        isActive: true
      });
      
      testUser2 = await User.create({
        chatId: 'test_user_2', 
        username: 'TestSeller',
        firstName: 'Test',
        lastName: 'Seller',
        isActive: true
      });
      
      // Create test moderator user
      const moderatorUser = await User.create({
        chatId: 'test_moderator',
        username: 'TestModerator',
        firstName: 'Test',
        lastName: 'Moderator',
        isActive: true
      });
      
      // Create moderator profile
      testModerator = await Moderator.create({
        userId: moderatorUser._id,
        isActive: true,
        specializations: ['payment_disputes', 'fraud_prevention'],
        statistics: {
          totalDisputes: 10,
          resolvedDisputes: 8,
          currentWorkload: 0,
          successRate: 80,
          averageResolutionTime: 120
        },
        availability: {
          isOnline: true,
          lastOnline: new Date()
        }
      });
      
      // Create test P2P trade
      testTrade = await P2PTrade.create({
        sellOrderId: 'test_sell_order_123',
        buyOrderId: 'test_buy_order_456',
        sellerId: testUser2._id,
        buyerId: testUser1._id,
        amount: 100,
        price: 50,
        totalValue: 5000,
        status: 'payment_made',
        escrowStatus: 'locked',
        paymentDetails: {
          bankCode: 'SBER',
          accountNumber: '1234567890',
          holderName: 'Test Seller'
        },
        createdAt: new Date(),
        timelock: {
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isActive: true
        }
      });
      
      console.log('✅ Test data created successfully');
      
    } catch (error) {
      console.error('❌ Test setup failed:', error);
      throw error;
    }
  });

  after(async function() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Clean up test data
      await P2PTrade.deleteMany({ sellOrderId: { $regex: 'test' } });
      await User.deleteMany({ chatId: { $regex: 'test' } });
      await DisputeLog.deleteMany({});
      await Moderator.deleteMany({});
      
      // Close database connection
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('✅ Disconnected from test database');
      }
      
    } catch (error) {
      console.error('❌ Test cleanup failed:', error);
    }
  });

  describe('📊 DisputeService Tests', function() {
    
    it('should validate dispute rights correctly', async function() {
      // Test valid dispute initiation
      const validResult = await disputeService.validateDisputeRights(testTrade, testUser1._id);
      assert.strictEqual(validResult.allowed, true, 'Trade participant should be able to initiate dispute');
      
      // Test invalid user (not participant)
      const randomUser = await User.create({
        chatId: 'test_random_user',
        username: 'RandomUser'
      });
      
      const invalidResult = await disputeService.validateDisputeRights(testTrade, randomUser._id);
      assert.strictEqual(invalidResult.allowed, false, 'Non-participant should not be able to initiate dispute');
      
      await User.deleteOne({ _id: randomUser._id });
    });

    it('should calculate dispute priority correctly', async function() {
      // Test urgent priority for high amount
      const urgentPriority = disputeService.calculateDisputePriority(
        { totalValue: 15000 }, 
        'payment_not_received', 
        'high'
      );
      assert.strictEqual(urgentPriority, 'urgent', 'High amount should result in urgent priority');
      
      // Test fraud attempt should be urgent regardless of amount
      const fraudPriority = disputeService.calculateDisputePriority(
        { totalValue: 1000 }, 
        'fraud_attempt', 
        'low'
      );
      assert.strictEqual(fraudPriority, 'urgent', 'Fraud attempt should always be urgent');
      
      // Test medium priority for normal case
      const mediumPriority = disputeService.calculateDisputePriority(
        { totalValue: 2000 }, 
        'technical_issue', 
        'medium'
      );
      assert.strictEqual(mediumPriority, 'medium', 'Normal case should result in medium priority');
    });

    it('should initiate dispute successfully', async function() {
      const result = await disputeService.initiateDispute(
        testTrade._id,
        testUser1.chatId,
        'payment_not_received',
        'I sent the payment but seller hasnt confirmed',
        'high'
      );
      
      assert.strictEqual(result.success, true, 'Dispute initiation should succeed');
      assert.ok(result.disputeId, 'Dispute ID should be returned');
      assert.ok(result.priority, 'Priority should be assigned');
      
      // Verify trade status was updated
      const updatedTrade = await P2PTrade.findById(testTrade._id);
      assert.strictEqual(updatedTrade.status, 'disputed', 'Trade status should be disputed');
      assert.strictEqual(updatedTrade.disputeCategory, 'payment_not_received', 'Dispute category should be set');
      assert.ok(updatedTrade.disputeTracking.openedAt, 'Dispute tracking should be initialized');
    });

    it('should submit evidence successfully', async function() {
      const result = await disputeService.submitEvidence(
        testTrade._id,
        testUser1.chatId,
        'text',
        'Here is my payment confirmation screenshot showing the transfer was made at 14:30',
        'Payment confirmation evidence'
      );
      
      assert.strictEqual(result.success, true, 'Evidence submission should succeed');
      
      // Verify evidence was stored
      const updatedTrade = await P2PTrade.findById(testTrade._id);
      assert.ok(updatedTrade.disputeEvidence, 'Dispute evidence should be created');
      assert.ok(updatedTrade.disputeEvidence.buyerEvidence.length > 0, 'Buyer evidence should be stored');
      
      const evidence = updatedTrade.disputeEvidence.buyerEvidence[0];
      assert.strictEqual(evidence.type, 'text', 'Evidence type should be correct');
      assert.ok(evidence.content.includes('payment confirmation'), 'Evidence content should be stored');
    });

    it('should assign optimal moderator', async function() {
      const assignedModerator = await disputeService.assignOptimalModerator(testTrade);
      
      assert.ok(assignedModerator, 'Moderator should be assigned');
      assert.strictEqual(assignedModerator._id.toString(), testModerator.userId.toString(), 'Correct moderator should be assigned');
      
      // Verify moderator workload was updated
      const updatedModerator = await Moderator.findById(testModerator._id);
      assert.strictEqual(updatedModerator.statistics.currentWorkload, 1, 'Moderator workload should be incremented');
    });

    it('should resolve dispute successfully', async function() {
      const result = await disputeService.resolveDispute(
        testTrade._id,
        testModerator.userId.chatId,
        'buyer_wins',
        null,
        'Evidence clearly shows payment was made and seller did not respond appropriately'
      );
      
      assert.strictEqual(result.success, true, 'Dispute resolution should succeed');
      assert.strictEqual(result.resolution, 'buyer_wins', 'Resolution type should be recorded');
      
      // Verify trade was updated
      const resolvedTrade = await P2PTrade.findById(testTrade._id);
      assert.strictEqual(resolvedTrade.disputeStatus, 'resolved', 'Dispute status should be resolved');
      assert.ok(resolvedTrade.disputeResolution, 'Resolution details should be stored');
      assert.strictEqual(resolvedTrade.disputeResolution.outcome, 'buyer_wins', 'Resolution outcome should be correct');
      assert.ok(resolvedTrade.disputeTracking.resolvedAt, 'Resolution timestamp should be set');
    });
  });

  describe('📱 DisputeHandler Tests', function() {
    let disputeHandler;
    let mockContext;

    beforeEach(function() {
      disputeHandler = new DisputeHandler();
      
      // Mock Telegram context
      mockContext = {
        chat: { id: parseInt(testUser1.chatId.replace('test_user_', '')) },
        reply: async (message, keyboard) => {
          console.log('📤 Mock reply:', message.substring(0, 100) + '...');
          return { message_id: Math.random(), chat: mockContext.chat };
        },
        callbackQuery: null
      };
    });

    it('should validate dispute categories', function() {
      const categories = Object.keys(disputeHandler.DISPUTE_CATEGORIES);
      
      assert.ok(categories.includes('payment_not_received'), 'Should include payment_not_received category');
      assert.ok(categories.includes('fraud_attempt'), 'Should include fraud_attempt category');
      assert.ok(categories.includes('technical_issue'), 'Should include technical_issue category');
      
      categories.forEach(category => {
        const categoryInfo = disputeHandler.DISPUTE_CATEGORIES[category];
        assert.ok(categoryInfo.title, `Category ${category} should have title`);
        assert.ok(categoryInfo.description, `Category ${category} should have description`);
        assert.ok(categoryInfo.priority, `Category ${category} should have priority`);
      });
    });

    it('should format status correctly', function() {
      assert.strictEqual(disputeHandler.formatStatus('open'), 'Открыт');
      assert.strictEqual(disputeHandler.formatStatus('investigating'), 'Расследование');
      assert.strictEqual(disputeHandler.formatStatus('resolved'), 'Решен');
    });

    it('should get estimated time correctly', function() {
      assert.strictEqual(disputeHandler.getEstimatedTime('urgent'), '2-4 часа');
      assert.strictEqual(disputeHandler.getEstimatedTime('high'), '4-12 часов');
      assert.strictEqual(disputeHandler.getEstimatedTime('medium'), '12-24 часа');
      assert.strictEqual(disputeHandler.getEstimatedTime('low'), '24-48 часов');
    });

    it('should process text input for dispute description', async function() {
      // Set up session for awaiting dispute description
      sessionManager.setSessionData(testUser1.chatId, 'awaitingDisputeDescription', true);
      sessionManager.setSessionData(testUser1.chatId, 'disputeCategory', 'payment_not_received');
      sessionManager.setSessionData(testUser1.chatId, 'disputeTradeId', testTrade._id.toString());
      
      const result = await disputeHandler.processTextInput(mockContext, 'Detailed description of the payment issue');
      
      assert.strictEqual(result, true, 'Text input should be processed successfully');
      
      // Verify session was cleared
      const awaitingDescription = sessionManager.getSessionData(testUser1.chatId, 'awaitingDisputeDescription');
      assert.strictEqual(awaitingDescription, false, 'Should no longer be awaiting description');
    });
  });

  describe('⚖️ AdminDisputeHandler Tests', function() {
    let adminHandler;
    let mockModeratorContext;

    beforeEach(function() {
      adminHandler = new AdminDisputeHandler();
      
      // Mock moderator context
      mockModeratorContext = {
        chat: { id: parseInt(testModerator.userId.chatId.replace('test_', '')) },
        reply: async (message, keyboard) => {
          console.log('📤 Mock moderator reply:', message.substring(0, 100) + '...');
          return { message_id: Math.random(), chat: mockModeratorContext.chat };
        }
      };
    });

    it('should validate moderator access correctly', async function() {
      const validModerator = await adminHandler.validateModeratorAccess(testModerator.userId.chatId);
      assert.ok(validModerator, 'Valid moderator should have access');
      assert.strictEqual(validModerator._id.toString(), testModerator._id.toString(), 'Correct moderator should be returned');
      
      const invalidAccess = await adminHandler.validateModeratorAccess('invalid_chat_id');
      assert.strictEqual(invalidAccess, null, 'Invalid user should not have access');
    });

    it('should format dispute categories correctly', function() {
      assert.strictEqual(adminHandler.formatCategory('payment_not_received'), 'Платеж не получен');
      assert.strictEqual(adminHandler.formatCategory('fraud_attempt'), 'Попытка мошенничества');
      assert.strictEqual(adminHandler.formatCategory('technical_issue'), 'Техническая проблема');
    });

    it('should get moderator statistics', async function() {
      const stats = await adminHandler.getModeratorStats(testModerator.userId._id);
      
      assert.ok(typeof stats.activeDisputes === 'number', 'Should return active disputes count');
      assert.ok(typeof stats.resolvedToday === 'number', 'Should return resolved today count');
      assert.ok(typeof stats.averageRating === 'number', 'Should return average rating');
    });

    it('should build queue navigation keyboard', function() {
      const keyboard = adminHandler.buildQueueNavigationKeyboard('all', 0, true);
      
      assert.ok(keyboard, 'Keyboard should be generated');
      assert.ok(keyboard.reply_markup, 'Keyboard should have reply markup');
      assert.ok(keyboard.reply_markup.inline_keyboard, 'Should have inline keyboard');
      
      const buttons = keyboard.reply_markup.inline_keyboard;
      assert.ok(buttons.length > 0, 'Should have navigation buttons');
    });

    it('should process resolution notes text input', async function() {
      // Set up session for awaiting resolution notes
      sessionManager.setSessionData(testModerator.userId.chatId, 'awaitingResolutionNotes', true);
      sessionManager.setSessionData(testModerator.userId.chatId, 'pendingResolution', {
        resolution: 'buyer_wins',
        disputeId: testTrade._id.toString()
      });
      
      // Mock the executeResolution method to avoid actual execution
      const originalExecute = adminHandler.executeResolution;
      let executionCalled = false;
      adminHandler.executeResolution = async () => {
        executionCalled = true;
        return true;
      };
      
      const result = await adminHandler.processTextInput(mockModeratorContext, 'Resolution notes: Payment evidence was convincing');
      
      assert.strictEqual(result, true, 'Text input should be processed');
      assert.strictEqual(executionCalled, true, 'Resolution execution should be called');
      
      // Restore original method
      adminHandler.executeResolution = originalExecute;
    });
  });

  describe('🔧 Integration Tests', function() {
    
    it('should handle complete dispute workflow', async function() {
      // Create a new trade for this test
      const integrationTrade = await P2PTrade.create({
        sellOrderId: 'test_integration_sell',
        buyOrderId: 'test_integration_buy',
        sellerId: testUser2._id,
        buyerId: testUser1._id,
        amount: 50,
        price: 60,
        totalValue: 3000,
        status: 'payment_made',
        escrowStatus: 'locked'
      });
      
      try {
        // Step 1: Initiate dispute
        const initiateResult = await disputeService.initiateDispute(
          integrationTrade._id,
          testUser1.chatId,
          'payment_not_received',
          'Integration test dispute',
          'medium'
        );
        
        assert.strictEqual(initiateResult.success, true, 'Dispute initiation should succeed');
        
        // Step 2: Submit evidence from buyer
        const buyerEvidenceResult = await disputeService.submitEvidence(
          integrationTrade._id,
          testUser1.chatId,
          'text',
          'Payment screenshot and bank confirmation',
          'Buyer evidence for integration test'
        );
        
        assert.strictEqual(buyerEvidenceResult.success, true, 'Buyer evidence submission should succeed');
        
        // Step 3: Submit evidence from seller
        const sellerEvidenceResult = await disputeService.submitEvidence(
          integrationTrade._id,
          testUser2.chatId,
          'text',
          'Account statement showing no incoming payment',
          'Seller evidence for integration test'
        );
        
        assert.strictEqual(sellerEvidenceResult.success, true, 'Seller evidence submission should succeed');
        
        // Step 4: Assign moderator
        const moderator = await disputeService.assignOptimalModerator(integrationTrade);
        assert.ok(moderator, 'Moderator should be assigned');
        
        // Step 5: Resolve dispute
        const resolutionResult = await disputeService.resolveDispute(
          integrationTrade._id,
          testModerator.userId.chatId,
          'compromise',
          null,
          'Both parties provided evidence, partial resolution recommended'
        );
        
        assert.strictEqual(resolutionResult.success, true, 'Dispute resolution should succeed');
        
        // Verify final state
        const finalTrade = await P2PTrade.findById(integrationTrade._id);
        assert.strictEqual(finalTrade.disputeStatus, 'resolved', 'Final status should be resolved');
        assert.ok(finalTrade.disputeEvidence.buyerEvidence.length > 0, 'Buyer evidence should be preserved');
        assert.ok(finalTrade.disputeEvidence.sellerEvidence.length > 0, 'Seller evidence should be preserved');
        assert.ok(finalTrade.disputeTracking.resolvedAt, 'Resolution timestamp should be set');
        
        // Verify dispute logs were created
        const disputeLogs = await DisputeLog.find({ tradeId: integrationTrade._id });
        assert.ok(disputeLogs.length > 0, 'Dispute logs should be created');
        
        const actions = disputeLogs.map(log => log.action);
        assert.ok(actions.includes('initiated'), 'Should have initiation log');
        assert.ok(actions.includes('evidence_submitted'), 'Should have evidence submission logs');
        assert.ok(actions.includes('resolved'), 'Should have resolution log');
        
      } finally {
        // Clean up integration test data
        await P2PTrade.deleteOne({ _id: integrationTrade._id });
        await DisputeLog.deleteMany({ tradeId: integrationTrade._id });
      }
    });

    it('should handle auto-escalation workflow', async function() {
      // Create a trade with old dispute timestamp
      const escalationTrade = await P2PTrade.create({
        sellOrderId: 'test_escalation_sell',
        buyOrderId: 'test_escalation_buy', 
        sellerId: testUser2._id,
        buyerId: testUser1._id,
        amount: 25,
        price: 70,
        totalValue: 1750,
        status: 'disputed',
        disputeStatus: 'investigating',
        disputePriority: 'medium',
        disputeCategory: 'payment_not_received',
        disputeInitiatorId: testUser1._id,
        disputeTracking: {
          openedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          autoEscalationAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
        }
      });
      
      try {
        // Run auto-escalation
        await disputeService.processAutoEscalation();
        
        // Verify escalation occurred
        const escalatedTrade = await P2PTrade.findById(escalationTrade._id);
        assert.ok(escalatedTrade.disputeTracking.escalatedAt, 'Escalation timestamp should be set');
        assert.strictEqual(escalatedTrade.disputePriority, 'high', 'Priority should be escalated');
        
        // Verify escalation log
        const escalationLogs = await DisputeLog.find({ 
          tradeId: escalationTrade._id,
          action: 'escalated'
        });
        assert.ok(escalationLogs.length > 0, 'Escalation log should be created');
        
      } finally {
        // Clean up escalation test data
        await P2PTrade.deleteOne({ _id: escalationTrade._id });
        await DisputeLog.deleteMany({ tradeId: escalationTrade._id });
      }
    });
  });
});

// Run the tests if this file is executed directly
if (require.main === module) {
  console.log('🧪 Running Dispute System Tests...');
  
  // Add uncaught exception handler
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}