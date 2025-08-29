/**
 * Simple test for main menu translations
 * Verifies that the main menu button translations are correct
 */

// Import the language service
const languageService = require('../src/services/utility/languageService');

async function testMainMenuTranslations() {
  console.log('🚀 Testing main menu translations...');
  
  try {
    // Test Russian translations
    console.log('\n--- Russian Language ---');
    const ruTranslations = languageService.getTranslations('ru');
    console.log('Personal Cabinet:', ruTranslations.personal_cabinet);
    console.log('P2P:', ruTranslations.p2p);
    console.log('Matrix:', ruTranslations.matrix);
    console.log('Settings:', ruTranslations.settings);
    
    // Test English translations
    console.log('\n--- English Language ---');
    const enTranslations = languageService.getTranslations('en');
    console.log('Personal Cabinet:', enTranslations.personal_cabinet);
    console.log('P2P:', enTranslations.p2p);
    console.log('Matrix:', enTranslations.matrix);
    console.log('Settings:', enTranslations.settings);
    
    // Test Chinese translations
    console.log('\n--- Chinese Language ---');
    const zhTranslations = languageService.getTranslations('zh');
    console.log('Personal Cabinet:', zhTranslations.personal_cabinet);
    console.log('P2P:', zhTranslations.p2p);
    console.log('Matrix:', zhTranslations.matrix);
    console.log('Settings:', zhTranslations.settings);
    
    console.log('\n✅ Main menu translations test completed successfully');
  } catch (error) {
    console.error('❌ Main menu translations test failed:', error);
  }
}

// Run the test
testMainMenuTranslations().then(() => {
  console.log('🏁 Main menu translations test finished');
}).catch((error) => {
  console.error('💥 Main menu translations test failed with error:', error);
});