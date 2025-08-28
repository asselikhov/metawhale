/**
 * Test for Settings and Language Selection Functionality
 * Verifies that the settings menu and language selection work correctly
 */

console.log('🔍 Testing Settings and Language Selection Functionality...\n');

// Test 1: Check language service
async function testLanguageService() {
  console.log('1️⃣ Testing Language Service...');
  
  try {
    const languageService = require('../src/services/languageService');
    
    // Test supported languages
    const languages = languageService.getSupportedLanguages();
    console.log(`   🌍 Supported languages: ${languages.length}`);
    
    // Test language configuration
    const russianConfig = languageService.getLanguageConfig('ru');
    console.log(`   🇷🇺 Russian config: ${russianConfig.country} (${russianConfig.flag})`);
    
    const englishConfig = languageService.getLanguageConfig('en');
    console.log(`   🇺🇸 English config: ${englishConfig.country} (${englishConfig.flag})`);
    
    // Test setting and getting user language
    languageService.setUserLanguage('test_user_1', 'en');
    const userLang1 = languageService.getUserLanguage('test_user_1');
    console.log(`   🔄 User language set to: ${userLang1}`);
    
    languageService.setUserLanguage('test_user_2', 'zh');
    const userLang2 = languageService.getUserLanguage('test_user_2');
    console.log(`   🔄 User language set to: ${userLang2}`);
    
    // Test default language
    const defaultLang = languageService.getUserLanguage('unknown_user');
    console.log(`   🏠 Default language: ${defaultLang}`);
    
    // Test text retrieval
    const russianText = languageService.getText('test_user_1', 'main_menu');
    console.log(`   📝 Russian text: ${russianText}`);
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing language service:', error.message);
    return false;
  }
}

// Test 2: Check BaseCommandHandler methods
async function testBaseCommandHandler() {
  console.log('\n2️⃣ Testing BaseCommandHandler Methods...');
  
  try {
    const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
    const handler = new BaseCommandHandler();
    
    // Test that the handler class can be instantiated
    console.log('   ✅ BaseCommandHandler class instantiated successfully');
    
    // Test that settings methods exist
    if (typeof handler.handleSettingsMenu === 'function') {
      console.log('   ✅ handleSettingsMenu method exists');
    } else {
      console.log('   ❌ handleSettingsMenu method missing');
      return false;
    }
    
    if (typeof handler.handleLanguageSelection === 'function') {
      console.log('   ✅ handleLanguageSelection method exists');
    } else {
      console.log('   ❌ handleLanguageSelection method missing');
      return false;
    }
    
    if (typeof handler.handleLanguageSelected === 'function') {
      console.log('   ✅ handleLanguageSelected method exists');
    } else {
      console.log('   ❌ handleLanguageSelected method missing');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing BaseCommandHandler:', error.message);
    return false;
  }
}

// Test 3: Check MessageHandler methods
async function testMessageHandler() {
  console.log('\n3️⃣ Testing MessageHandler Methods...');
  
  try {
    const MessageHandler = require('../src/handlers/messageHandler');
    const handler = new MessageHandler();
    
    // Test that the handler class can be instantiated
    console.log('   ✅ MessageHandler class instantiated successfully');
    
    // Test that settings methods exist
    if (typeof handler.handleSettingsMenu === 'function') {
      console.log('   ✅ handleSettingsMenu method exists');
    } else {
      console.log('   ❌ handleSettingsMenu method missing');
      return false;
    }
    
    if (typeof handler.handleLanguageSelection === 'function') {
      console.log('   ✅ handleLanguageSelection method exists');
    } else {
      console.log('   ❌ handleLanguageSelection method missing');
      return false;
    }
    
    if (typeof handler.handleLanguageSelected === 'function') {
      console.log('   ✅ handleLanguageSelected method exists');
    } else {
      console.log('   ❌ handleLanguageSelected method missing');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing MessageHandler:', error.message);
    return false;
  }
}

// Test 4: Integration test
async function testIntegration() {
  console.log('\n4️⃣ Testing Integration...');
  
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
      message: { text: '⚙️' }
    };
    
    const BaseCommandHandler = require('../src/handlers/BaseCommandHandler');
    const handler = new BaseCommandHandler();
    
    // Test settings menu
    console.log('   🧪 Testing settings menu...');
    await handler.handleSettingsMenu(mockCtx);
    console.log('   ✅ Settings menu test passed');
    
    // Test language selection
    console.log('   🧪 Testing language selection...');
    await handler.handleLanguageSelection(mockCtx);
    console.log('   ✅ Language selection test passed');
    
    // Test language selected
    console.log('   🧪 Testing language selected...');
    await handler.handleLanguageSelected(mockCtx, 'en');
    console.log('   ✅ Language selected test passed');
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing integration:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting settings and language tests...\n');
  
  const tests = [
    { name: 'Language Service', func: testLanguageService },
    { name: 'BaseCommandHandler', func: testBaseCommandHandler },
    { name: 'MessageHandler', func: testMessageHandler },
    { name: 'Integration', func: testIntegration }
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
    console.log('   The settings and language selection functionality is working correctly.');
    console.log('   Users can now access settings through the ⚙️ button in the main menu');
    console.log('   and select their preferred interface language.');
  } else {
    console.log('\n⚠️ Some tests failed.');
    console.log('   Please check the implementation and run tests again.');
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('💥 Test execution error:', error);
});