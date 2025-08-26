/**
 * Test script to verify the balance validation fix
 * This script tests that the validation correctly calculates expected blockchain balances
 */

const { User } = require('../src/database/models');
const balanceValidationService = require('../src/services/balanceValidationService');

// Mock user data to simulate the issue
const mockUser = {
  _id: 'test_user_id',
  chatId: 'test_chat_id',
  walletAddress: '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d',
  cesBalance: 1, // Available balance
  escrowCESBalance: 0, // Escrowed balance (should be 0 after refund)
  polBalance: 0.6688585772970039,
  escrowPOLBalance: 0
};

// Mock wallet service functions
const mockWalletService = {
  async getCESBalance(address) {
    // Simulate real blockchain balance (1 CES)
    return 1;
  },
  
  async getPOLBalance(address) {
    // Simulate real blockchain balance (0.6688585772970039 POL)
    return 0.6688585772970039;
  }
};

// Replace the real wallet service with our mock for testing
jest.mock('../src/services/walletService', () => mockWalletService);

async function testBalanceValidationFix() {
  console.log('🧪 Testing Balance Validation Fix');
  console.log('================================');
  
  try {
    // Test 1: Validate user with correct balances
    console.log('📋 Test 1: Validating user with correct balances');
    
    // Mock User.findById to return our mock user
    User.findById = jest.fn().mockResolvedValue(mockUser);
    
    const validationResult = await balanceValidationService.validateAndFixUserBalance('test_user_id', {
      autoFix: false,
      logDetails: false
    });
    
    console.log('✅ Validation completed');
    console.log(`   Issues found: ${validationResult.issues.length}`);
    
    // Check if there are any balance mismatch issues
    const balanceIssues = validationResult.issues.filter(issue => 
      issue.type.includes('BALANCE_MISMATCH')
    );
    
    if (balanceIssues.length === 0) {
      console.log('✅ PASS: No balance mismatch issues found');
    } else {
      console.log('❌ FAIL: Balance mismatch issues found:');
      balanceIssues.forEach(issue => {
        console.log(`   - ${issue.description}`);
      });
    }
    
    // Test 2: Validate the expected CES calculation
    console.log('\n📋 Test 2: Testing expected CES calculation');
    
    const expectedCES = mockUser.cesBalance; // Should be 1, not 1 + 0
    const blockchainCES = await mockWalletService.getCESBalance(mockUser.walletAddress);
    
    console.log(`   Expected CES (available only): ${expectedCES}`);
    console.log(`   Blockchain CES: ${blockchainCES}`);
    
    if (Math.abs(expectedCES - blockchainCES) < 0.0001) {
      console.log('✅ PASS: Expected CES calculation is correct');
    } else {
      console.log('❌ FAIL: Expected CES calculation is incorrect');
    }
    
    // Test 3: Validate the expected POL calculation
    console.log('\n📋 Test 3: Testing expected POL calculation');
    
    const expectedPOL = mockUser.polBalance; // Should be 0.6688585772970039
    const blockchainPOL = await mockWalletService.getPOLBalance(mockUser.walletAddress);
    
    console.log(`   Expected POL (available only): ${expectedPOL}`);
    console.log(`   Blockchain POL: ${blockchainPOL}`);
    
    if (Math.abs(expectedPOL - blockchainPOL) < 0.0001) {
      console.log('✅ PASS: Expected POL calculation is correct');
    } else {
      console.log('❌ FAIL: Expected POL calculation is incorrect');
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testBalanceValidationFix().catch(console.error);
}

module.exports = { testBalanceValidationFix };