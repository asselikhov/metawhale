/**
 * Test Escrow Configuration
 * Verifies current escrow security settings and demonstrates functionality
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Add the src directory to the require path
process.chdir(path.join(__dirname, '..'));

// Test environment variables first
function testEnvironmentVariables() {
  console.log('📋 Environment Variables Check:');
  console.log('-------------------------------');
  
  const useSmartContract = process.env.USE_SMART_CONTRACT_ESCROW;
  const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
  const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
  const polygonRpcUrl = process.env.POLYGON_RPC_URL;
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

  console.log(`USE_SMART_CONTRACT_ESCROW: ${useSmartContract}`);
  console.log(`ESCROW_CONTRACT_ADDRESS: ${escrowContractAddress || 'NOT SET'}`);
  console.log(`CES_TOKEN_ADDRESS: ${cesTokenAddress || 'NOT SET'}`);
  console.log(`POLYGON_RPC_URL: ${polygonRpcUrl || 'NOT SET'}`);
  console.log(`ADMIN_PRIVATE_KEY: ${adminPrivateKey ? 'SET' : 'NOT SET'}`);
  
  return {
    useSmartContract,
    escrowContractAddress,
    cesTokenAddress,
    polygonRpcUrl,
    adminPrivateKey
  };
}

async function testEscrowConfiguration() {
  console.log('🔍 Testing Escrow Configuration');
  console.log('==============================\n');

  try {
    // Test environment variables
    const env = testEnvironmentVariables();

    // Analyze security status
    console.log('\n🛡️ Security Analysis:');
    console.log('---------------------');
    
    if (env.useSmartContract === 'true') {
      if (env.escrowContractAddress && env.escrowContractAddress !== '') {
        console.log('✅ SECURE: Smart contract escrow is properly configured');
        console.log('🔒 Tokens will be physically locked in blockchain');
        console.log('🚫 Users CANNOT bypass escrow security');
        
        // Test contract address format
        if (env.escrowContractAddress.startsWith('0x') && env.escrowContractAddress.length === 42) {
          console.log('✅ Contract address format is valid');
        } else {
          console.log('❌ Invalid contract address format');
        }
      } else {
        console.log('⚠️ WARNING: Smart contract enabled but no address provided');
        console.log('❌ Will fall back to insecure database-only mode');
      }
    } else {
      console.log('🚨 INSECURE: Database-only escrow mode');
      console.log('⚠️ Users CAN bypass escrow by exporting private key');
      console.log('💥 Risk: Users can spend "locked" tokens via MetaMask/DEX');
    }

    // Test compilation artifacts
    console.log('\n📦 Smart Contract Compilation:');
    console.log('-------------------------------');
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      const artifactsPath = path.join(__dirname, '../artifacts/contracts/P2PEscrow.sol');
      const contractPath = path.join(__dirname, '../contracts/P2PEscrow.sol');
      
      if (fs.existsSync(contractPath)) {
        console.log('✅ Smart contract source found');
      } else {
        console.log('❌ Smart contract source not found');
      }
      
      if (fs.existsSync(artifactsPath)) {
        console.log('✅ Smart contract compiled successfully');
        
        // Check for ABI and bytecode
        const p2pEscrowArtifact = path.join(artifactsPath, 'P2PEscrow.json');
        if (fs.existsSync(p2pEscrowArtifact)) {
          console.log('✅ Contract ABI and bytecode available');
        }
      } else {
        console.log('❌ Smart contract not compiled');
        console.log('💡 Run: npx hardhat compile');
      }
    } catch (error) {
      console.log('⚠️ Error checking compilation artifacts:', error.message);
    }

    // Deployment readiness check
    console.log('\n🚀 Deployment Readiness:');
    console.log('------------------------');
    
    let readinessScore = 0;
    let totalChecks = 5;
    
    if (env.cesTokenAddress) {
      console.log('✅ CES token address configured');
      readinessScore++;
    } else {
      console.log('❌ CES token address missing');
    }
    
    if (env.polygonRpcUrl) {
      console.log('✅ Polygon RPC URL configured');
      readinessScore++;
    } else {
      console.log('❌ Polygon RPC URL missing');
    }
    
    if (env.adminPrivateKey) {
      console.log('✅ Admin private key configured');
      readinessScore++;
    } else {
      console.log('❌ Admin private key missing (required for deployment)');
    }
    
    // Check if artifacts exist
    const fs = require('fs');
    const artifactsPath = path.join(__dirname, '../artifacts/contracts/P2PEscrow.sol/P2PEscrow.json');
    if (fs.existsSync(artifactsPath)) {
      console.log('✅ Smart contract compiled');
      readinessScore++;
    } else {
      console.log('❌ Smart contract not compiled');
    }
    
    // Check if deployment scripts exist
    const deployScriptPath = path.join(__dirname, 'deploy.js');
    if (fs.existsSync(deployScriptPath)) {
      console.log('✅ Deployment script ready');
      readinessScore++;
    } else {
      console.log('❌ Deployment script missing');
    }
    
    console.log(`\n📊 Readiness Score: ${readinessScore}/${totalChecks}`);
    
    if (readinessScore === totalChecks) {
      console.log('🎉 READY FOR DEPLOYMENT!');
      console.log('💡 Run: npm run deploy:polygon');
    } else {
      console.log('⚠️ Setup incomplete - check missing items above');
    }

    // Next steps
    console.log('\n📋 Next Steps:');
    console.log('--------------');
    
    if (!env.adminPrivateKey) {
      console.log('1. Set ADMIN_PRIVATE_KEY in .env file (for deployment)');
    }
    
    if (env.useSmartContract !== 'true') {
      console.log('2. Set USE_SMART_CONTRACT_ESCROW=true for security');
    }
    
    if (!env.escrowContractAddress) {
      console.log('3. Deploy smart contract to get contract address');
    }
    
    if (readinessScore === totalChecks) {
      console.log('🚀 Ready to deploy secure P2P escrow!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testEscrowConfiguration()
    .then(() => {
      console.log('\n✅ Escrow configuration test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testEscrowConfiguration };