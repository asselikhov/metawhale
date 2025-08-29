/**
 * Test for price display format
 * Verifies that the price display matches the requested format
 */

// Mock price data
const mockPriceData = {
  price: 3.18,
  priceRub: 256.40,
  change24h: -3.58,
  volume24h: 1170000,
  ath: 3.18,
  priceDecimals: 2
};

// Mock token config
const mockTokenConfig = {
  emoji: '💰',
  priceDecimals: 2
};

// Mock price service
const mockPriceService = {
  formatNumber: (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(2);
  }
};

function generatePriceMessage(tokenSymbol, priceData, tokenConfig) {
  // Determine emoji for price change
  const changeEmoji = priceData.change24h >= 0 ? '🔺' : '🔻';
  const changeSign = priceData.change24h >= 0 ? '+' : '';
  
  // Format volume if available
  let volumeDisplay = '';
  if (priceData.volume24h) {
    volumeDisplay = ` • 🅥 $ ${mockPriceService.formatNumber(priceData.volume24h)}`;
  }
  
  // Check if current price is ATH
  let athDisplay = '';
  if (priceData.ath) {
    const isNewATH = priceData.price >= priceData.ath;
    athDisplay = ` • 🅐🅣🅗 ${isNewATH ? '🏆' : ''} $ ${priceData.ath.toFixed(2)}`;
  }
  
  // Generate message
  const message = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
💰 Цена токена ${tokenSymbol}: $ ${priceData.price.toFixed(tokenConfig.priceDecimals)} | ₽ ${priceData.priceRub.toFixed(2)}
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
${changeEmoji} ${changeSign}${priceData.change24h.toFixed(1)}%${volumeDisplay}${athDisplay}`;
  
  return message;
}

function runTest() {
  console.log('🚀 Testing price display format...\n');
  
  // Test with CES token
  console.log('--- CES Token Display ---');
  const cesMessage = generatePriceMessage('CES', mockPriceData, mockTokenConfig);
  console.log(cesMessage);
  
  // Test with POL token
  console.log('\n--- POL Token Display ---');
  const polMessage = generatePriceMessage('POL', mockPriceData, mockTokenConfig);
  console.log(polMessage);
  
  // Verify format matches requirements
  console.log('\n--- Format Verification ---');
  const lines = cesMessage.split('\n');
  
  // Check first line
  if (lines[0] === '➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖') {
    console.log('✅ First line: Correct separator format');
  } else {
    console.log('❌ First line: Incorrect separator format');
  }
  
  // Check price line
  if (lines[1].includes('💰 Цена токена CES: $ 3.18 | ₽ 256.40')) {
    console.log('✅ Price line: Correct format with token name, USD and RUB prices');
  } else {
    console.log('❌ Price line: Incorrect format');
    console.log('   Expected: 💰 Цена токена CES: $ 3.18 | ₽ 256.40');
    console.log('   Actual:   ' + lines[1]);
  }
  
  // Check second separator
  if (lines[2] === '➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖') {
    console.log('✅ Second line: Correct separator format');
  } else {
    console.log('❌ Second line: Incorrect separator format');
  }
  
  // Check statistics line
  if (lines[3].includes('🔻 -3.6%') && lines[3].includes('𝑽 $ 1.2M') && lines[3].includes('🅐🅣🅗 🏆 $ 3.18')) {
    console.log('✅ Statistics line: Correct format with change, volume, and ATH');
  } else {
    console.log('❌ Statistics line: Incorrect format');
    console.log('   Expected to contain: 🔻 -3.6% • 🅥 $ 1.2M • 🅐🅣🅗 🏆 $ 3.18');
    console.log('   Actual:              ' + lines[3]);
  }
  
  console.log('\n✅ Price display format test completed');
}

// Run the test
runTest();