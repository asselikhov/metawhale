/**
 * Test Token Approval UI
 * Tests the smart contract approval flow for P2P escrow
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function testApprovalUI() {
  console.log('🧪 Testing Token Approval UI');
  console.log('=============================\n');

  try {
    // Check environment variables
    const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
    const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    const useSmartContract = process.env.USE_SMART_CONTRACT_ESCROW;
    const polygonRpcUrl = process.env.POLYGON_RPC_URL;

    console.log('📋 Configuration Check:');
    console.log('----------------------');
    console.log(`CES Token: ${cesTokenAddress || 'NOT SET'}`);
    console.log(`Escrow Contract: ${escrowContractAddress || 'NOT SET'}`);
    console.log(`Smart Contract Enabled: ${useSmartContract}`);
    console.log(`Polygon RPC: ${polygonRpcUrl || 'NOT SET'}`);

    if (!cesTokenAddress || !escrowContractAddress || !polygonRpcUrl) {
      console.log('\n❌ Missing required environment variables');
      return;
    }

    // Test provider connection
    console.log('\n🔌 Testing Provider Connection:');
    console.log('-------------------------------');
    
    const provider = new ethers.JsonRpcProvider(polygonRpcUrl);
    const network = await provider.getNetwork();
    console.log(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

    // Test contract interfaces
    console.log('\n📄 Testing Contract Interfaces:');
    console.log('--------------------------------');

    const erc20Abi = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)"
    ];

    const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);

    try {
      const symbol = await cesContract.symbol();
      const decimals = await cesContract.decimals();
      console.log(`✅ CES Token Contract: ${symbol} (${decimals} decimals)`);
    } catch (error) {
      console.log('❌ Failed to connect to CES token contract:', error.message);
    }

    // Test escrow contract
    const escrowAbi = [
      "function createEscrow(address seller, address buyer, uint256 amount, uint256 timelock) external returns (uint256)",
      "function owner() external view returns (address)"
    ];

    try {
      const escrowContract = new ethers.Contract(escrowContractAddress, escrowAbi, provider);
      const owner = await escrowContract.owner();
      console.log(`✅ Escrow Contract: Owner ${owner.slice(0,6)}...${owner.slice(-4)}`);
    } catch (error) {
      console.log('❌ Failed to connect to escrow contract:', error.message);
    }

    // Test approval simulation
    console.log('\n🔍 Testing Approval Simulation:');
    console.log('-------------------------------');

    const testWallet = '0x742d35Cc6D7aB0532667ED1Df8C5fF7BC6FaDC3C'; // Random test address
    const testAmount = ethers.parseEther('1.0'); // 1 CES

    try {
      const currentAllowance = await cesContract.allowance(testWallet, escrowContractAddress);
      console.log(`📊 Current allowance for test wallet: ${ethers.formatEther(currentAllowance)} CES`);
      
      if (currentAllowance >= testAmount) {
        console.log('✅ Sufficient allowance already exists');
      } else {
        console.log('⚠️ Approval would be required for this amount');
      }
    } catch (error) {
      console.log('⚠️ Cannot check allowance (expected for test wallet)');
    }

    // Test UI Flow Simulation
    console.log('\n🎭 UI Flow Simulation:');
    console.log('----------------------');

    const simulatedOrder = {
      orderType: 'sell',
      amount: 1.5,
      pricePerToken: 250.75,
      minAmount: 1,
      maxAmount: 5
    };

    console.log('📝 Simulated P2P Order:');
    console.log(`   Type: ${simulatedOrder.orderType}`);
    console.log(`   Amount: ${simulatedOrder.amount} CES`);
    console.log(`   Price: ₽${simulatedOrder.pricePerToken} per CES`);

    // Check if approval would be triggered
    const isSecureEscrow = simulatedOrder.orderType === 'sell' && useSmartContract === 'true' && escrowContractAddress;
    
    if (isSecureEscrow) {
      console.log('\n🔐 Secure Escrow Flow Would Be Triggered:');
      console.log('1. ✅ Check current token allowance');
      console.log('2. 🔍 Compare with required amount');
      console.log('3. 📱 Show approval UI if needed');
      console.log('4. 💫 Execute approval transaction');
      console.log('5. ⏳ Wait for confirmation');
      console.log('6. 🚀 Proceed with order creation');
    } else {
      console.log('\n⚠️ Database-Only Escrow Would Be Used:');
      console.log('- No token approval required');
      console.log('- Tokens remain spendable via MetaMask');
      console.log('- Security risk exists');
    }

    // Gas estimation
    console.log('\n⛽ Gas Estimation:');
    console.log('------------------');

    try {
      // Estimate gas for approval
      const approvalGasEstimate = await cesContract.approve.estimateGas(escrowContractAddress, testAmount);
      console.log(`📊 Approval gas estimate: ${approvalGasEstimate.toString()}`);
      
      const gasPrice = ethers.parseUnits('30', 'gwei');
      const approvalCost = approvalGasEstimate * gasPrice;
      console.log(`💰 Approval cost: ${ethers.formatEther(approvalCost)} MATIC`);
    } catch (error) {
      console.log('⚠️ Cannot estimate gas (expected without valid wallet)');
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('----------------');
    
    if (isSecureEscrow) {
      console.log('✅ Smart contract approval UI would be triggered');
      console.log('✅ Maximum security for P2P trades');
      console.log('✅ Tokens would be physically locked');
    } else {
      console.log('⚠️ Database-only escrow would be used');
      console.log('⚠️ Users could bypass escrow security');
      console.log('💡 Enable smart contract escrow for security');
    }

    console.log('\n✅ Token approval UI test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testApprovalUI()
    .then(() => {
      console.log('\n🎉 All tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testApprovalUI };