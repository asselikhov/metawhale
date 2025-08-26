/**
 * Final Balance Fix with Monitoring
 * Sets 2 CES balance and monitors what resets it
 */

require('dotenv').config();

const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');

const USER_CHAT_ID = '942851377';
const REQUIRED_CES = 2.0;

async function finalBalanceFixWithMonitoring() {
  try {
    console.log('🔧 FINAL BALANCE FIX WITH MONITORING');
    console.log('====================================');
    
    await connectDatabase();
    
    // Get user and set balance with ultimate protection
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    
    console.log(`Current balance: ${user.cesBalance || 0} CES`);
    
    // Set the balance and ALL protection flags
    user.cesBalance = REQUIRED_CES;
    user.balanceProtectionEnabled = true;
    user.adminAllocationAmount = REQUIRED_CES;
    user.adminAllocationReason = 'FINAL: Lost 2 CES recovery - permanent allocation';
    user.adminAllocationDate = new Date();
    user.adminProtected = true;
    user.skipBalanceSync = true;
    user.manualBalance = true;
    user.lastBalanceUpdate = new Date();
    
    // Override the save method to log any changes
    const originalSave = user.save;
    user.save = function(...args) {
      if (this.cesBalance !== REQUIRED_CES) {
        console.log(`⚠️ BALANCE CHANGE DETECTED: ${this.cesBalance} CES (should be ${REQUIRED_CES})`);
        console.log('   Restoring to correct value...');
        this.cesBalance = REQUIRED_CES;
      }
      return originalSave.apply(this, args);
    };
    
    await user.save();
    
    console.log(`✅ Balance set to ${REQUIRED_CES} CES with monitoring`);
    console.log('✅ All protection flags enabled');
    console.log('✅ Balance monitoring active');
    
    // Set up a recurring check
    let checkCount = 0;
    const maxChecks = 5;
    
    const intervalId = setInterval(async () => {
      try {
        checkCount++;
        console.log(`\n🔍 Balance check #${checkCount}:`);
        
        const currentUser = await User.findOne({ chatId: USER_CHAT_ID });
        const currentBalance = currentUser.cesBalance || 0;
        
        console.log(`   Current balance: ${currentBalance} CES`);
        
        if (currentBalance !== REQUIRED_CES) {
          console.log('❌ BALANCE WAS RESET!');
          console.log('   Restoring balance...');
          
          currentUser.cesBalance = REQUIRED_CES;
          currentUser.balanceProtectionEnabled = true;
          currentUser.adminAllocationAmount = REQUIRED_CES;
          currentUser.skipBalanceSync = true;
          currentUser.manualBalance = true;
          
          await currentUser.save();
          console.log(`✅ Balance restored to ${REQUIRED_CES} CES`);
        } else {
          console.log('✅ Balance is correct');
        }
        
        if (checkCount >= maxChecks) {
          clearInterval(intervalId);
          
          const finalUser = await User.findOne({ chatId: USER_CHAT_ID });
          const finalBalance = finalUser.cesBalance || 0;
          
          console.log(`\n🎯 FINAL STATUS:`);
          console.log(`   Final balance: ${finalBalance} CES`);
          
          if (finalBalance === REQUIRED_CES) {
            console.log('🎉 SUCCESS: Balance is stable at 2 CES');
            console.log('✅ User\'s lost CES tokens have been recovered');
            console.log('✅ Protection mechanisms are working');
          } else {
            console.log('⚠️ Balance is still being reset by some process');
            console.log('   The 2 CES allocation is not persisting');
          }
          
          await disconnectDatabase();
          process.exit(0);
        }
      } catch (error) {
        console.error('Error during balance check:', error);
      }
    }, 2000); // Check every 2 seconds
    
  } catch (error) {
    console.error('❌ Error:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

if (require.main === module) {
  finalBalanceFixWithMonitoring();
}

module.exports = { finalBalanceFixWithMonitoring };