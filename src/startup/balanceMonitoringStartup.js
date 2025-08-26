/**
 * Balance Monitoring Startup Configuration
 * Add this to your main application startup to enable automatic balance validation
 */

const balanceValidationService = require('./src/services/balanceValidationService');

/**
 * Initialize balance monitoring system
 */
function initializeBalanceMonitoring() {
  try {
    console.log('🔄 Initializing balance monitoring system...');
    
    // Start periodic validation every hour
    balanceValidationService.startPeriodicValidation(60);
    
    console.log('✅ Balance monitoring system initialized successfully');
    console.log('   - Periodic validation: Every 60 minutes');
    console.log('   - Auto-fix enabled: Yes');
    console.log('   - Post-operation validation: Enabled');
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize balance monitoring:', error);
    return false;
  }
}

/**
 * Validate system health on startup
 */
async function validateSystemHealth() {
  try {
    console.log('🔍 Running startup balance validation...');
    
    // Run a quick system check
    const results = await balanceValidationService.validateAllUserBalances({
      limit: 10,
      autoFix: true,
      onlyWithIssues: true
    });
    
    if (results.usersWithIssues === 0) {
      console.log('✅ System health check passed - all balances are consistent');
    } else {
      console.warn(`⚠️ Found ${results.usersWithIssues} users with balance issues`);
      console.log(`🔧 Applied ${results.totalFixes} automatic fixes`);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ System health validation failed:', error);
    throw error;
  }
}

/**
 * Add to your main application startup
 */
async function startupIntegration() {
  try {
    // 1. Initialize monitoring
    const monitoringEnabled = initializeBalanceMonitoring();
    
    if (!monitoringEnabled) {
      console.warn('⚠️ Balance monitoring not enabled - manual validation required');
    }
    
    // 2. Validate system health
    await validateSystemHealth();
    
    console.log('🎉 Balance prevention system is fully operational!');
    
  } catch (error) {
    console.error('❌ Startup integration failed:', error);
    // Don't stop the application, but log the issue
  }
}

module.exports = {
  initializeBalanceMonitoring,
  validateSystemHealth,
  startupIntegration
};