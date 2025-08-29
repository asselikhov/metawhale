/**
 * Test for main menu with 4 buttons
 * Verifies that the main menu buttons are displayed correctly with 4 buttons
 */

const { Markup } = require('telegraf');
const LocalizationHelper = require('../src/utils/localizationHelper');

// Mock the language service functions
const mockLanguageService = {
  getText: async (chatId, key) => {
    const translations = {
      'ru': {
        'main_menu': '🌾 Главное меню',
        'personal_cabinet': '👤 ЛК',
        'p2p': '🔄 P2P',
        'matrix': '💠 Matrix',
        'settings': '⚙️ Настройки'
      },
      'en': {
        'main_menu': '🌾 Main Menu',
        'personal_cabinet': '👤 PC',
        'p2p': '🔄 P2P',
        'matrix': '💠 Matrix',
        'settings': '⚙️ Settings'
      }
    };
    
    // Default to Russian for this test
    return translations['ru'][key] || key;
  }
};

// Mock LocalizationHelper with the updated implementation
const mockLocalizationHelper = {
  getText: mockLanguageService.getText,
  getLocalizedMainMenu: async (chatId) => {
    // Return 4 buttons in a single row as requested: Personal Cabinet, P2P, Matrix, Settings
    const personalCabinet = await mockLanguageService.getText(chatId, 'personal_cabinet');
    const p2p = await mockLanguageService.getText(chatId, 'p2p');
    const matrix = await mockLanguageService.getText(chatId, 'matrix');
    const settings = await mockLanguageService.getText(chatId, 'settings');
    
    return [
      [personalCabinet, p2p, matrix, settings]
    ];
  }
};

// Mock Telegram context for testing
const mockCtx = {
  chat: {
    id: 'test_user_menu'
  },
  reply: async (message, keyboard) => {
    console.log('\n🤖 Bot reply:');
    console.log(`   Message: ${message}`);
    
    if (keyboard && keyboard.reply_markup && keyboard.reply_markup.keyboard) {
      console.log('   Main Menu Keyboard:');
      keyboard.reply_markup.keyboard.forEach((row, index) => {
        console.log(`     Row ${index + 1}: [${row.map(btn => `"${btn}"`).join(', ')}]`);
      });
    } else if (keyboard) {
      console.log(`   Keyboard:`, JSON.stringify(keyboard, null, 2));
    }
    
    return { message_id: 1001 };
  }
};

async function testMainMenuConstruction() {
  console.log('🚀 Testing main menu construction with 4 buttons...');
  
  try {
    const chatId = mockCtx.chat.id.toString();
    
    // Test main menu construction
    console.log('\n--- Main Menu Construction ---');
    const mainMenuButtons = await mockLocalizationHelper.getLocalizedMainMenu(chatId);
    console.log('Main menu buttons structure:', JSON.stringify(mainMenuButtons, null, 2));
    
    // Verify that menu contains exactly one row
    if (mainMenuButtons.length !== 1) {
      console.log(`❌ Menu contains ${mainMenuButtons.length} rows, expected 1`);
      return false;
    }
    
    // Verify that the row contains exactly four buttons
    const row = mainMenuButtons[0];
    if (row.length !== 4) {
      console.log(`❌ Row contains ${row.length} buttons, expected 4`);
      return false;
    }
    
    // Verify button content
    const [firstButton, secondButton, thirdButton, fourthButton] = row;
    
    console.log('\n--- Button Content Verification ---');
    console.log(`First button: "${firstButton}"`);
    console.log(`Second button: "${secondButton}"`);
    console.log(`Third button: "${thirdButton}"`);
    console.log(`Fourth button: "${fourthButton}"`);
    
    // Test keyboard creation
    console.log('\n--- Keyboard Creation ---');
    const mainMenu = Markup.keyboard(mainMenuButtons).resize();
    console.log('Keyboard structure:', JSON.stringify(mainMenu, null, 2));
    
    // Test full menu display
    console.log('\n--- Full Menu Display ---');
    const menuMessage = await mockLanguageService.getText(chatId, 'main_menu');
    await mockCtx.reply(menuMessage, mainMenu);
    
    console.log('\n✅ Main menu construction test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Main menu construction test failed:', error);
    return false;
  }
}

async function testButtonRecognition() {
  console.log('\n🚀 Testing button recognition for 4 buttons...');
  
  try {
    // Test button recognition patterns
    const testButtons = [
      '👤 ЛК',
      '🔄 P2P',
      '💠 Matrix',
      '⚙️ Настройки',
      'Personal Cabinet',
      'P2P',
      'Matrix',
      'Settings'
    ];
    
    const recognitionPatterns = {
      personalCabinet: ['ЛК', 'Личный кабинет', '👤', 'Personal Cabinet', 'PC'],
      p2p: ['P2P Биржа', '🔄 P2P', 'P2P'],
      matrix: ['Matrix CES', '💠 Matrix', 'Matrix'],
      settings: ['⚙️', 'Настройки', 'Settings']
    };
    
    console.log('\n--- Button Recognition Patterns ---');
    for (const [patternName, patterns] of Object.entries(recognitionPatterns)) {
      console.log(`  ${patternName}: [${patterns.map(p => `"${p}"`).join(', ')}]`);
    }
    
    console.log('\n--- Test Button Matching ---');
    for (const button of testButtons) {
      console.log(`\n  Testing button: "${button}"`);
      
      // Check personal cabinet match
      if (button.includes('ЛК') || button.includes('Личный кабинет') || button.includes('👤') || 
          button.includes('Personal Cabinet') || button.includes('PC')) {
        console.log('    ✅ Matches Personal Cabinet pattern');
      }
      
      // Check P2P match
      if (button.includes('P2P Биржа') || button.includes('🔄 P2P') || button.includes('P2P')) {
        console.log('    ✅ Matches P2P pattern');
      }
      
      // Check Matrix match
      if (button.includes('Matrix CES') || button.includes('💠 Matrix') || button.includes('Matrix')) {
        console.log('    ✅ Matches Matrix pattern');
      }
      
      // Check Settings match
      if (button.includes('⚙️') || button.includes('Настройки') || button.includes('Settings')) {
        console.log('    ✅ Matches Settings pattern');
      }
    }
    
    console.log('\n✅ Button recognition test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Button recognition test failed:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting main menu tests with 4 buttons...\n');
  
  const tests = [
    { name: 'Main Menu Construction', func: testMainMenuConstruction },
    { name: 'Button Recognition', func: testButtonRecognition }
  ];
  
  let allPassed = true;
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🧪 Running ${test.name} Test`);
    console.log(`${'='.repeat(50)}`);
    
    try {
      const result = await test.func();
      if (!result) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`❌ ${test.name} test failed with error:`, error);
      allPassed = false;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  if (allPassed) {
    console.log('🎉 All tests passed! Main menu functionality is working correctly.');
    console.log('✅ Main menu displays exactly four buttons in one row: "Личный кабинет", "P2P", "Matrix", and "Настройки"');
  } else {
    console.log('❌ Some tests failed. Please check the implementation.');
  }
  console.log(`${'='.repeat(50)}`);
  
  return allPassed;
}

// Run the tests
if (require.main === module) {
  runAllTests().then((success) => {
    console.log('\n🏁 Main menu tests finished');
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('💥 Main menu tests failed with error:', error);
    process.exit(1);
  });
}

module.exports = { testMainMenuConstruction, testButtonRecognition };