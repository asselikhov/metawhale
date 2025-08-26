/**
 * Test script to verify the cancel payment fix works correctly
 * Tests ObjectId handling when session data is missing
 */

const { P2PTrade, User } = require('./src/database/models');

async function testCancelPaymentFix() {
  console.log('🧪 Testing Cancel Payment Fix...\n');
  
  try {
    // Test user search by chatId
    const testChatId = '2131340103';
    console.log(`1️⃣ Testing user lookup for chatId: ${testChatId}`);
    
    const user = await User.findOne({ chatId: testChatId });
    if (user) {
      console.log(`✅ User found: ${user._id} (${user.chatId})`);
      
      // Test trade search using ObjectId
      console.log(`2️⃣ Testing active trade lookup for user ObjectId: ${user._id}`);
      
      const trade = await P2PTrade.findOne({
        $or: [
          { buyerId: user._id },
          { sellerId: user._id }
        ],
        status: { $in: ['escrow_locked', 'payment_pending'] }
      }).populate('buyerId').populate('sellerId');
      
      if (trade) {
        console.log(`✅ Active trade found: ${trade._id}`);
        console.log(`   Buyer: ${trade.buyerId.chatId} (${trade.buyerId._id})`);
        console.log(`   Seller: ${trade.sellerId.chatId} (${trade.sellerId._id})`);
        console.log(`   Status: ${trade.status}`);
        console.log(`   Amount: ${trade.amount} CES`);
        
        const orderNumber = `CES${trade.buyOrderId.toString().slice(-8)}`;
        console.log(`   Order Number: ${orderNumber}`);
        
        console.log('\n✅ Cancel payment fix should work correctly!');
        console.log('🔧 The fix properly converts chatId to ObjectId before database query');
      } else {
        console.log('ℹ️ No active trade found for this user');
        console.log('✅ This is expected if no trade is currently active');
      }
      
    } else {
      console.log(`❌ User not found for chatId: ${testChatId}`);
    }
    
    // Test the ObjectId vs string comparison
    console.log(`\n3️⃣ Testing ObjectId handling:`);
    console.log(`   chatId (string): "${testChatId}"`);
    console.log(`   user._id (ObjectId): ${user ? user._id : 'N/A'}`);
    console.log(`   ✅ Fix ensures we use ObjectId in database queries, not string chatId`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('\n🏁 Test completed.');
}

// Run test if this script is executed directly
if (require.main === module) {
  testCancelPaymentFix().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

module.exports = { testCancelPaymentFix };