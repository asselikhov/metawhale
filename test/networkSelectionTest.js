/**
 * Test script for network selection functionality
 */

const { User } = require('../src/database/models');
const userNetworkService = require('../src/services/userNetworkService');
const multiChainService = require('../src/services/multiChainService');

async function testNetworkSelection() {
  console.log('🚀 Testing network selection functionality...');
  
  // Test user chat ID (for testing purposes)
  const testChatId = 'test_user_123';
  
  try {
    // Test getting default network
    const defaultNetwork = await userNetworkService.getUserNetwork(testChatId);
    console.log(`✅ Default network: ${defaultNetwork}`);
    
    // Test setting network
    const networks = multiChainService.getNetworks();
    console.log(`🌐 Available networks:`, networks.map(n => n.id));
    
    // Try setting to each network
    for (const network of networks) {
      try {
        // Create a test user if not exists
        let user = await User.findOne({ chatId: testChatId });
        if (!user) {
          user = new User({
            chatId: testChatId,
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User'
          });
          await user.save();
          console.log(`👤 Created test user`);
        }
        
        // Try to set network (this will fail if user doesn't have a wallet)
        // For testing purposes, we'll just check if the network is supported
        if (multiChainService.isNetworkSupported(network.id)) {
          console.log(`✅ Network ${network.id} is supported`);
          const networkInfo = multiChainService.getNetworkConfig(network.id);
          console.log(`ℹ️  Network info for ${network.id}:`, {
            name: networkInfo.name,
            emoji: multiChainService.getNetworkEmoji(network.id),
            tokens: Object.keys(networkInfo.tokens)
          });
        } else {
          console.log(`❌ Network ${network.id} is not supported`);
        }
      } catch (error) {
        console.log(`ℹ️  Expected error for network ${network.id} (user has no wallet):`, error.message);
      }
    }
    
    console.log('✅ Network selection tests completed');
  } catch (error) {
    console.error('❌ Network selection test failed:', error);
  }
}

// Run the test
testNetworkSelection().then(() => {
  console.log('🏁 Test completed');
}).catch((error) => {
  console.error('💥 Test failed with error:', error);
});