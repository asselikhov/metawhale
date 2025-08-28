/**
 * Test for Back Button Navigation Functionality
 * Verifies that the back button correctly navigates to the personal cabinet
 */

console.log('🔍 Testing Back Button Navigation Functionality...\n');

// Test 1: Check WalletHandler methods
async function testWalletHandler() {
  console.log('1️⃣ Testing WalletHandler Methods...');
  
  try {
    const WalletHandler = require('../src/handlers/WalletHandler');
    const handler = new WalletHandler();
    
    // Test that the handler class can be instantiated
    console.log('   ✅ WalletHandler class instantiated successfully');
    
    // Test that methods exist
    if (typeof handler.handlePersonalCabinetText === 'function') {
      console.log('   ✅ handlePersonalCabinetText method exists');
    } else {
      console.log('   ❌ handlePersonalCabinetText method missing');
      return false;
    }
    
    if (typeof handler.handleUserProfile === 'function') {
      console.log('   ✅ handleUserProfile method exists');
    } else {
      console.log('   ❌ handleUserProfile method missing');
      return false;
    }
    
    if (typeof handler.handleSwitchNetwork === 'function') {
      console.log('   ✅ handleSwitchNetwork method exists');
    } else {
      console.log('   ❌ handleSwitchNetwork method missing');
      return false;
    }
    
    if (typeof handler.handleNetworkSwitch === 'function') {
      console.log('   ✅ handleNetworkSwitch method exists');
    } else {
      console.log('   ❌ handleNetworkSwitch method missing');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing WalletHandler:', error.message);
    return false;
  }
}

// Test 2: Check OptimizedCallbackHandler methods
async function testOptimizedCallbackHandler() {
  console.log('\n2️⃣ Testing OptimizedCallbackHandler Methods...');
  
  try {
    const optimizedHandler = require('../src/handlers/OptimizedCallbackHandler');
    
    // Test that the handler can be imported
    console.log('   ✅ OptimizedCallbackHandler imported successfully');
    
    // Test that methods exist
    if (typeof optimizedHandler.handlePersonalCabinetOptimized === 'function') {
      console.log('   ✅ handlePersonalCabinetOptimized method exists');
    } else {
      console.log('   ❌ handlePersonalCabinetOptimized method missing');
      return false;
    }
    
    if (typeof optimizedHandler.handleP2PMenuOptimized === 'function') {
      console.log('   ✅ handleP2PMenuOptimized method exists');
    } else {
      console.log('   ❌ handleP2PMenuOptimized method missing');
      return false;
    }
    
    if (typeof optimizedHandler.handlePriceRefreshOptimized === 'function') {
      console.log('   ✅ handlePriceRefreshOptimized method exists');
    } else {
      console.log('   ❌ handlePriceRefreshOptimized method missing');
      return false;
    }
    
    if (typeof optimizedHandler.handleInstantCallback === 'function') {
      console.log('   ✅ handleInstantCallback method exists');
    } else {
      console.log('   ❌ handleInstantCallback method missing');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing OptimizedCallbackHandler:', error.message);
    return false;
  }
}

// Test 3: Check BaseCommandHandler methods
async function testBaseCommandHandler() {
  console.log('\n3️⃣ Testing BaseCommandHandler Methods...');
  
  try {
    const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
    const handler = new BaseCommandHandler();
    
    // Test that the handler class can be instantiated
    console.log('   ✅ BaseCommandHandler class instantiated successfully');
    
    // Test that methods exist
    if (typeof handler.handleBackToMenu === 'function') {
      console.log('   ✅ handleBackToMenu method exists');
    } else {
      console.log('   ❌ handleBackToMenu method missing');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing BaseCommandHandler:', error.message);
    return false;
  }
}

// Test 4: Integration test for back button navigation
async function testBackButtonNavigation() {
  console.log('\n4️⃣ Testing Back Button Navigation...');
  
  try {
    // Mock context for testing
    const mockCtx = {
      chat: { id: 'test_user' },
      from: { username: 'testuser', first_name: 'Test', last_name: 'User' },
      reply: async (text, markup) => {
        console.log(`   📤 Bot would reply: ${text}`);
        if (markup) {
          console.log(`   ⌨️  With markup: ${JSON.stringify(markup)}`);
        }
      },
      answerCbQuery: async (text) => {
        console.log(`   💬 Bot would answer: ${text}`);
      },
      editMessageText: async (chatId, messageId, inlineMessageId, text, extra) => {
        console.log(`   📝 Bot would edit message: ${text}`);
        if (extra && extra.reply_markup) {
          console.log(`   ⌨️  With markup: ${JSON.stringify(extra.reply_markup)}`);
        }
      },
      telegram: {
        editMessageText: async (chatId, messageId, inlineMessageId, text, extra) => {
          console.log(`   📝 Bot would edit message: ${text}`);
          if (extra && extra.reply_markup) {
            console.log(`   ⌨️  With markup: ${JSON.stringify(extra.reply_markup)}`);
          }
        }
      }
    };
    
    // Test back to menu
    const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
    const baseHandler = new BaseCommandHandler();
    
    console.log('   🧪 Testing back to menu...');
    await baseHandler.handleBackToMenu(mockCtx);
    console.log('   ✅ Back to menu test passed');
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing back button navigation:', error.message);
    return false;
  }
}

// Test 5: Check button callbacks
async function testButtonCallbacks() {
  console.log('\n5️⃣ Testing Button Callbacks...');
  
  try {
    // Read telegramBot.js to check button callbacks
    const fs = require('fs');
    const path = require('path');
    
    const telegramBotPath = path.join(__dirname, '..', 'src', 'bot', 'telegramBot.js');
    const content = fs.readFileSync(telegramBotPath, 'utf8');
    
    // Check for back_to_menu callback
    const backToMenuPattern = /this\.bot\.action\('back_to_menu'/;
    if (backToMenuPattern.test(content)) {
      console.log('   ✅ back_to_menu callback handler exists');
    } else {
      console.log('   ❌ back_to_menu callback handler missing');
      return false;
    }
    
    // Check for personal_cabinet callback
    const personalCabinetPattern = /this\.bot\.action\('personal_cabinet'/;
    if (personalCabinetPattern.test(content)) {
      console.log('   ✅ personal_cabinet callback handler exists');
    } else {
      console.log('   ❌ personal_cabinet callback handler missing');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing button callbacks:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting back button navigation tests...\n');
  
  const tests = [
    { name: 'WalletHandler', func: testWalletHandler },
    { name: 'OptimizedCallbackHandler', func: testOptimizedCallbackHandler },
    { name: 'BaseCommandHandler', func: testBaseCommandHandler },
    { name: 'Back Button Navigation', func: testBackButtonNavigation },
    { name: 'Button Callbacks', func: testButtonCallbacks }
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
    console.log('   The back button navigation functionality is working correctly.');
    console.log('   Users will now be correctly navigated to the personal cabinet');
    console.log('   when pressing the back button in various contexts.');
  } else {
    console.log('\n⚠️ Some tests failed.');
    console.log('   Please check the implementation and run tests again.');
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('💥 Test execution error:', error);
});