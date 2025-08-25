const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Deploy P2P Escrow Contract using Hardhat
 */
async function main() {
  console.log("🔐 Deploying P2P Escrow Contract to Polygon");
  console.log("==========================================\n");

  try {
    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("🚀 Deploying with account:", deployer.address);

    // Check balance
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", hre.ethers.utils.formatEther(balance), "MATIC");

    if (balance.lt(hre.ethers.utils.parseEther("0.05"))) {
      throw new Error("❌ Insufficient MATIC balance for deployment (need at least 0.05 MATIC)");
    }

    // CES Token address
    const CES_TOKEN_ADDRESS = process.env.CES_TOKEN_ADDRESS;
    
    if (!CES_TOKEN_ADDRESS || !hre.ethers.utils.isAddress(CES_TOKEN_ADDRESS)) {
      throw new Error("❌ Invalid or missing CES_TOKEN_ADDRESS in environment variables");
    }

    console.log("🪙 CES Token Address:", CES_TOKEN_ADDRESS);

    // Get the contract factory
    const P2PEscrow = await hre.ethers.getContractFactory("P2PEscrow");

    console.log("\n📡 Deploying P2PEscrow contract...");

    // Deploy the contract
    const escrow = await P2PEscrow.deploy(CES_TOKEN_ADDRESS, {
      gasLimit: 3000000,
      gasPrice: hre.ethers.utils.parseUnits("30", "gwei")
    });

    console.log("⏳ Deployment transaction hash:", escrow.deployTransaction.hash);
    console.log("⌛ Waiting for deployment confirmation...");

    // Wait for deployment to be mined
    await escrow.deployed();
    const escrowAddress = escrow.address;

    console.log("\n✅ P2PEscrow deployed successfully!");
    console.log("📋 Contract address:", escrowAddress);
    console.log("🔗 Transaction hash:", escrow.deployTransaction.hash);

    // Verify owner
    const owner = await escrow.owner();
    console.log("👑 Contract owner:", owner);

    // Save deployment information
    const deploymentInfo = {
      contractAddress: escrowAddress,
      txHash: escrow.deployTransaction.hash,
      deployer: deployer.address,
      cesTokenAddress: CES_TOKEN_ADDRESS,
      network: hre.network.name,
      deployedAt: new Date().toISOString(),
      gasUsed: "Pending confirmation"
    };

    // Ensure deployment directory exists
    const deploymentDir = path.join(__dirname, '../deployment');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    // Save deployment info
    const deploymentPath = path.join(deploymentDir, 'escrow-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("💾 Deployment info saved to:", deploymentPath);

    // Update .env file with contract address
    await updateEnvFile(escrowAddress);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("1. ✅ Contract address added to .env file");
    console.log("2. ✅ USE_SMART_CONTRACT_ESCROW set to true");
    console.log("3. 🧪 Test the escrow functionality");
    console.log("4. 🔍 Verify contract on PolygonScan");

    // Contract verification info
    console.log("\n🔍 To verify on PolygonScan:");
    console.log(`1. Go to https://polygonscan.com/address/${escrowAddress}#code`);
    console.log("2. Click 'Verify and Publish'");
    console.log("3. Select 'Solidity (Single file)'");
    console.log("4. Upload contracts/P2PEscrow.sol");
    console.log(`5. Constructor arguments: ${CES_TOKEN_ADDRESS}`);

    return {
      address: escrowAddress,
      txHash: escrow.deployTransaction.hash,
      deployer: deployer.address
    };

  } catch (error) {
    console.error("\n💥 Deployment failed:", error.message);
    throw error;
  }
}

/**
 * Update .env file with contract address
 */
async function updateEnvFile(contractAddress) {
  try {
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';

    // Read existing .env file
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add ESCROW_CONTRACT_ADDRESS
    const escrowAddressRegex = /^ESCROW_CONTRACT_ADDRESS=.*$/m;
    const escrowAddressLine = `ESCROW_CONTRACT_ADDRESS=${contractAddress}`;

    if (escrowAddressRegex.test(envContent)) {
      envContent = envContent.replace(escrowAddressRegex, escrowAddressLine);
    } else {
      envContent += `\n${escrowAddressLine}`;
    }

    // Ensure USE_SMART_CONTRACT_ESCROW is set to true
    const useSmartContractRegex = /^USE_SMART_CONTRACT_ESCROW=.*$/m;
    const useSmartContractLine = `USE_SMART_CONTRACT_ESCROW=true`;

    if (useSmartContractRegex.test(envContent)) {
      envContent = envContent.replace(useSmartContractRegex, useSmartContractLine);
    } else {
      envContent += `\n${useSmartContractLine}`;
    }

    // Write updated .env file
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log("✅ .env file updated with contract address");

  } catch (error) {
    console.error("⚠️  Failed to update .env file:", error.message);
    console.log(`Please manually add: ESCROW_CONTRACT_ADDRESS=${contractAddress}`);
    console.log(`Please manually set: USE_SMART_CONTRACT_ESCROW=true`);
  }
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n💥 Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main };