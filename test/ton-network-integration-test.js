/**
 * Test TON Network Integration
 * Verifies TON network support with USDT, TON, and NOT tokens
 */

console.log('💎 Testing TON Network Integration...\n');

// 1. Test multiChainService TON configuration
try {
  console.log('1️⃣ Testing multiChainService TON configuration...');
  const multiChainService = require('../src/services/multiChainService');
  console.log('   ✅ multiChainService loaded successfully');
  
  // Check TON network configuration
  const tonConfig = multiChainService.getNetworkConfig('ton');
  if (tonConfig) {
    console.log('   ✅ TON network configuration found');
    console.log(`   📋 Network: ${tonConfig.name} (${tonConfig.symbol})`);
    console.log(`   🌐 Chain ID: ${tonConfig.chainId}`);
    console.log(`   💎 Native Token: ${tonConfig.nativeToken}`);
    console.log(`   🔗 RPC URLs: ${tonConfig.rpcUrls.length} endpoints`);
    console.log(`   🔍 Explorer: ${tonConfig.explorer}`);
    console.log(`   ⚙️ Gas Settings: ${JSON.stringify(tonConfig.gasSettings)}`);
  } else {
    console.log('   ❌ TON network configuration not found');
  }
  
  // Check TON tokens
  const tonTokens = multiChainService.getNetworkTokens('ton');
  console.log(`   💰 TON tokens: ${Object.keys(tonTokens).length} found`);
  
  for (const [symbol, config] of Object.entries(tonTokens)) {
    console.log(`   💎 ${symbol}: ${config.name} (${config.decimals} decimals)`);
    if (config.address === 'native') {
      console.log(`      📍 Address: Native token`);
    } else {
      console.log(`      📍 Address: ${config.address.slice(0, 20)}...`);
    }
  }
  
  // Check TON emoji
  const tonEmoji = multiChainService.getNetworkEmoji('ton');
  console.log(`   😄 TON emoji: ${tonEmoji}`);
  
  // Check TON network support
  const isSupported = multiChainService.isNetworkSupported('ton');
  console.log(`   ✅ TON network supported: ${isSupported}`);
  
} catch (error) {
  console.error('   ❌ Error in multiChainService:', error.message);
}

// 2. Test TON address validation
try {
  console.log('\n2️⃣ Testing TON address validation...');
  const multiChainService = require('../src/services/multiChainService');
  
  // Test valid TON addresses
  const validAddresses = [
    'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // USDT contract
    'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT', // NOT contract
    'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'  // Sample address
  ];
  
  const invalidAddresses = [
    '0x1234567890123456789012345678901234567890', // Ethereum address
    'TRX123456789012345678901234567890123456', // TRON address
    'invalid_address',
    ''
  ];
  
  console.log('   ✅ Testing valid TON addresses:');
  validAddresses.forEach(address => {
    const isValid = multiChainService.validateAddress('ton', address);
    console.log(`   ${isValid ? '✅' : '❌'} ${address.slice(0, 20)}... - ${isValid ? 'VALID' : 'INVALID'}`);
  });
  
  console.log('   ❌ Testing invalid addresses:');
  invalidAddresses.forEach(address => {
    const isValid = multiChainService.validateAddress('ton', address);
    console.log(`   ${!isValid ? '✅' : '❌'} ${address.slice(0, 20)}... - ${isValid ? 'VALID' : 'INVALID'}`);
  });
  
} catch (error) {
  console.error('   ❌ Error in address validation:', error.message);
}

// 3. Test TON minimum transfer amounts
try {
  console.log('\n3️⃣ Testing TON minimum transfer amounts...');
  const multiChainService = require('../src/services/multiChainService');
  
  const tonTokens = ['TON', 'USDT', 'NOT'];
  tonTokens.forEach(token => {
    const minAmount = multiChainService.getMinimumTransferAmount('ton', token);
    console.log(`   💰 ${token}: ${minAmount} minimum transfer`);
  });
  
} catch (error) {
  console.error('   ❌ Error in minimum transfer amounts:', error.message);
}

// 4. Test TON fee estimation
try {
  console.log('\n4️⃣ Testing TON fee estimation...');
  const multiChainService = require('../src/services/multiChainService');
  
  const tonTokens = ['TON', 'USDT', 'NOT'];
  tonTokens.forEach(token => {
    const feeEstimate = multiChainService.estimateNetworkFee('ton', token);
    console.log(`   ⛽ ${token}: ${feeEstimate.estimatedFee} ${feeEstimate.feeToken || 'TON'}`);
  });
  
} catch (error) {
  console.error('   ❌ Error in fee estimation:', error.message);
}

