/**
 * Cleanup script to remove unnecessary files and directories
 * while preserving core functionality
 */

const fs = require('fs');
const path = require('path');

// Files and directories to remove
const filesToRemove = [
  // Test files we created for debugging
  'checkAllSyntax.js',
  'checkFile.js',
  'checkSyntax.js',
  'testFix.js',
  
  // Redundant documentation files (keeping only essential ones)
  'ALL_TOKENS_P2P_UNIFIED.md',
  'BALANCE_DISPLAY_FIXES.md',
  'DEPLOYMENT_FIXES.md',
  'DISPUTE_SYSTEM_DOCUMENTATION.md',
  'ENHANCED_P2P_ORDERS_SUMMARY.md',
  'EXTENDED_MULTI_CHAIN_SUPPORT.md',
  'FEES_COMMAND_DOCUMENTATION.md',
  'LINK_FORMAT_FIX_REPORT.md',
  'LIVELINESS_POL_BALANCE_FIX.md',
  'MULTICURRENCY_P2P_ARCHITECTURE.md',
  'MULTI_CHAIN_IMPLEMENTATION.md',
  'NETWORK_SELECTION_IMPLEMENTATION_REPORT.md',
  'NETWORK_WALLET_P2P_IMPROVEMENTS.md',
  'P2P_EDIT_TRADE_TIME_FIX_REPORT.md',
  'P2P_MULTI_TOKEN_IMPLEMENTATION.md',
  'P2P_SELL_ORDER_FIX_REPORT.md',
  'P2P_TRADE_TIME_UPDATE_FIX_REPORT.md',
  'POL_P2P_MESSAGE_CHANGE.md',
  'SCHEDULER_FIX_REPORT.md',
  'SETTINGS_INTERFACE_EXAMPLES.md',
  'STAT_COMMAND_DOCUMENTATION.md',
  'TIMELOCK_CANCELLATION_FINAL_RESOLUTION.md',
  'TIMELOCK_ERROR_FIX_REPORT.md',
  'TOKEN_PRICE_COMMANDS.md',
  'TON_NETWORK_INTEGRATION.md',
  'TRADE_CANCELLATION_FIX.md',
  'TRADE_CANCELLATION_RULES_DOCUMENTATION.md',
  'TRADE_CANCELLATION_USER_GUIDE.md',
  'VALIDATION_FIXES_REPORT.md',
  'WALLET_BALANCE_BUG_FIX.md',
  'WALLET_RESTORATION_REPORT.md',
  'cancel_logic_demo.md'
];

const dirsToRemove = [
  // Empty directories
  'temp'
];

// Function to safely remove a file
function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Removed file: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error removing file ${filePath}:`, error.message);
  }
}

// Function to safely remove a directory
function removeDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmdirSync(dirPath);
      console.log(`✅ Removed directory: ${dirPath}`);
    }
  } catch (error) {
    console.error(`❌ Error removing directory ${dirPath}:`, error.message);
  }
}

// Main cleanup function
function cleanup() {
  console.log('🧹 Starting cleanup process...\n');
  
  // Remove files
  console.log('Removing unnecessary files...');
  filesToRemove.forEach(file => {
    const filePath = path.join(__dirname, file);
    removeFile(filePath);
  });
  
  // Remove directories
  console.log('\nRemoving unnecessary directories...');
  dirsToRemove.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    removeDir(dirPath);
  });
  
  console.log('\n✅ Cleanup process completed!');
  console.log('Keeping essential files:');
  console.log('  - src/ (source code)');
  console.log('  - package.json (dependencies)');
  console.log('  - .env (configuration)');
  console.log('  - README.md (documentation)');
  console.log('  - render.yaml (deployment)');
  console.log('  - docs/MODULAR_ARCHITECTURE.md (new architecture documentation)');
}

// Run cleanup
if (require.main === module) {
  cleanup();
}

module.exports = { cleanup };