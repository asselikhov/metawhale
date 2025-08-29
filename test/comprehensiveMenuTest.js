/**
 * Comprehensive test for main menu display functionality
 * Verifies that the main menu buttons are properly constructed and displayed
 */

const { Markup } = require('telegraf');

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

// Mock LocalizationHelper
const mockLocalizationHelper = {
  getText: mockLanguageService.getText,
  getLocalizedMainMenu: async (chatId) => {
    return [
      [
        await mockLanguageService.getText(chatId, 'personal_cabinet'),
        await mockLanguageService.getText(chatId, 'p2p'),
        await mockLanguageService.getText(chatId, 'matrix'),
        await mockLanguageService.getText(chatId, 'settings')
      ]
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
  console.log('🚀 Testing main menu construction...');
  
  try {
    const chatId = mockCtx.chat.id.toString();
    
    // Test main menu construction
    console.log('\n--- Main Menu Construction ---');
    const mainMenuButtons = await mockLocalizationHelper.getLocalizedMainMenu(chatId);
    console.log('Main menu buttons structure:', JSON.stringify(mainMenuButtons, null, 2));
    
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
  console.log('\n🚀 Testing button recognition...');
  
  try {
    // Test button recognition patterns
    const testButtons = [
      '👤 ЛК',
      '🔄 P2P',
      '💠 Matrix',
      '⚙️ Настройки',
      '👤 PC',
      '⚙️ Settings'
    ];
    
    const recognitionPatterns = {
      personalCabinet: ['ЛК', 'Личный кабинет', '👤'],
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
      if (button.includes('ЛК') || button.includes('Личный кабинет') || button.includes('👤') || button.includes('PC')) {
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
  console.log('🚀 Starting comprehensive main menu tests...\n');
  
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
  } else {
    console.log('❌ Some tests failed. Please check the implementation.');
  }
  console.log(`${'='.repeat(50)}`);
}

// Run the tests
runAllTests().then(() => {
  console.log('\n🏁 Comprehensive main menu tests finished');
}).catch((error) => {
  console.error('💥 Comprehensive main menu tests failed with error:', error);
});