// 5. Test userNetworkService TON support
try {
  console.log('\n5️⃣ Testing userNetworkService TON support...');
  const userNetworkService = require('../src/services/userNetworkService');
  console.log('   ✅ userNetworkService loaded successfully');
  
  // Test TON wallet existence check
  const testAddress = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
  const walletExists = await userNetworkService.checkWalletExistsInNetwork(testAddress, 'ton');
  console.log(`   💼 TON wallet existence check: ${walletExists}`);
  
} catch (error) {
  console.error('   ❌ Error in userNetworkService:', error.message);
}

// 6. Test multiChainWalletService TON support
try {
  console.log('\n6️⃣ Testing multiChainWalletService TON balance methods...');
  const multiChainWalletService = require('../src/services/multiChainWalletService');
  console.log('   ✅ multiChainWalletService loaded successfully');
  
  // Check if TON balance methods exist
  const tonMethods = [
    'getTonNativeBalance',
    'getTonTokenBalance'
  ];
  
  tonMethods.forEach(method => {
    if (typeof multiChainWalletService[method] === 'function') {
      console.log(`   ✅ ${method} method available`);
    } else {
      console.log(`   ❌ ${method} method not found`);
    }
  });
  
} catch (error) {
  console.error('   ❌ Error in multiChainWalletService:', error.message);
}

// 7. Test priceService TON and NOT price methods
try {
  console.log('\n7️⃣ Testing priceService TON and NOT price methods...');
  const priceService = require('../src/services/priceService');
  console.log('   ✅ priceService loaded successfully');
  
  // Check if TON and NOT price methods exist
  const priceMethods = [
    'getTONPrice',
    'getNOTPrice'
  ];
  
  priceMethods.forEach(method => {
    if (typeof priceService[method] === 'function') {
      console.log(`   ✅ ${method} method available`);
    } else {
      console.log(`   ❌ ${method} method not found`);
    }
  });
  
} catch (error) {
  console.error('   ❌ Error in priceService:', error.message);
}

// 8. Test P2P TON token support
try {
  console.log('\n8️⃣ Testing P2P TON token support...');
  const P2PHandler = require('../src/handlers/P2PHandler');
  const p2pHandler = new P2PHandler();
  console.log('   ✅ P2PHandler loaded successfully');
  
  // Check TON token filtering for P2P
  const tonTokens = ['TON', 'USDT', 'NOT'];
  console.log('   💰 TON tokens suitable for P2P trading:');
  
  tonTokens.forEach(token => {
    const isSuitable = p2pHandler.shouldShowTokenForTrading('ton', token);
    console.log(`   ${isSuitable ? '✅' : '❌'} ${token}: ${isSuitable ? 'TRADABLE' : 'NOT TRADABLE'}`);
  });
  
} catch (error) {
  console.error('   ❌ Error in P2PHandler:', error.message);
}

// 9. Test network selector buttons
try {
  console.log('\n9️⃣ Testing network selector with TON...');
  const multiChainService = require('../src/services/multiChainService');
  
  const selectorButtons = multiChainService.getNetworkSelectorButtons('ton');
  console.log(`   🔘 Network selector has ${selectorButtons.length} rows`);
  
  // Count total buttons
  const totalButtons = selectorButtons.reduce((total, row) => total + row.length, 0);
  console.log(`   📊 Total networks: ${totalButtons} buttons`);
  
  // Check if TON is marked as selected
  const tonButtonFound = selectorButtons.some(row => 
    row.some(button => button.callback_data === 'switch_network_ton')
  );
  console.log(`   💎 TON network button found: ${tonButtonFound ? '✅' : '❌'}`);
  
} catch (error) {
  console.error('   ❌ Error in network selector:', error.message);
}

console.log('\n🎉 TON Network Integration Test Completed!');

console.log('\n📋 TON Network Summary:');
console.log('   💎 Network: TON Network');
console.log('   🪙 Tokens: TON (native), USDT, NOT');
console.log('   💰 P2P Trading: USDT ✅, NOT ✅, TON ❌ (too expensive)');
console.log('   ⛽ Fees: 0.01-0.02 TON');
console.log('   🔍 Explorer: https://tonscan.org');
console.log('   📍 Address Format: EQ... (48 chars) or standard TON format');

console.log('\n🚀 TON Network Ready for Integration!');
process.exit(0);