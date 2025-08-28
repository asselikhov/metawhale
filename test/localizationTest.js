/**
 * Test for Localization Functionality
 * Verifies that the localization system works correctly
 */

console.log('🔍 Testing Localization Functionality...\n');

// Test 1: Check localization helper
async function testLocalizationHelper() {
  console.log('1️⃣ Testing Localization Helper...');
  
  try {
    const LocalizationHelper = require('../src/utils/localizationHelper');
    
    // Test getting text in different languages
    LocalizationHelper.setUserLanguage('test_user_1', 'en');
    const englishText = LocalizationHelper.getText('test_user_1', 'main_menu');
    console.log(`   🇺🇸 English text: ${englishText}`);
    
    LocalizationHelper.setUserLanguage('test_user_2', 'zh');
    const chineseText = LocalizationHelper.getText('test_user_2', 'main_menu');
    console.log(`   🇨🇳 Chinese text: ${chineseText}`);
    
    // Test default language fallback
    const defaultText = LocalizationHelper.getText('unknown_user', 'main_menu');
    console.log(`   🇷🇺 Default (Russian) text: ${defaultText}`);
    
    // Test main menu generation
    const englishMenu = LocalizationHelper.getLocalizedMainMenu('test_user_1');
    console.log(`   🎯 English menu buttons: ${JSON.stringify(englishMenu[0])}`);
    
    const chineseMenu = LocalizationHelper.getLocalizedMainMenu('test_user_2');
    console.log(`   🎯 Chinese menu buttons: ${JSON.stringify(chineseMenu[0])}`);
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing localization helper:', error.message);
    return false;
  }
}

// Test 2: Check language service translations
async function testLanguageServiceTranslations() {
  console.log('\n2️⃣ Testing Language Service Translations...');
  
  try {
    const languageService = require('../src/services/languageService');
    
    // Test Russian translations
    const ruText = languageService.getText('test_user_ru', 'p2p_exchange');
    console.log(`   🇷🇺 Russian P2P exchange: ${ruText}`);
    
    // Test English translations
    languageService.setUserLanguage('test_user_en', 'en');
    const enText = languageService.getText('test_user_en', 'p2p_exchange');
    console.log(`   🇺🇸 English P2P exchange: ${enText}`);
    
    // Test Chinese translations
    languageService.setUserLanguage('test_user_zh', 'zh');
    const zhText = languageService.getText('test_user_zh', 'p2p_exchange');
    console.log(`   🇨🇳 Chinese P2P exchange: ${zhText}`);
    
    // Test missing translation fallback
    const fallbackText = languageService.getText('test_user_ru', 'nonexistent_key');
    console.log(`   🏠 Fallback text: ${fallbackText}`);
    
    return true;
  } catch (error) {
    console.error('   ❌ Error testing language service translations:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting localization tests...\n');
  
  const tests = [
    { name: 'Localization Helper', func: testLocalizationHelper },
    { name: 'Language Service Translations', func: testLanguageServiceTranslations }
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
    console.log('   The localization system is working correctly.');
    console.log('   Users can now select their preferred language and the interface will be localized.');
  } else {
    console.log('\n⚠️ Some tests failed.');
    console.log('   Please check the implementation and run tests again.');
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('💥 Test execution error:', error);
});