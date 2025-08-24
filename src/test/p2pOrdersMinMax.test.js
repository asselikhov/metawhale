const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const messageHandler = require('../handlers/messageHandler');
const p2pService = require('../services/p2pService');

describe('P2P Orders Min/Max Display', function() {
  let ctx;
  let mockOrders;

  beforeEach(function() {
    // Create mock context
    ctx = {
      chat: { id: '123456' },
      reply: sinon.spy()
    };

    // Create mock orders data with min/max amounts
    mockOrders = {
      buyOrders: [
        {
          _id: '1',
          remainingAmount: 100,
          pricePerToken: 10,
          minTradeAmount: 5,
          maxTradeAmount: 50,
          userId: {
            _id: 'user1',
            username: 'testuser1',
            trustScore: 800
          }
        }
      ],
      sellOrders: [
        {
          _id: '2',
          remainingAmount: 50,
          pricePerToken: 12,
          minTradeAmount: 2,
          maxTradeAmount: 30,
          userId: {
            _id: 'user2',
            username: 'testuser2',
            trustScore: 900
          }
        }
      ],
      buyOrdersCount: 1,
      sellOrdersCount: 1
    };

    // Stub p2pService.getMarketOrders
    sinon.stub(p2pService, 'getMarketOrders').resolves(mockOrders);
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  it('should display buy orders with min/max amounts', async function() {
    await messageHandler.handleP2PBuyOrders(ctx, 1);
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information with min/max amounts
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('ЗАЯВКИ НА ПОКУПКУ');
    expect(replyArgs[0]).to.include('₽ 10.00 / CES @testuser1 800/1000');
    expect(replyArgs[0]).to.include('Лимит: 5.00 - 50.00 CES');
  });

  it('should display sell orders with min/max amounts', async function() {
    await messageHandler.handleP2PSellOrders(ctx, 1);
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information with min/max amounts
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('ЗАЯВКИ НА ПРОДАЖУ');
    expect(replyArgs[0]).to.include('₽ 12.00 / CES @testuser2 900/1000');
    expect(replyArgs[0]).to.include('Лимит: 2.00 - 30.00 CES');
  });

  it('should display default min amount when minTradeAmount is not set', async function() {
    // Modify mock data to remove minTradeAmount
    mockOrders.buyOrders[0].minTradeAmount = undefined;
    // Set maxTradeAmount to remainingAmount when minTradeAmount is not set
    mockOrders.buyOrders[0].maxTradeAmount = mockOrders.buyOrders[0].remainingAmount;
    p2pService.getMarketOrders.restore();
    sinon.stub(p2pService, 'getMarketOrders').resolves(mockOrders);
    
    await messageHandler.handleP2PBuyOrders(ctx, 1);
    
    // Check that message contains default min amount
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('Лимит: 1.00 - 100.00 CES');
  });
});