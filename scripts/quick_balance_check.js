/**
 * Simple Balance Checker
 * Quick check if user balance has increased to ~2.0 CES
 */

const walletService = require('../src/services/walletService');

const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';

async function quickBalanceCheck() {
  try {
    console.log('🔍 Checking current balance...');
    
    const balance = await walletService.getCESBalance(TARGET_WALLET);
    console.log(`💰 Current balance: ${balance} CES`);
    
    if (balance >= 2.0) {
      console.log('✅ SUCCESS: Refund completed! Balance is now ~2.0 CES');
    } else if (balance > 0.9) {
      console.log('🔄 PARTIAL: Balance increased but not to expected 2.0 CES');
    } else {
      console.log('⏳ PENDING: Balance still 0.9 CES - transaction may be processing');
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
  }
}

// Run the check
if (require.main === module) {
  quickBalanceCheck()
    .then(() => {
      console.log('\n🎉 Balance check completed');
    })
    .catch((error) => {
      console.error('\n💥 Balance check failed:', error);
    });
}

module.exports = { quickBalanceCheck };