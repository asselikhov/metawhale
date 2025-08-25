const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Deploy P2P Escrow Smart Contract to Polygon Network
 * This script deploys the escrow contract and saves the deployment info
 */

class EscrowDeployer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
    
    // Admin wallet for deployment
    if (!process.env.ADMIN_PRIVATE_KEY) {
      throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
    }
    
    this.deployerWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider);
    
    // CES Token address on Polygon (update this with actual address)
    this.cesTokenAddress = process.env.CES_TOKEN_ADDRESS || '0x...'; // TODO: Update with real CES token address
    
    console.log(`🚀 Deployer address: ${this.deployerWallet.address}`);
    console.log(`🌐 Network: Polygon Mainnet`);
    console.log(`🪙 CES Token: ${this.cesTokenAddress}`);
  }

  /**
   * Get contract bytecode and ABI (placeholder - in real deployment use Hardhat/Truffle)
   */
  getContractData() {
    // In production, this would be compiled using Hardhat/Truffle
    // For now, providing the interface for deployment
    const abi = [
      "constructor(address _cesToken)",
      "function createEscrow(address seller, address buyer, uint256 amount, uint256 timelock) external returns (uint256)",
      "function releaseEscrow(uint256 escrowId) external",
      "function refundEscrow(uint256 escrowId) external",
      "function getEscrowDetails(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)",
      "function extendTimelock(uint256 escrowId, uint256 additionalTime) external",
      "function initiateDispute(uint256 escrowId) external",
      "function resolveDispute(uint256 escrowId, bool favorBuyer) external",
      "function pause() external",
      "function unpause() external",
      "function owner() external view returns (address)",
      "function transferOwnership(address newOwner) external",
      "event EscrowCreated(uint256 indexed escrowId, address indexed seller, address indexed buyer, uint256 amount)",
      "event EscrowReleased(uint256 indexed escrowId)",
      "event EscrowRefunded(uint256 indexed escrowId)",
      "event DisputeInitiated(uint256 indexed escrowId)",
      "event DisputeResolved(uint256 indexed escrowId, bool favorBuyer)"
    ];

    // This bytecode would come from compilation - placeholder for now
    const bytecode = "0x..."; // TODO: Compile contract to get bytecode

    return { abi, bytecode };
  }

  /**
   * Deploy the escrow contract
   */
  async deployContract() {
    try {
      console.log('\n🔧 Starting contract deployment...');

      // Check deployer balance
      const balance = await this.provider.getBalance(this.deployerWallet.address);
      console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} MATIC`);

      if (balance < ethers.parseEther('0.1')) {
        throw new Error('Insufficient MATIC balance for deployment (need at least 0.1 MATIC)');
      }

      // Validate CES token address
      if (!ethers.isAddress(this.cesTokenAddress)) {
        throw new Error('Invalid CES token address');
      }

      const { abi, bytecode } = this.getContractData();

      // Create contract factory
      const contractFactory = new ethers.ContractFactory(abi, bytecode, this.deployerWallet);

      // Estimate gas
      const deploymentGas = await contractFactory.getDeployTransaction(this.cesTokenAddress).gasLimit;
      console.log(`⛽ Estimated gas: ${deploymentGas?.toString() || 'Unknown'}`);

      // Deploy contract
      console.log('\n📡 Deploying contract...');
      const contract = await contractFactory.deploy(this.cesTokenAddress, {
        gasLimit: 3000000, // Set a safe gas limit
        gasPrice: ethers.parseUnits('30', 'gwei') // 30 gwei gas price
      });

      console.log(`⏳ Deployment transaction: ${contract.deploymentTransaction()?.hash}`);
      console.log('⌛ Waiting for deployment confirmation...');

      // Wait for deployment
      await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();

      console.log('\n✅ Contract deployed successfully!');
      console.log(`📋 Contract address: ${contractAddress}`);
      console.log(`🔗 Transaction: ${contract.deploymentTransaction()?.hash}`);

      // Verify owner
      const owner = await contract.owner();
      console.log(`👑 Contract owner: ${owner}`);

      // Save deployment info
      await this.saveDeploymentInfo(contractAddress, contract.deploymentTransaction()?.hash, abi);

      return {
        address: contractAddress,
        txHash: contract.deploymentTransaction()?.hash,
        abi: abi
      };

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  /**
   * Save deployment information to file
   */
  async saveDeploymentInfo(contractAddress, txHash, abi) {
    const deploymentInfo = {
      contractAddress,
      txHash,
      deployer: this.deployerWallet.address,
      cesTokenAddress: this.cesTokenAddress,
      network: 'polygon',
      deployedAt: new Date().toISOString(),
      abi: abi
    };

    const deploymentPath = path.join(__dirname, '../deployment/escrow-deployment.json');
    
    // Ensure deployment directory exists
    const deploymentDir = path.dirname(deploymentPath);
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${deploymentPath}`);
  }

  /**
   * Verify contract on PolygonScan (optional)
   */
  async verifyContract(contractAddress) {
    console.log('\n🔍 Contract verification info:');
    console.log(`Contract: ${contractAddress}`);
    console.log(`Network: Polygon Mainnet`);
    console.log(`Constructor args: ${this.cesTokenAddress}`);
    console.log('\nTo verify on PolygonScan:');
    console.log(`1. Go to https://polygonscan.com/address/${contractAddress}#code`);
    console.log(`2. Click "Verify and Publish"`);
    console.log(`3. Select "Solidity (Single file)"`);
    console.log(`4. Upload the contract source code`);
    console.log(`5. Set constructor arguments: ${this.cesTokenAddress}`);
  }
}

/**
 * Main deployment function
 */
async function deployEscrow() {
  try {
    console.log('🔐 P2P Escrow Contract Deployment');
    console.log('=====================================\n');

    const deployer = new EscrowDeployer();
    const result = await deployer.deployContract();

    console.log('\n🎉 Deployment completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update .env file with ESCROW_CONTRACT_ADDRESS');
    console.log('2. Set USE_SMART_CONTRACT_ESCROW=true');
    console.log('3. Test the escrow functionality');
    console.log('4. Verify contract on PolygonScan');

    await deployer.verifyContract(result.address);

    return result;

  } catch (error) {
    console.error('\n💥 Deployment script failed:', error.message);
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  deployEscrow()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployEscrow, EscrowDeployer };