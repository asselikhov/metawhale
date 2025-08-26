/**
 * Script to check smart contract escrow status
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade } = require('../src/database/models');
const { ethers } = require('ethers');

const SELLER_CHAT_ID = '942851377'; // Алексей chat ID from the logs

async function checkSmartContractEscrowStatus() {
  try {
    console.log('🔍 CHECKING SMART CONTRACT ESCROW STATUS');
    console.log('========================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Find the seller user
    console.log(`\n🔍 Looking for seller user with chatId ${SELLER_CHAT_ID}...`);
    const seller = await User.findOne({ chatId: SELLER_CHAT_ID });
    
    if (!seller) {
      console.log('❌ Seller user not found');
      return;
    }
    
    console.log(`\n👤 SELLER DETAILS:`);
    console.log(`   - Name: ${seller.firstName} (${seller.chatId})`);
    console.log(`   - Wallet: ${seller.walletAddress}`);
    
    // Find the active trade
    console.log(`\n🔍 Looking for active trade with payment_made status...`);
    const trade = await P2PTrade.findOne({
      sellerId: seller._id,
      status: 'payment_made'
    }).populate('buyerId').populate('sellerId');
    
    if (!trade) {
      console.log('❌ No trade with payment_made status found');
      return;
    }
    
    console.log(`\n📋 FOUND TRADE:`);
    console.log(`   - Trade ID: ${trade._id}`);
    console.log(`   - Status: ${trade.status}`);
    console.log(`   - Amount: ${trade.amount} CES`);
    console.log(`   - Buyer: ${trade.buyerId.firstName} (${trade.buyerId.chatId})`);
    console.log(`   - Seller: ${trade.sellerId.firstName} (${trade.sellerId.chatId})`);
    
    // Check smart contract configuration
    const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
    const cesTokenAddress = process.env.CES_TOKEN_ADDRESS;
    
    console.log(`\n🔧 SMART CONTRACT CONFIGURATION:`);
    console.log(`   - Escrow Contract: ${escrowContractAddress}`);
    console.log(`   - CES Token: ${cesTokenAddress}`);
    
    if (!escrowContractAddress || !cesTokenAddress) {
      console.log('❌ Smart contract addresses not configured');
      return;
    }
    
    // Connect to blockchain
    const config = require('../src/config/configuration');
    const provider = new ethers.providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    
    // ABI for escrow contract
    const escrowAbi = [
      "function getEscrowDetails(uint256 escrowId) external view returns (address seller, address buyer, uint256 amount, uint256 timelock, uint8 status)",
      "function nextEscrowId() external view returns (uint256)"
    ];
    
    // ABI for CES token
    const erc20Abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    
    const escrowContract = new ethers.Contract(escrowContractAddress, escrowAbi, provider);
    const cesContract = new ethers.Contract(cesTokenAddress, erc20Abi, provider);
    
    // Check seller's real balance
    const sellerBalance = await cesContract.balanceOf(seller.walletAddress);
    const decimals = await cesContract.decimals();
    const formattedSellerBalance = ethers.utils.formatUnits(sellerBalance, decimals);
    
    console.log(`\n💰 SELLER BLOCKCHAIN BALANCE:`);
    console.log(`   - Real Balance: ${formattedSellerBalance} CES`);
    
    // Check if there's a smart contract escrow ID for this trade
    const { EscrowTransaction } = require('../src/database/models');
    const escrowTx = await EscrowTransaction.findOne({
      userId: seller._id,
      tradeId: trade._id,
      type: 'lock',
      smartContractEscrowId: { $exists: true, $ne: null }
    });
    
    if (!escrowTx) {
      console.log(`\n❌ No smart contract escrow transaction found for this trade`);
      return;
    }
    
    const escrowId = parseInt(escrowTx.smartContractEscrowId);
    console.log(`\n🔍 SMART CONTRACT ESCROW DETAILS:`);
    console.log(`   - Escrow ID: ${escrowId}`);
    console.log(`   - Database Record: ${escrowTx._id}`);
    
    try {
      // Get escrow details from smart contract
      const escrowDetails = await escrowContract.getEscrowDetails(escrowId);
      const [escrowSeller, escrowBuyer, amount, timelock, status] = escrowDetails;
      
      const formattedAmount = ethers.utils.formatUnits(amount, decimals);
      const statusNames = ['Active', 'Released', 'Refunded', 'Disputed'];
      const statusName = statusNames[status] || 'Unknown';
      
      console.log(`\n📋 SMART CONTRACT ESCROW STATUS:`);
      console.log(`   - Seller: ${escrowSeller}`);
      console.log(`   - Buyer: ${escrowBuyer}`);
      console.log(`   - Amount: ${formattedAmount} CES`);
      console.log(`   - Status: ${statusName} (${status})`);
      console.log(`   - Timelock: ${new Date(timelock * 1000).toLocaleString('ru-RU')}`);
      console.log(`   - Expired: ${Date.now() > timelock * 1000 ? 'YES' : 'NO'}`);
      
      // Compare with database
      console.log(`\n📊 COMPARISON:`);
      console.log(`   - Database Trade Amount: ${trade.amount} CES`);
      console.log(`   - Smart Contract Amount: ${formattedAmount} CES`);
      console.log(`   - Match: ${Math.abs(trade.amount - parseFloat(formattedAmount)) < 0.0001 ? 'YES' : 'NO'}`);
      
      if (status !== 0) { // Not Active
        console.log(`\n⚠️ WARNING: Escrow is not in Active status!`);
        console.log(`   This means the tokens are no longer locked and cannot be released.`);
        console.log(`   Status: ${statusName} (${status})`);
      }
      
    } catch (contractError) {
      console.log(`\n❌ Error reading escrow details from smart contract: ${contractError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking smart contract escrow status:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  checkSmartContractEscrowStatus().catch(console.error);
}

module.exports = { checkSmartContractEscrowStatus };