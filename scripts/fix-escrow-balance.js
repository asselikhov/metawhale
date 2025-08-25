/**
 * Fix Escrow Balance Script
 * Исправляет несоответствие между реальным балансом и заблокированным в эскроу
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, EscrowTransaction, P2PTrade, P2POrder } = require('../src/database/models');

// Import walletService functions directly instead of using the service
const { ethers } = require('ethers');
const config = require('../src/config/configuration');

// Function to get CES balance directly
async function getCESBalance(address) {
  try {
    console.log(`🔍 Checking real CES balance for address: ${address}`);
    
    const provider = new ethers.providers.JsonRpcProvider(config.wallet.polygonRpcUrl);
    provider.pollingInterval = 10000;
    
    const erc20Abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    
    const contract = new ethers.Contract(
      config.wallet.cesContractAddress, 
      erc20Abi, 
      provider
    );
    
    const balancePromise = Promise.race([
      Promise.all([
        contract.balanceOf(address),
        contract.decimals()
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), 15000)
      )
    ]);
    
    const [balance, decimals] = await balancePromise;
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    
    console.log(`💰 Real CES balance for ${address}: ${formattedBalance} CES`);
    return parseFloat(formattedBalance);
    
  } catch (error) {
    console.error('Error getting CES balance from blockchain:', error.message);
    console.log(`ℹ️ Returning 0 balance for new/empty wallet: ${address}`);
    return 0;
  }
}

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixUserEscrowBalance(chatId) {
  try {
    console.log(`\n🔍 Checking user balance for chatId: ${chatId}`);
    
    // Найти пользователя
    const user = await User.findOne({ chatId });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`📋 User: ${user.firstName} ${user.lastName} (${user.chatId})`);
    console.log(`📍 Wallet: ${user.walletAddress}`);
    
    // Получить реальный баланс из блокчейна
    let realCESBalance = 0;
    if (user.walletAddress) {
      try {
        realCESBalance = await getCESBalance(user.walletAddress);
        console.log(`💰 Real blockchain CES balance: ${realCESBalance}`);
      } catch (error) {
        console.log('⚠️ Could not get blockchain balance:', error.message);
      }
    }
    
    // Текущий баланс в базе данных
    console.log(`📊 Current database state:`);
    console.log(`   - cesBalance: ${user.cesBalance || 0}`);
    console.log(`   - escrowCESBalance: ${user.escrowCESBalance || 0}`);
    
    // Найти активные эскроу транзакции
    const activeEscrowTxs = await EscrowTransaction.find({
      userId: user._id,
      tokenType: 'CES',
      status: { $in: ['locked', 'pending'] }
    });
    
    console.log(`🔒 Active escrow transactions: ${activeEscrowTxs.length}`);
    let totalActiveEscrow = 0;
    
    for (const tx of activeEscrowTxs) {
      console.log(`   - ${tx._id}: ${tx.amount} CES (${tx.status}) - ${tx.reason}`);
      totalActiveEscrow += tx.amount;
    }
    
    console.log(`📈 Total should be escrowed: ${totalActiveEscrow} CES`);
    
    // Найти активные P2P ордера и сделки
    const activeOrders = await P2POrder.find({
      userId: user._id,
      type: 'sell',
      status: { $in: ['active', 'partial'] },
      escrowLocked: true
    });
    
    console.log(`📋 Active sell orders: ${activeOrders.length}`);
    let totalOrderEscrow = 0;
    
    for (const order of activeOrders) {
      console.log(`   - Order ${order._id}: ${order.escrowAmount || order.remainingAmount} CES`);
      totalOrderEscrow += (order.escrowAmount || order.remainingAmount);
    }
    
    // Найти активные сделки где пользователь - продавец
    const activeTrades = await P2PTrade.find({
      sellerId: user._id,
      status: { $in: ['escrow_locked', 'payment_pending', 'payment_made'] },
      escrowStatus: 'locked'
    });
    
    console.log(`💼 Active trades as seller: ${activeTrades.length}`);
    let totalTradeEscrow = 0;
    
    for (const trade of activeTrades) {
      console.log(`   - Trade ${trade._id}: ${trade.amount} CES (${trade.status})`);
      totalTradeEscrow += trade.amount;
    }
    
    // Вычисляем правильный баланс эскроу
    const correctEscrowBalance = Math.max(totalActiveEscrow, totalOrderEscrow, totalTradeEscrow);
    console.log(`\n📊 Analysis:`);
    console.log(`   - Real blockchain balance: ${realCESBalance} CES`);
    console.log(`   - Should be escrowed: ${correctEscrowBalance} CES`);
    console.log(`   - Currently recorded escrow: ${user.escrowCESBalance || 0} CES`);
    console.log(`   - Available should be: ${Math.max(0, realCESBalance - correctEscrowBalance)} CES`);
    
    // Если есть расхождение - исправляем
    if (user.escrowCESBalance !== correctEscrowBalance) {
      console.log(`\n🔧 FIXING: Updating escrow balance from ${user.escrowCESBalance || 0} to ${correctEscrowBalance}`);
      
      user.escrowCESBalance = correctEscrowBalance;
      user.cesBalance = realCESBalance; // Обновляем и реальный баланс
      user.lastBalanceUpdate = new Date();
      
      await user.save();
      
      console.log('✅ Balance fixed successfully!');
    } else {
      console.log('✅ Balance is already correct');
    }
    
    // Показать итоговое состояние
    console.log(`\n📋 Final state:`);
    console.log(`   - Real CES balance: ${realCESBalance} CES`);
    console.log(`   - Escrowed CES balance: ${correctEscrowBalance} CES`);
    console.log(`   - Available CES balance: ${Math.max(0, realCESBalance - correctEscrowBalance)} CES`);
    
  } catch (error) {
    console.error('❌ Error fixing balance:', error);
  }
}

async function main() {
  console.log('🔧 CES Escrow Balance Fixer');
  console.log('===========================\n');
  
  await connectToDatabase();
  
  // Получаем chatId из аргументов командной строки
  const chatId = process.argv[2];
  
  if (!chatId) {
    console.log('❌ Usage: node scripts/fix-escrow-balance.js <chatId>');
    console.log('📝 Example: node scripts/fix-escrow-balance.js 942851377');
    process.exit(1);
  }
  
  await fixUserEscrowBalance(chatId);
  
  console.log('\n✅ Script completed');
  await mongoose.disconnect();
  process.exit(0);
}

// Запуск скрипта
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixUserEscrowBalance };