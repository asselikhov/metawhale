/**
 * Test P2P Menu User Rating Display
 * Tests the new P2P menu format with user rating statistics
 */

const { expect } = require('chai');
const sinon = require('sinon');
const MessageHandler = require('../handlers/messageHandler');
const walletService = require('../services/walletService');
const reputationService = require('../services/reputationService');
const { User } = require('../database/models');

describe('P2P Menu User Rating Display', function() {
  let messageHandler;
  let ctx;

  beforeEach(function() {
    messageHandler = new MessageHandler();
    
    // Mock Telegraf context
    ctx = {
      reply: sinon.stub().resolves(),
      chat: { id: 123456789 }
    };

    // Mock wallet info
    const mockWalletInfo = {
      hasWallet: true,
      cesBalance: 100.0,
      polBalance: 5.0
    };

    // Mock user
    const mockUser = {
      _id: 'user123',
      chatId: '123456789',
      username: 'testuser'
    };

    // Mock standardized stats
    const mockStats = {
      rating: '0/1000 🐹',
      ordersLast30Days: 85,
      completionRateLast30Days: 94,
      avgTransferTime: 1,
      avgPaymentTime: 5
    };

    // Stub services
    sinon.stub(walletService, 'getUserWallet').resolves(mockWalletInfo);
    sinon.stub(User, 'findOne').resolves(mockUser);
    sinon.stub(reputationService, 'getStandardizedUserStats').resolves(mockStats);
  });

  afterEach(function() {
    sinon.restore();
  });

  it('should display P2P menu with user rating in correct format', async function() {
    await messageHandler.handleP2PMenu(ctx);
    
    expect(ctx.reply.calledOnce).to.be.true;
    
    const replyArgs = ctx.reply.firstCall.args;
    const message = replyArgs[0];
    const keyboard = replyArgs[1];
    
    // Check message format matches example
    expect(message).to.include('🔄 P2P БИРЖА');
    expect(message).to.include('➖➖➖➖➖➖➖➖➖➖➖');
    expect(message).to.include('Исполненные ордера за 30 дней: 85 шт.');
    expect(message).to.include('Процент исполнения за 30 дней: 94%');
    expect(message).to.include('Среднее время перевода: 1 мин.');
    expect(message).to.include('Среднее время оплаты: 5 мин.');
    expect(message).to.include('Рейтинг: 0/1000 🐹');
    
    // Check keyboard structure
    expect(keyboard.reply_markup.inline_keyboard).to.have.length(3);
    expect(keyboard.reply_markup.inline_keyboard[0]).to.have.length(2); // Buy/Sell buttons
    expect(keyboard.reply_markup.inline_keyboard[1]).to.have.length(2); // Market/My orders
    expect(keyboard.reply_markup.inline_keyboard[2]).to.have.length(2); // Top traders/Analytics
  });

  it('should handle user without wallet correctly', async function() {
    // Override wallet stub to return no wallet
    walletService.getUserWallet.restore();
    sinon.stub(walletService, 'getUserWallet').resolves({ hasWallet: false });
    
    await messageHandler.handleP2PMenu(ctx);
    
    expect(ctx.reply.calledOnce).to.be.true;
    
    const replyArgs = ctx.reply.firstCall.args;
    const message = replyArgs[0];
    
    // Should show wallet creation message
    expect(message).to.include('У вас нет кошелька');
  });

  it('should call standardized user stats service', async function() {
    await messageHandler.handleP2PMenu(ctx);
    
    expect(reputationService.getStandardizedUserStats.calledOnce).to.be.true;
    expect(reputationService.getStandardizedUserStats.calledWith('user123')).to.be.true;
  });
});