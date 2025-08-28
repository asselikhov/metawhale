/**
 * Test to verify that P2P interface displays full token names in buy/sell buttons
 * This test checks that when a user selects a token for P2P trading,
 * the buy and sell buttons show the full token name instead of just the symbol
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { Markup } = require('telegraf');

// Mock services
const mockUserNetworkService = {
  getUserNetwork: sinon.stub().resolves('polygon'),
  getNetworkInfo: sinon.stub().resolves('🟣 Polygon')
};

const mockMultiChainService = {
  getNetworkEmoji: sinon.stub().returns('🟣'),
  getTokenConfig: sinon.stub().returns({ name: 'CES Token', symbol: 'CES', address: '0x123', decimals: 18 })
};

const mockFiatCurrencyService = {
  getUserCurrency: sinon.stub().resolves('RUB'),
  getCurrencyMetadata: sinon.stub().returns({ flag: '🇷🇺', code: 'RUB', symbol: '₽' })
};

const mockSessionManager = {
  setSessionData: sinon.stub(),
  getSessionData: sinon.stub().returns('CES')
};

// Mock context
const mockCtx = {
  chat: { id: '123456' },
  reply: sinon.stub()
};

describe('P2P Token Name Display Test', function() {
  let P2PHandler;
  let handler;
  
  before(function() {
    // Clear module cache to ensure we get fresh instances
    delete require.cache[require.resolve('../src/handlers/P2PHandler')];
    
    // Set up mocks
    sinon.stub(require('../src/services/userNetworkService'), 'default').value(mockUserNetworkService);
    sinon.stub(require('../src/services/multiChainService'), 'default').value(mockMultiChainService);
    sinon.stub(require('../src/services/fiatCurrencyService'), 'default').value(mockFiatCurrencyService);
    sinon.stub(require('../src/handlers/SessionManager'), 'default').value(mockSessionManager);
    
    P2PHandler = require('../src/handlers/P2PHandler');
    handler = new P2PHandler();
  });
  
  after(function() {
    sinon.restore();
  });
  
  it('should display full token names in buy/sell buttons', async function() {
    // Execute the token selection handler
    await handler.handleP2PTokenSelect(mockCtx, 'CES');
    
    // Verify that reply was called
    expect(mockCtx.reply.calledOnce).to.be.true;
    
    // Get the arguments passed to reply
    const [message, keyboard] = mockCtx.reply.firstCall.args;
    
    // Check that the message contains the P2P exchange header
    expect(message).to.include('🔄 P2P БИРЖА');
    expect(message).to.include('⚪ Монета для торговли: CES');
    
    // Check that the keyboard contains buttons with full token names
    const buttons = keyboard.reply_markup.inline_keyboard;
    
    // First row should contain buy/sell buttons
    const buyButton = buttons[0][0];
    const sellButton = buttons[0][1];
    
    // Verify that buttons show full token names
    expect(buyButton.text).to.include('Купить CES Token'); // Should show full name
    expect(sellButton.text).to.include('Продать CES Token'); // Should show full name
    
    console.log('✅ P2P interface correctly displays full token names in buy/sell buttons');
    console.log(`   Buy button text: "${buyButton.text}"`);
    console.log(`   Sell button text: "${sellButton.text}"`);
  });
  
  it('should fallback to token symbol if name is not available', async function() {
    // Modify mock to return token config without name
    mockMultiChainService.getTokenConfig.returns({ symbol: 'TEST', address: '0x456', decimals: 18 });
    
    // Create new context for this test
    const testCtx = {
      chat: { id: '789012' },
      reply: sinon.stub()
    };
    
    // Execute the token selection handler
    await handler.handleP2PTokenSelect(testCtx, 'TEST');
    
    // Get the arguments passed to reply
    const [, keyboard] = testCtx.reply.firstCall.args;
    const buttons = keyboard.reply_markup.inline_keyboard;
    
    // Verify that buttons fallback to symbol when name is not available
    const buyButton = buttons[0][0];
    const sellButton = buttons[0][1];
    
    expect(buyButton.text).to.include('Купить TEST'); // Should fallback to symbol
    expect(sellButton.text).to.include('Продать TEST'); // Should fallback to symbol
    
    console.log('✅ P2P interface correctly falls back to token symbol when name is not available');
  });
});

// Run the test if this file is executed directly
if (require.main === module) {
  (async function() {
    try {
      console.log('🧪 Testing P2P Token Name Display...\n');
      
      // Run the tests
      const { expect } = await import('chai');
      const sinon = await import('sinon');
      
      // Simple test execution
      console.log('🧪 Executing P2P Token Name Display Test...');
      
      // Mock the required modules
      const mockUserNetworkService = {
        getUserNetwork: sinon.default.stub().resolves('polygon'),
        getNetworkInfo: sinon.default.stub().resolves('🟣 Polygon')
      };
      
      const mockMultiChainService = {
        getNetworkEmoji: sinon.default.stub().returns('🟣'),
        getTokenConfig: sinon.default.stub().returns({ name: 'CES Token', symbol: 'CES', address: '0x123', decimals: 18 })
      };
      
      const mockFiatCurrencyService = {
        getUserCurrency: sinon.default.stub().resolves('RUB'),
        getCurrencyMetadata: sinon.default.stub().returns({ flag: '🇷🇺', code: 'RUB', symbol: '₽' })
      };
      
      const mockSessionManager = {
        setSessionData: sinon.default.stub(),
        getSessionData: sinon.default.stub().returns('CES')
      };
      
      // Mock the module imports
      require.cache[require.resolve('../src/services/userNetworkService')] = {
        exports: mockUserNetworkService
      };
      
      require.cache[require.resolve('../src/services/multiChainService')] = {
        exports: mockMultiChainService
      };
      
      require.cache[require.resolve('../src/services/fiatCurrencyService')] = {
        exports: mockFiatCurrencyService
      };
      
      require.cache[require.resolve('../src/handlers/SessionManager')] = {
        exports: mockSessionManager
      };
      
      // Create test context
      const mockCtx = {
        chat: { id: '123456' },
        reply: sinon.default.stub()
      };
      
      // Import and test
      const P2PHandler = require('../src/handlers/P2PHandler');
      const handler = new P2PHandler();
      
      await handler.handleP2PTokenSelect(mockCtx, 'CES');
      
      // Verify results
      if (mockCtx.reply.calledOnce) {
        const [message, keyboard] = mockCtx.reply.firstCall.args;
        console.log('✅ Reply was called with message and keyboard');
        
        if (message.includes('🔄 P2P БИРЖА') && message.includes('⚪ Монета для торговли: CES')) {
          console.log('✅ Message contains correct P2P exchange header and token info');
        } else {
          console.log('❌ Message does not contain expected content');
          console.log('Message:', message);
        }
        
        const buttons = keyboard.reply_markup.inline_keyboard;
        const buyButton = buttons[0][0];
        const sellButton = buttons[0][1];
        
        if (buyButton.text.includes('Купить CES Token') && sellButton.text.includes('Продать CES Token')) {
          console.log('✅ Buy/Sell buttons correctly display full token names');
          console.log(`   Buy button: "${buyButton.text}"`);
          console.log(`   Sell button: "${sellButton.text}"`);
        } else {
          console.log('❌ Buy/Sell buttons do not display full token names correctly');
          console.log(`   Buy button: "${buyButton.text}"`);
          console.log(`   Sell button: "${sellButton.text}"`);
        }
      } else {
        console.log('❌ Reply was not called');
      }
      
      console.log('\n🎉 P2P Token Name Display Test completed!');
      
    } catch (error) {
      console.error('❌ Test failed with error:', error);
      process.exit(1);
    }
  })();
}