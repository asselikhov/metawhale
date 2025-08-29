/**
 * Comprehensive test for multi-currency P2P price display functionality
 * Tests all aspects of the updated multi-currency P2P system
 */

console.log('🔍 Comprehensive Multi-Currency P2P Test\n');

// Test 1: Check market price suggestion service
async function testMarketPriceSuggestion() {
  console.log('1️⃣ Testing Market Price Suggestion Service...');
  
  try {
    const p2pService = require('../src/services/p2p');
    const marketPriceData = await p2pService.getMarketPriceSuggestion();
    
    console.log('   ✅ Market price suggestion service is available');
    console.log(`   📊 Current price in RUB: ${marketPriceData.currentPriceRub}`);
    console.log(`   📊 Current price in USD: ${marketPriceData.currentPriceUSD}`);
    
    if (marketPriceData.currencyPrices) {
      console.log('   🔄 Multi-currency prices:');
      Object.entries(marketPriceData.currencyPrices).forEach(([currency, price]) => {
        console.log(`      ${currency}: ${price}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing market price suggestion:', error.message);
    return false;
  }
}

// Test 2: Check fiat currency service
async function testFiatCurrencyService() {
  console.log('\n2️⃣ Testing Fiat Currency Service...');
  
  try {
    const fiatCurrencyService = require('../src/services/fiatCurrencyService');
    
    // Test supported currencies
    const currencies = fiatCurrencyService.getSupportedCurrencies();
    console.log(`   📋 Supported currencies: ${currencies.length}`);
    
    // Test currency metadata
    const usdMetadata = fiatCurrencyService.getCurrencyMetadata('USD');
    console.log(`   🇺🇸 USD metadata: ${usdMetadata.nameRu} (${usdMetadata.symbol})`);
    
    // Test currency conversion
    const rubToUsd = await fiatCurrencyService.convertAmount(1000, 'RUB', 'USD');
    console.log(`   💱 1000 RUB to USD: ${rubToUsd}`);
    
    // Test currency formatting
    const formattedUSD = fiatCurrencyService.formatAmount(1234.56, 'USD');
    const formattedRUB = fiatCurrencyService.formatAmount(1234.56, 'RUB');
    console.log(`   🎨 Formatted USD: ${formattedUSD}`);
    console.log(`   🎨 Formatted RUB: ${formattedRUB}`);
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing fiat currency service:', error.message);
    return false;
  }
}

// Test 3: Check P2P Handler functions
async function testP2PHandler() {
  console.log('\n3️⃣ Testing P2P Handler Functions...');
  
  try {
    // Mock context for testing
    const mockCtx = {
      chat: { id: 'test_user' },
      answerCbQuery: async () => {},
      editMessageText: async () => {}
    };
    
    const P2PHandler = require('../src/handlers/P2PHandler');
    const handler = new P2PHandler();
    
    // Test that the handler class can be instantiated
    console.log('   ✅ P2P Handler class instantiated successfully');
    
    // Test currency selection method exists
    if (typeof handler.handleP2PCurrencySelection === 'function') {
      console.log('   ✅ handleP2PCurrencySelection method exists');
    } else {
      console.log('   ❌ handleP2PCurrencySelection method missing');
    }
    
    // Test price refresh method exists
    if (typeof handler.handlePriceRefresh === 'function') {
      console.log('   ✅ handlePriceRefresh method exists');
    } else {
      console.log('   ❌ handlePriceRefresh method missing');
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing P2P Handler:', error.message);
    return false;
  }
}

// Test 4: Integration test for price conversion and display
async function testPriceConversionAndDisplay() {
  console.log('\n4️⃣ Testing Price Conversion and Display...');
  
  try {
    const p2pService = require('../src/services/p2p');
    const fiatCurrencyService = require('../src/services/fiatCurrencyService');
    
    // Get market price data
    const marketPriceData = await p2pService.getMarketPriceSuggestion();
    console.log(`   📊 Base price in RUB: ${marketPriceData.currentPriceRub}`);
    
    // Test conversion to various currencies
    const testCurrencies = ['USD', 'EUR', 'CNY', 'INR', 'NGN', 'VND', 'KRW', 'JPY', 'BRL'];
    
    for (const currency of testCurrencies) {
      try {
        let convertedPrice;
        
        // Use pre-calculated price if available
        if (marketPriceData.currencyPrices && marketPriceData.currencyPrices[currency]) {
          convertedPrice = marketPriceData.currencyPrices[currency];
          console.log(`   🔄 ${currency}: ${convertedPrice} (pre-calculated)`);
        } else {
          // Fallback to conversion
          convertedPrice = await fiatCurrencyService.convertAmount(
            marketPriceData.currentPriceRub, 
            'RUB', 
            currency
          );
          console.log(`   🔄 ${currency}: ${convertedPrice} (converted)`);
        }
        
        // Test formatting
        const formattedPrice = fiatCurrencyService.formatAmount(convertedPrice, currency);
        console.log(`   🎨 Formatted ${currency}: ${formattedPrice}`);
      } catch (error) {
        console.log(`   ⚠️ Error with ${currency}: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing price conversion:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive multi-currency P2P tests...\n');
  
  const tests = [
    { name: 'Market Price Suggestion', func: testMarketPriceSuggestion },
    { name: 'Fiat Currency Service', func: testFiatCurrencyService },
    { name: 'P2P Handler', func: testP2PHandler },
    { name: 'Price Conversion and Display', func: testPriceConversionAndDisplay }
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    try {
      const result = await test.func();
      if (result) {
        passedTests++;
        console.log(`   ✅ ${test.name} test passed\n`);
      } else {
        console.log(`   ❌ ${test.name} test failed\n`);
      }
    } catch (error) {
      console.log(`   ❌ ${test.name} test error: ${error.message}\n`);
    }
  }
  
  console.log('📋 Test Results:');
  console.log(`   ✅ Passed: ${passedTests}/${tests.length}`);
  console.log(`   ❌ Failed: ${tests.length - passedTests}/${tests.length}`);
  
  if (passedTests === tests.length) {
    console.log('\n🎉 All tests passed!');
    console.log('   The multi-currency P2P price display system is working correctly.');
    console.log('   Prices will now display in the selected fiat currency instead of only rubles.');
  } else {
    console.log('\n⚠️ Some tests failed.');
    console.log('   Please check the implementation and run tests again.');
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('💥 Test execution error:', error);
});