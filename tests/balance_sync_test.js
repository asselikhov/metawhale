/**
 * Balance Synchronization Test
 * Test that user balances are properly synchronized with blockchain
 */

const { expect } = require('chai');
const { connectDatabase, disconnectDatabase, User } = require('../src/database/models');
const walletService = require('../src/services/walletService');

describe('Balance Synchronization', () => {
  before(async () => {
    await connectDatabase();
  });

  after(async () => {
    await disconnectDatabase();
  });

  it('should sync user balance with real blockchain balance', async () => {
    const USER_CHAT_ID = '942851377';
    const TARGET_WALLET = '0x1A1432d6D4eFe75651f2c39DC1Ec6a5D936f401d';
    
    // Get user from database
    const user = await User.findOne({ chatId: USER_CHAT_ID });
    expect(user).to.not.be.null;
    expect(user.walletAddress).to.equal(TARGET_WALLET);
    
    // Get real blockchain balances
    const realCESBalance = await walletService.getCESBalance(TARGET_WALLET);
    const realPOLBalance = await walletService.getPOLBalance(TARGET_WALLET);
    
    // Check that database balances match blockchain
    expect(user.cesBalance).to.equal(realCESBalance);
    expect(user.polBalance).to.equal(realPOLBalance);
    
    // Check that protection is disabled
    expect(user.balanceProtectionEnabled).to.be.false;
    expect(user.adminAllocationAmount).to.equal(0);
    expect(user.adminProtected).to.be.false;
    expect(user.skipBalanceSync).to.be.false;
    expect(user.manualBalance).to.be.false;
    
    // Check wallet service returns correct balances
    const walletInfo = await walletService.getUserWallet(USER_CHAT_ID);
    expect(walletInfo.cesBalance).to.equal(realCESBalance);
    expect(walletInfo.polBalance).to.equal(realPOLBalance);
    expect(walletInfo.protected).to.be.undefined; // Protection should be disabled
  });
});