const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const messageHandler = require('../handlers/messageHandler');
const p2pService = require('../services/p2p');

describe('P2P Orders Create with Min/Max Amounts', function() {
  let ctx;

  beforeEach(function() {
    // Create mock context
    ctx = {
      chat: { id: '123456' },
      reply: sinon.spy(),
      callbackQuery: {
        data: ''
      }
    };
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  it('should process P2P order with min/max amounts', async function() {
    // Test data with min/max amounts
    const orderData = '10 250.50 1 5';
    
    // Stub the User.findOne method
    const mockUser = { 
      _id: 'user1',
      walletAddress: '0x123',
      chatId: '123456'
    };
    
    sinon.stub(require('../database/models'), 'User').value({
      findOne: sinon.stub().resolves(mockUser)
    });
    
    // Stub the p2pService.createBuyOrder method
    sinon.stub(p2pService, 'createBuyOrder').resolves({
      _id: 'order1',
      amount: 10,
      pricePerToken: 250.50,
      minTradeAmount: 1,
      maxTradeAmount: 5
    });
    
    await messageHandler.processP2POrder(ctx, orderData, 'buy');
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information with min/max amounts
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('Подтверждение ордера на покупку');
    expect(replyArgs[0]).to.include('Мин. сумма: 1 CES');
    expect(replyArgs[0]).to.include('Макс. сумма: 5 CES');
    
    // Check that keyboard contains confirmation button with min/max data
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    expect(keyboard[0][0].text).to.include('✅ Подтвердить');
    expect(keyboard[0][0].callback_data).to.include('confirm_p2p_order_buy_10_250.5_1_5');
  });

  it('should process P2P order with default min/max amounts when not specified', async function() {
    // Test data without min/max amounts
    const orderData = '10 250.50';
    
    // Stub the User.findOne method
    const mockUser = { 
      _id: 'user1',
      walletAddress: '0x123',
      chatId: '123456'
    };
    
    sinon.stub(require('../database/models'), 'User').value({
      findOne: sinon.stub().resolves(mockUser)
    });
    
    // Stub the p2pService.createBuyOrder method
    sinon.stub(p2pService, 'createBuyOrder').resolves({
      _id: 'order1',
      amount: 10,
      pricePerToken: 250.50,
      minTradeAmount: 1,
      maxTradeAmount: 10
    });
    
    await messageHandler.processP2POrder(ctx, orderData, 'buy');
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information with default min/max amounts
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('Подтверждение ордера на покупку');
    expect(replyArgs[0]).to.include('Мин. сумма: 1 CES');
    expect(replyArgs[0]).to.include('Макс. сумма: 10 CES');
  });

  it('should show error for invalid min/max amounts', async function() {
    // Test data with invalid min/max amounts (min > max)
    const orderData = '10 250.50 5 1';
    
    await messageHandler.processP2POrder(ctx, orderData, 'buy');
    
    // Check that reply was called with error message
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that error message is correct
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('Минимальная сумма не может быть больше максимальной');
  });
});