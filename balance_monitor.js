/**
 * Comprehensive Balance Monitor and Fixer
 * Detects and fixes all types of balance discrepancies
 */

require('dotenv').config();
const mongoose = require('mongoose');
const balanceValidationService = require('./src/services/balanceValidationService');
const { User } = require('./src/database/models');

async function runBalanceMonitor() {
  try {
    console.log('🔍 COMPREHENSIVE BALANCE MONITOR');
    console.log('===============================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Run system-wide validation
    console.log('\n🔄 Running system-wide balance validation...');
    const systemResults = await balanceValidationService.validateAllUserBalances({
      limit: 1000,
      autoFix: true,
      onlyWithIssues: false
    });
    
    console.log('\n📊 SYSTEM VALIDATION RESULTS:');
    console.log(`   Total users checked: ${systemResults.totalUsers}`);
    console.log(`   Users with issues: ${systemResults.usersWithIssues}`);
    console.log(`   Total issues found: ${systemResults.totalIssues}`);
    console.log(`   Total fixes applied: ${systemResults.totalFixes}`);
    
    // Display detailed results for problematic users
    if (systemResults.usersWithIssues > 0) {
      console.log('\n🚨 USERS WITH ISSUES:');
      console.log('====================');
      
      systemResults.userResults.forEach((userResult, index) => {
        if (userResult.issues.length > 0) {
          console.log(`\n${index + 1}. User ${userResult.chatId} (${userResult.walletAddress})`);
          
          // Show issues
          userResult.issues.forEach(issue => {
            const emoji = issue.severity === 'HIGH' ? '🚨' : issue.severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
            console.log(`   ${emoji} ${issue.type}: ${issue.description}`);
          });
          
          // Show fixes
          if (userResult.fixes.length > 0) {
            console.log(`   🔧 Fixes applied:`);
            userResult.fixes.forEach(fix => {
              console.log(`      ✅ ${fix.type}: ${fix.description}`);
            });
          }
          
          // Show balances
          console.log(`   📊 Balances:`);
          console.log(`      Before: CES=${userResult.balances.before.cesDB}, Escrow=${userResult.balances.before.cesEscrowDB}`);
          if (userResult.balances.blockchain.ces !== undefined) {
            console.log(`      Blockchain: CES=${userResult.balances.blockchain.ces}`);
          }
          if (userResult.balances.after && Object.keys(userResult.balances.after).length > 0) {
            console.log(`      After: CES=${userResult.balances.after.cesDB}, Escrow=${userResult.balances.after.cesEscrowDB}`);
          }
        }
      });
    }
    
    // Check specific problematic user
    console.log('\n🎯 CHECKING SPECIFIC USER (942851377):');
    console.log('====================================');
    
    const specificUser = await User.findOne({ chatId: '942851377' });
    if (specificUser) {
      const specificResult = await balanceValidationService.validateAndFixUserBalance(
        specificUser._id, 
        { autoFix: true, logDetails: true, checkEscrow: true }
      );
      
      console.log('📊 Specific user validation:');
      console.log(`   Issues: ${specificResult.issues.length}`);
      console.log(`   Fixes: ${specificResult.fixes.length}`);
      
      if (specificResult.issues.length > 0) {
        console.log('   Issues found:');
        specificResult.issues.forEach(issue => {
          console.log(`      - ${issue.type}: ${issue.description}`);
        });
      }
      
      if (specificResult.fixes.length > 0) {
        console.log('   Fixes applied:');
        specificResult.fixes.forEach(fix => {
          console.log(`      - ${fix.type}: ${fix.description}`);
        });
      }
    }
    
    // Generate recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (systemResults.totalIssues === 0) {
      console.log('✅ All user balances are consistent! No issues found.');
    } else {
      console.log(`🔧 ${systemResults.totalFixes} automatic fixes were applied.`);
      
      if (systemResults.totalIssues > systemResults.totalFixes) {
        console.log('⚠️ Some issues may require manual intervention:');
        console.log('   1. Check smart contract escrow status for orphaned locks');
        console.log('   2. Verify blockchain transactions for failed operations');
        console.log('   3. Review escrow transaction history for inconsistencies');
      }
      
      console.log('\n🔄 Prevention measures:');
      console.log('   1. Enable periodic balance validation (already implemented)');
      console.log('   2. Always validate balances after escrow operations (already implemented)');
      console.log('   3. Monitor for negative escrow balances');
      console.log('   4. Check for orphaned escrow transactions');
    }
    
    // Suggest monitoring setup
    console.log('\n🔄 AUTOMATED MONITORING SETUP:');
    console.log('==============================');
    console.log('To enable automatic balance monitoring, add this to your main application:');
    console.log('');
    console.log('```javascript');
    console.log('const balanceValidationService = require("./src/services/balanceValidationService");');
    console.log('// Start periodic validation every hour');
    console.log('balanceValidationService.startPeriodicValidation(60);');
    console.log('```');
    
  } catch (error) {
    console.error('❌ Balance monitor failed:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n✅ Database disconnected');
    }
  }
}

// Command line options
const args = process.argv.slice(2);
const autoFix = args.includes('--fix');
const specific = args.includes('--specific');

if (require.main === module) {
  if (specific) {
    // Check only specific user
    mongoose.connect(process.env.MONGODB_URI).then(async () => {
      const user = await User.findOne({ chatId: '942851377' });
      if (user) {
        const result = await balanceValidationService.validateAndFixUserBalance(user._id, {
          autoFix: autoFix,
          logDetails: true
        });
        console.log('Result:', JSON.stringify(result, null, 2));
      }
      await mongoose.disconnect();
    });
  } else {
    // Run full monitor
    runBalanceMonitor().catch(error => {
      console.error('Monitor error:', error);
      process.exit(1);
    });
  }
}

module.exports = { runBalanceMonitor };