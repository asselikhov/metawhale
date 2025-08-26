/**
 * Script to recover stuck escrow tokens using admin privileges
 */

const { connectDatabase } = require('../src/database/models');
const { User } = require('../src/database/models');
const { ethers } = require('ethers');
const smartContractService = require('../src/services/smartContractService');

async function recoverEscrowTokens(escrowId, adminPrivateKey) {
  console.log(`🔄 Recovering escrow ID: ${escrowId} using admin privileges`);
  
  try {
    // Create provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    
    console.log(`✅ Admin wallet: ${adminWallet.address}`);
    
    // Create contract instance
    const escrowContract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS || '0x04B16d50949CD92de90fbadcF49745897CbED5C4',
      smartContractService.escrowABI,
      adminWallet
    );
    
    // Check escrow details first
    console.log(`🔍 Checking escrow details...`);
    const details = await smartContractService.getEscrowDetails(escrowId);
    console.log(`   Status: ${smartContractService.getEscrowStatusText(details.status)} (${details.status})`);
    console.log(`   Amount: ${details.amount} CES`);
    console.log(`   Seller: ${details.seller}`);
    console.log(`   Buyer: ${details.buyer}`);
    
    // Try to recover the escrow
    console.log(`💸 Attempting to recover escrow...`);
    
    // Get current gas price
    const gasPrice = await provider.getGasPrice();
    console.log(`   Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    
    // Send transaction to recover escrow
    const tx = await escrowContract.refundEscrow(escrowId, {
      gasLimit: 300000,
      gasPrice: gasPrice.mul(120).div(100) // 20% higher gas price
    });
    
    console.log(`   Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    console.log(`   Waiting for confirmation...`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`✅ Successfully recovered escrow ID: ${escrowId}`);
      console.log(`   Transaction hash: ${tx.hash}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      
      return { success: true, txHash: tx.hash, amount: details.amount };
    } else {
      console.log(`❌ Failed to recover escrow - transaction reverted`);
      return { success: false, reason: 'Transaction reverted' };
    }
    
  } catch (error) {
    console.error(`❌ Error recovering escrow: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function recoverAllStuckTokens() {
  console.log('🔄 Recovering all stuck escrow tokens using admin privileges');
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Get admin private key from environment
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
    }
    
    // Define stuck escrows that need recovery
    // Based on our investigation, escrow 14 is still active and can be refunded
    const stuckEscrows = ['14'];
    
    console.log(`📋 Attempting recovery for ${stuckEscrows.length} escrows:`);
    
    let totalRecovered = 0;
    let recoveryResults = [];
    
    for (const escrowId of stuckEscrows) {
      console.log(`\n--- Recovering Escrow ${escrowId} ---`);
      const result = await recoverEscrowTokens(escrowId, adminPrivateKey);
      recoveryResults.push({
        escrowId,
        ...result
      });
      
      if (result.success) {
        totalRecovered += parseFloat(result.amount);
      }
    }
    
    console.log(`\n📊 Recovery Summary:`);
    console.log(`   Total escrows attempted: ${stuckEscrows.length}`);
    console.log(`   Total successfully recovered: ${totalRecovered} CES`);
    
    console.log(`\n📋 Detailed Results:`);
    for (const result of recoveryResults) {
      if (result.success) {
        console.log(`   ✅ Escrow ${result.escrowId}: Successfully recovered ${result.amount} CES`);
        console.log(`      Transaction: ${result.txHash}`);
      } else {
        console.log(`   ❌ Escrow ${result.escrowId}: Failed - ${result.reason}`);
      }
    }
    
    return recoveryResults;
    
  } catch (error) {
    console.error('❌ Error recovering stuck tokens:', error);
    throw error;
  }
}

// Function to transfer CES tokens directly to user
async function transferTokensToUser(userWalletAddress, amount) {
  console.log(`💸 Transferring ${amount} CES directly to user ${userWalletAddress}`);
  
  try {
    // Get admin private key
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
    }
    
    // Create provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    
    console.log(`✅ Admin wallet: ${adminWallet.address}`);
    
    // Create CES token contract instance
    const cesTokenAddress = process.env.CES_TOKEN_ADDRESS || '0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610';
    const erc20Abi = [
      "function transfer(address to, uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)"
    ];
    
    const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, adminWallet);
    
    // Check admin balance first
    const adminBalance = await cesContract.balanceOf(adminWallet.address);
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    console.log(`   Admin CES balance: ${ethers.utils.formatEther(adminBalance)} CES`);
    console.log(`   Transfer amount: ${amount} CES`);
    
    if (adminBalance.lt(amountWei)) {
      throw new Error(`Insufficient CES balance. Available: ${ethers.utils.formatEther(adminBalance)}, required: ${amount}`);
    }
    
    // Transfer tokens
    console.log(`   Sending transfer transaction...`);
    const tx = await cesContract.transfer(userWalletAddress, amountWei, {
      gasLimit: 100000,
      gasPrice: (await provider.getGasPrice()).mul(120).div(100)
    });
    
    console.log(`   Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    console.log(`   Waiting for confirmation...`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`✅ Successfully transferred ${amount} CES to ${userWalletAddress}`);
      console.log(`   Transaction hash: ${tx.hash}`);
      return { success: true, txHash: tx.hash };
    } else {
      console.log(`❌ Failed to transfer tokens - transaction reverted`);
      return { success: false, reason: 'Transaction reverted' };
    }
    
  } catch (error) {
    console.error(`❌ Error transferring tokens: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

// Main recovery function
async function main() {
  console.log('🔄 Admin Escrow Recovery Script');
  console.log('=============================');
  
  try {
    // First try to recover stuck escrows
    console.log(' Phase 1: Recovering stuck escrows using admin privileges');
    const recoveryResults = await recoverAllStuckTokens();
    
    // Check how many were successfully recovered
    const successfulRecoveries = recoveryResults.filter(r => r.success);
    const totalRecovered = successfulRecoveries.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    
    console.log(`\n Phase 1 completed: ${successfulRecoveries.length} escrows recovered with ${totalRecovered} CES`);
    
    // Transfer 1 CES directly to user to complete the recovery
    console.log(`\n Phase 2: Transferring 1 CES directly to user to complete recovery`);
    
    // Get user wallet address
    await connectDatabase();
    const user = await User.findOne({ chatId: '942851377' });
    if (!user) {
      throw new Error('User not found');
    }
    
    const transferResult = await transferTokensToUser(user.walletAddress, 1);
    if (transferResult.success) {
      console.log(`✅ Successfully transferred 1 CES to user`);
    } else {
      console.log(`❌ Failed to transfer 1 CES to user: ${transferResult.reason}`);
    }
    
    console.log('\n✅ Recovery process completed');
    return { recoveryResults, transferResult };
    
  } catch (error) {
    console.error('❌ Recovery process failed:', error.message);
    throw error;
  }
}

// Run the script if executed directly
if (require.main === module) {
  main().then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Script failed with error:', error);
    process.exit(1);
  });
}

module.exports = { recoverAllStuckTokens, transferTokensToUser };