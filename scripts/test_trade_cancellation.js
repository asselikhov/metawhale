/**
 * Test Trade Cancellation
 * Verifies that the fixes for trade cancellation are working properly
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/database/models');

async function testTradeCancellation() {
  try {
    console.log('🧪 TESTING TRADE CANCELLATION FIXES');
    console.log('===================================');
    
    await connectDatabase();
    
    const { EscrowTransaction, P2PTrade, User } = require('../src/database/models');
    
    // 1. Check enum validation fix
    console.log('\n✅ 1. CHECKING ENUM VALIDATION FIX:');
    
    try {
      // Test creating a manual intervention record
      const testUser = await User.findOne({ chatId: '942851377' });
      if (!testUser) {
        console.log('   ⚠️ Test user not found, skipping enum validation test');
      } else {
        const testRecord = new EscrowTransaction({
          userId: testUser._id,
          tradeId: null,
          type: 'manual_intervention_required', // This should now work
          tokenType: 'CES',
          amount: 0.1,
          status: 'pending',
          reason: 'Test manual intervention record',
          createdAt: new Date()
        });
        
        // Don't save it, just validate
        await testRecord.validate();
        console.log('   ✅ manual_intervention_required enum value accepted');
        
        // Test timeout intervention as well
        testRecord.type = 'timeout_intervention_required';
        await testRecord.validate();
        console.log('   ✅ timeout_intervention_required enum value accepted');
      }
      
    } catch (enumError) {
      console.log(`   ❌ Enum validation failed: ${enumError.message}`);
    }
    
    // 2. Check safety system improvements
    console.log('\n🛡️ 2. CHECKING SAFETY SYSTEM IMPROVEMENTS:');
    
    try {
      const escrowSafetySystem = require('../src/services/escrowSafetySystem');
      
      // Test checkSmartContractStatus method exists
      if (typeof escrowSafetySystem.checkSmartContractStatus === 'function') {
        console.log('   ✅ checkSmartContractStatus method available');
      } else {
        console.log('   ❌ checkSmartContractStatus method missing');
      }
      
      // Test createTimelockInterventionRecord method exists
      if (typeof escrowSafetySystem.createTimelockInterventionRecord === 'function') {
        console.log('   ✅ createTimelockInterventionRecord method available');
      } else {
        console.log('   ❌ createTimelockInterventionRecord method missing');
      }
      
    } catch (safetyError) {
      console.log(`   ❌ Safety system check failed: ${safetyError.message}`);
    }
    
    // 3. Check database state after emergency fix
    console.log('\n📊 3. CHECKING DATABASE STATE AFTER EMERGENCY FIX:');
    
    const TRADE_ID = '68adc80204dc62f8f6fbb4a4';
    const ESCROW_ID = '8';
    
    // Check trade status
    const trade = await P2PTrade.findById(TRADE_ID);
    if (trade) {
      console.log(`   Trade Status: ${trade.status} (should be 'cancelled')`);
      console.log(`   Escrow Status: ${trade.escrowStatus} (should be 'returned')`);
      
      if (trade.status === 'cancelled' && trade.escrowStatus === 'returned') {
        console.log('   ✅ Trade properly cancelled');
      } else {
        console.log('   ⚠️ Trade status may need attention');
      }
    } else {
      console.log('   ❌ Test trade not found');
    }
    
    // Check escrow transactions
    const escrowTxs = await EscrowTransaction.find({
      tradeId: TRADE_ID,
      smartContractEscrowId: ESCROW_ID
    }).sort({ createdAt: 1 });
    
    console.log(`   Found ${escrowTxs.length} escrow transactions:`);
    let hasLock = false, hasRefund = false;
    
    for (const tx of escrowTxs) {
      console.log(`   - ${tx.type}: ${tx.amount} ${tx.tokenType}, Status: ${tx.status}`);
      if (tx.type === 'lock') hasLock = true;
      if (tx.type === 'refund') hasRefund = true;
    }
    
    if (hasLock && hasRefund) {
      console.log('   ✅ Complete lock/refund cycle found');
    } else {
      console.log('   ⚠️ Incomplete escrow transaction cycle');
    }
    
    // Check user balance
    const user = await User.findOne({ chatId: '942851377' });
    if (user) {
      console.log(`   User Balance: ${user.cesBalance} CES (should be 2.0)`);
      console.log(`   Escrow Balance: ${user.escrowCESBalance} CES (should be 0)`);
      
      if (user.cesBalance >= 2.0 && user.escrowCESBalance === 0) {
        console.log('   ✅ User balances correct after refund');
      } else {
        console.log('   ⚠️ User balances may need attention');
      }
    }
    
    // 4. Check for stuck escrows
    console.log('\n🔍 4. CHECKING FOR STUCK ESCROWS:');
    
    const stuckTrades = await P2PTrade.find({
      status: { $in: ['escrow_locked', 'payment_pending'] },
      'timeTracking.createdAt': { $lt: new Date(Date.now() - 60 * 60 * 1000) }
    });
    
    console.log(`   Stuck trades found: ${stuckTrades.length}`);
    
    const manualInterventions = await EscrowTransaction.find({
      type: { $in: ['manual_intervention_required', 'timeout_intervention_required'] },
      status: 'pending'
    });
    
    console.log(`   Manual interventions needed: ${manualInterventions.length}`);
    
    if (stuckTrades.length === 0 && manualInterventions.length === 0) {
      console.log('   ✅ No stuck trades or manual interventions needed');
    } else {
      console.log('   ⚠️ Some issues may still need attention');
    }
    
    // 5. Final verdict
    console.log('\n🎯 FINAL VERDICT:');
    
    const allGood = (
      trade?.status === 'cancelled' &&
      user?.cesBalance >= 2.0 &&
      user?.escrowCESBalance === 0 &&
      stuckTrades.length === 0 &&
      manualInterventions.length === 0
    );
    
    if (allGood) {
      console.log('✅ ALL TESTS PASSED - Trade cancellation fixes are working!');
      console.log('💡 Users should now be able to cancel trades normally');
    } else {
      console.log('⚠️ Some issues detected - see details above');
    }
    
    await disconnectDatabase();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await disconnectDatabase();
    throw error;
  }
}

if (require.main === module) {
  testTradeCancellation()
    .then(() => {
      console.log('\n🎉 Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testTradeCancellation };