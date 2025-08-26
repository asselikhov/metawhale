# Scripts Directory

This directory contains utility and maintenance scripts for the Metawhale project.

## 🔧 Maintenance Scripts

### `cleanup.js`
Project cleanup and maintenance tool.
```bash
# Run full cleanup
node scripts/cleanup.js --cleanup

# Run health check only
node scripts/cleanup.js --check

# Get help
node scripts/cleanup.js --help
```

### `balance-monitor.js`
Monitor and fix user balance synchronization issues.
```bash
# Check and fix balance discrepancies
node scripts/balance-monitor.js

# Dry run (check only)
node scripts/balance-monitor.js --dry-run

# Include test users
node scripts/balance-monitor.js --include-test-users
```

### `test-transaction-fixes.js`
Test the improved transaction handling and gas estimation.
```bash
node scripts/test-transaction-fixes.js
```

## 🚀 Deployment Scripts

### `deploy-escrow.js`
Deploy smart contract escrow to blockchain networks.
```bash
# Deploy to Polygon mainnet
yarn deploy:polygon

# Deploy to Mumbai testnet
yarn deploy:mumbai
```

### `deploy.js`
Main deployment script with additional configuration.

### `render-build.sh`
Build script for Render.com deployment.

## 🔍 Diagnostic Scripts

### `check-smart-contract-escrow.js`
Comprehensive smart contract escrow system diagnostics.

### `check-smart-contract-escrow-status.js`
Quick status check for smart contract escrow operations.

### `diagnose-stuck-escrow.js`
Diagnose and analyze stuck escrow transactions.

### `investigate-missing-tokens.js`
Investigate missing token balances and transaction discrepancies.

## 🛠️ Fix & Repair Scripts

### `fix-escrow-balance.js`
Fix escrow balance discrepancies between database and smart contract.

### `fix-escrow-issues.js`
General escrow issue resolution script.

### `fix-seller-escrow-balance.js`
Specifically fix seller escrow balance issues.

### `fix-stuck-escrow.js`
Resolve stuck escrow transactions.

## 🔄 Transaction Scripts

### `adjust-trade-amount.js`
Adjust trade amounts in existing transactions.

### `cancel-stuck-trades.js`
Cancel transactions that are stuck in pending state.

### `check-trade-discrepancy.js`
Check for discrepancies in trade data.

### `manual-token-return.js`
Manually return tokens from escrow when automatic process fails.

### `return-remaining-escrow.js`
Return remaining escrowed tokens to users.

## 🧪 Testing Scripts

### `test-allowance-fix.js`
Test token allowance fixes.

### `test-approval-ui.js`
Test approval user interface functionality.

### `test-deployment.js`
Test deployment configuration and readiness.

### `test-escrow-config.js`
Test escrow configuration parameters.

### `test-order-cancellation-fix.js`
Test order cancellation functionality fixes.

### `test-secure-p2p-flow.js`
Test secure P2P transaction flow.

## 📋 Validation Scripts

### `validate-escrow-system-fixed.js`
Validate that escrow system fixes are working correctly.

### `validate-trade-formation-fixes.js`
Validate trade formation process improvements.

## 📢 Notification Scripts

### `notify-buyer-about-escrow.js`
Send notifications to buyers about escrow status.

## ⏰ Scheduled Scripts

### `release-expired-smart-escrow.js`
Release expired smart contract escrow automatically.

## 📊 Analysis Scripts

### `simulate-post-deployment.js`
Simulate post-deployment scenarios and test system behavior.

## 🏃‍♂️ Quick Commands

Using npm/yarn scripts (defined in package.json):

```bash
# Project maintenance
yarn cleanup                # Clean up project files
yarn health-check          # Check project health

# Balance monitoring
yarn monitor-balance       # Monitor user balances

# Transaction testing
yarn test-transactions     # Test transaction improvements

# Development
yarn dev                   # Start in development mode
yarn test                  # Run tests
yarn test:watch           # Run tests in watch mode

# Deployment
yarn deploy:polygon       # Deploy to Polygon mainnet
yarn deploy:mumbai        # Deploy to Mumbai testnet
```

## 📝 Notes

- Always backup your database before running fix scripts
- Test scripts in development environment first
- Monitor gas prices before running transaction scripts
- Check logs for detailed operation results
- Use `--dry-run` flags when available to preview changes

## 🔒 Security

- Never commit private keys or sensitive data
- Use environment variables for configuration
- Verify contract addresses before deployment
- Test all operations on testnet first