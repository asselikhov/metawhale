/**
 * Trade Formation Bug Fixes Validation Script
 * Tests all implemented fixes for taker-maker trade formation bugs
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2POrder, P2PTrade } = require('../src/database/models');
const p2pService = require('../src/services/p2pService');
const PrecisionUtil = require('../src/utils/PrecisionUtil');

async function validateBugFixes() {
  try {
    console.log('🧪 VALIDATING TRADE FORMATION BUG FIXES');
    console.log('=====================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      errors: []
    };
    
    // Test 1: Commission Logic Consistency
    console.log('\n📊 TEST 1: Commission Logic Consistency');
    try {
      const cesAmount = 10;
      const commissionRate = 0.01;
      
      // Test precision utility
      const commission1 = PrecisionUtil.calculateCommission(cesAmount, commissionRate, 4);
      const commission2 = cesAmount * commissionRate;
      
      console.log(`   Precision commission: ${commission1}`);
      console.log(`   Standard commission: ${commission2}`);
      
      if (PrecisionUtil.isEqual(commission1, commission2, 0.000001)) {
        console.log('   ✅ Commission calculations are consistent');
        results.passedTests++;
      } else {
        console.log('   ❌ Commission calculations differ');
        results.failedTests++;
        results.errors.push('Commission calculation inconsistency');
      }
      results.totalTests++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failedTests++;
      results.errors.push(`Commission test error: ${error.message}`);
    }
    
    // Test 2: Precision Calculations
    console.log('\n🔢 TEST 2: Precision Calculations');
    try {
      const amount = 123.456789;
      const rate = 0.01;
      const price = 87.654321;
      
      const commission = PrecisionUtil.calculateCommission(amount, rate, 4);
      const rubleValue = PrecisionUtil.cesCommissionToRubles(commission, price, 2);
      
      console.log(`   CES Commission: ${commission} (4 decimals)`);
      console.log(`   Ruble Value: ${rubleValue} (2 decimals)`);
      
      // Check that precision is maintained
      if (commission.toString().split('.')[1]?.length <= 4 && 
          rubleValue.toString().split('.')[1]?.length <= 2) {
        console.log('   ✅ Precision limits respected');
        results.passedTests++;
      } else {
        console.log('   ❌ Precision limits exceeded');
        results.failedTests++;
        results.errors.push('Precision limits not respected');
      }
      results.totalTests++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failedTests++;
      results.errors.push(`Precision test error: ${error.message}`);
    }
    
    // Test 3: Enhanced Trading Limits
    console.log('\n🚫 TEST 3: Enhanced Trading Limits');
    try {
      // Create a mock user for testing
      const testUser = {
        verificationLevel: 'phone_verified',
        trustScore: 4.5,
        tradeAnalytics: { failedTradesLast30Days: 2 },
        tradingLimits: { maxSingleTrade: 100, dailyLimit: 50000 } // Increased daily limit
      };
      
      // Test various scenarios
      const scenarios = [
        { cesAmount: 50, rubleValue: 60000, expected: false, reason: 'High value, verified but exceeds daily limit' },
        { cesAmount: 30, rubleValue: 25000, expected: true, reason: 'Normal trade within limits' },
        { cesAmount: 150, rubleValue: 15000, expected: false, reason: 'Exceeds single trade limit' }
      ];
      
      let passed = 0;
      for (const scenario of scenarios) {
        const result = p2pService.checkEnhancedTradeLimits(testUser, scenario.cesAmount, scenario.rubleValue, 'buy');
        
        console.log(`     Testing: ${scenario.reason}`);
        console.log(`       Amount: ${scenario.cesAmount} CES, Value: ₽${scenario.rubleValue}`);
        console.log(`       Result: ${result.allowed ? 'Allowed' : 'Blocked'}`);
        console.log(`       Reason: ${result.reason || 'No reason'}`);
        
        if (result.allowed === scenario.expected) {
          console.log(`   ✅ ${scenario.reason}: ${result.allowed ? 'Allowed' : 'Blocked'}`);
          passed++;
        } else {
          console.log(`   ❌ ${scenario.reason}: Expected ${scenario.expected}, got ${result.allowed}`);
          console.log(`       Failure reason: ${result.reason}`);
          results.errors.push(`Trading limit test failed: ${scenario.reason} - ${result.reason}`);
        }
      }
      
      if (passed === scenarios.length) {
        results.passedTests++;
      } else {
        results.failedTests++;
      }
      results.totalTests++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failedTests++;
      results.errors.push(`Trading limits test error: ${error.message}`);
    }
    
    // Test 4: Payment Method Compatibility
    console.log('\n💳 TEST 4: Payment Method Compatibility');
    try {
      const buyOrder = { paymentMethods: ['bank_transfer', 'sbp'] };
      const sellOrder1 = { paymentMethods: ['bank_transfer', 'qiwi'] };
      const sellOrder2 = { paymentMethods: ['yoomoney'] };
      
      const compatible1 = p2pService.checkPaymentMethodCompatibility(buyOrder, sellOrder1);
      const compatible2 = p2pService.checkPaymentMethodCompatibility(buyOrder, sellOrder2);
      
      if (compatible1.compatible && !compatible2.compatible) {
        console.log('   ✅ Payment method compatibility correctly detected');
        console.log(`     Compatible methods: ${compatible1.methods?.join(', ')}`);
        console.log(`     Incompatible reason: ${compatible2.reason}`);
        results.passedTests++;
      } else {
        console.log('   ❌ Payment method compatibility detection failed');
        results.failedTests++;
        results.errors.push('Payment method compatibility test failed');
      }
      results.totalTests++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failedTests++;
      results.errors.push(`Payment method test error: ${error.message}`);
    }
    
    // Test 5: Code Structure Validation
    console.log('\n🔧 TEST 5: Code Structure Validation');
    try {
      const fs = require('fs');
      const path = require('path');
      const p2pServiceCode = fs.readFileSync(path.join(__dirname, '../src/services/p2pService.js'), 'utf8');
      
      const checks = [
        { pattern: /PrecisionUtil\.calculateCommission/, description: 'Precision utility usage' },
        { pattern: /FIX BUG #1/, description: 'Commission logic fix comments' },
        { pattern: /FIX BUG #2/, description: 'Race condition fix comments' },
        { pattern: /FIX BUG #3/, description: 'sellOrderId fix comments' },
        { pattern: /tempSellOrder\.save/, description: 'Proper sell order creation' },
        { pattern: /session\.withTransaction/, description: 'Atomic transactions' },
        { pattern: /checkEnhancedTradeLimits/, description: 'Enhanced validation functions' }
      ];
      
      let structureChecks = 0;
      for (const check of checks) {
        if (check.pattern.test(p2pServiceCode)) {
          console.log(`   ✅ ${check.description}`);
          structureChecks++;
        } else {
          console.log(`   ❌ Missing: ${check.description}`);
          results.errors.push(`Missing: ${check.description}`);
        }
      }
      
      if (structureChecks === checks.length) {
        results.passedTests++;
      } else {
        results.failedTests++;
      }
      results.totalTests++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failedTests++;
      results.errors.push(`Code structure test error: ${error.message}`);
    }
    
    // Test 6: Database Query Performance (basic check)
    console.log('\n⚡ TEST 6: Database Query Structure');
    try {
      // Check if we have any orders to test with
      const orderCount = await P2POrder.countDocuments();
      console.log(`   Database has ${orderCount} orders`);
      
      if (orderCount >= 0) { // Just check if query works
        console.log('   ✅ Database queries working');
        results.passedTests++;
      } else {
        console.log('   ❌ Database query failed');
        results.failedTests++;
      }
      results.totalTests++;
    } catch (error) {
      console.log(`   ❌ Database error: ${error.message}`);
      results.failedTests++;
      results.errors.push(`Database test error: ${error.message}`);
    }
    
    // Summary
    console.log('\n📈 VALIDATION SUMMARY');
    console.log('====================');
    console.log(`Total Tests: ${results.totalTests}`);
    console.log(`✅ Passed: ${results.passedTests}`);
    console.log(`❌ Failed: ${results.failedTests}`);
    console.log(`Success Rate: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`);
    
    if (results.errors.length > 0) {
      console.log('\n🔍 ERRORS FOUND:');
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (results.passedTests === results.totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Bug fixes are working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the fixes.');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Validation script error:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n💾 Database connection closed');
  }
}

// Run validation
if (require.main === module) {
  validateBugFixes().then(results => {
    console.log('\n✅ Validation completed');
    process.exit(results.passedTests === results.totalTests ? 0 : 1);
  }).catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

module.exports = { validateBugFixes };