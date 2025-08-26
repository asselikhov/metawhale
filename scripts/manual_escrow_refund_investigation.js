/**
 * Script to investigate manual escrow refund options
 */

const { connectDatabase } = require('../src/database/models');
const { User } = require('../src/database/models');
const smartContractService = require('../src/services/smartContractService');
const walletService = require('../src/services/walletService');

async function investigateManualRefundOptions(userChatId) {
  console.log(`🔍 Investigating manual refund options for user: ${userChatId}`);
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Get user
    const user = await User.findOne({ chatId: userChatId });
    if (!user) {
      throw new Error(`User with chatId ${userChatId} not found`);
    }
    
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`   Wallet address: ${user.walletAddress}`);
    
    // Check each stuck escrow
    const stuckEscrows = [
      { id: '13', createdAt: 'Tue Aug 26 2025 22:04:27' },
      { id: '12', createdAt: 'Tue Aug 26 2025 21:52:58' },
      { id: '11', createdAt: 'Tue Aug 26 2025 20:35:24' },
      { id: '10', createdAt: 'Tue Aug 26 2025 19:44:19' }
    ];
    
    console.log(`\n📋 Investigating ${stuckEscrows.length} stuck escrows:`);
    
    for (const escrow of stuckEscrows) {
      console.log(`\n--- Escrow ID ${escrow.id} ---`);
      console.log(`   Created: ${escrow.createdAt}`);
      
      try {
        // Check escrow details
        console.log(`   🔍 Checking escrow details...`);
        const details = await smartContractService.getEscrowDetails(escrow.id);
        console.log(`      Status: ${smartContractService.getEscrowStatusText(details.status)} (${details.status})`);
        console.log(`      Amount: ${details.amount} CES`);
        console.log(`      Seller: ${details.seller}`);
        console.log(`      Buyer: ${details.buyer}`);
        console.log(`      Timelock: ${details.timelock} seconds`);
        
        // Check if refund is possible
        console.log(`   🔍 Checking refund possibility...`);
        const refundCheck = await smartContractService.canRefundEscrow(escrow.id);
        console.log(`      Can refund: ${refundCheck.canRefund}`);
        console.log(`      Status text: ${refundCheck.statusText}`);
        
        if (!refundCheck.canRefund) {
          console.log(`      ⚠️  Cannot refund - ${refundCheck.statusText}`);
          
          // Check if there's more details about why it can't be refunded
          if (refundCheck.error) {
            console.log(`      Error: ${refundCheck.error}`);
          }
        } else {
          console.log(`      ✅ Refund should be possible`);
        }
        
      } catch (error) {
        console.log(`      ❌ Error checking escrow: ${error.message}`);
      }
    }
    
    console.log(`\n📝 Summary:`);
    console.log(`   User has 4 escrows with 1 CES each stuck in smart contract`);
    console.log(`   Blockchain refund transactions have been failing`);
    console.log(`   Options:`);
    console.log(`     1. Try different refund parameters (gas, etc.)`);
    console.log(`     2. Manual intervention by smart contract owner`);
    console.log(`     3. User compensation with equivalent tokens`);
    
    return {
      user,
      stuckEscrows
    };
    
  } catch (error) {
    console.error('❌ Error investigating manual refund options:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🔍 Manual Escrow Refund Investigation');
  console.log('====================================');
  
  try {
    const result = await investigateManualRefundOptions('942851377');
    console.log('\n✅ Investigation completed successfully');
    return result;
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
    throw error;
  }
}

// Run the script if executed directly
if (require.main === module) {
  main().then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Script failed with error:', error);
    process.exit(1);
  });
}

module.exports = { investigateManualRefundOptions };