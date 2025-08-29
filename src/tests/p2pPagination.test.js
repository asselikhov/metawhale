const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const messageHandler = require('../handlers/messageHandler');
const p2pService = require('../services/p2p');

describe('P2P Orders Pagination and User Profile', function() {
  let ctx;
  let mockOrders;

  beforeEach(function() {
    // Create mock context
    ctx = {
      chat: { id: '123456' },
      reply: sinon.spy(),
      callbackQuery: {
        data: ''
      }
    };

    // Create mock orders data
    mockOrders = {
      buyOrders: [
        {
          _id: 'buy1',
          type: 'buy',
          amount: 100,
          pricePerToken: 10,
          remainingAmount: 100,
          minTradeAmount: 1,
          maxTradeAmount: 100,
          status: 'active',
          createdAt: new Date(),
          userId: {
            _id: 'user1',
            username: 'testuser1',
            trustScore: 800
          }
        }
      ],
      sellOrders: [
        {
          _id: 'sell1',
          type: 'sell',
          amount: 75,
          pricePerToken: 11,
          remainingAmount: 75,
          minTradeAmount: 10,
          maxTradeAmount: 75,
          status: 'active',
          createdAt: new Date(),
          userId: {
            _id: 'user3',
            username: 'testuser3',
            trustScore: 700
          }
        }
      ],
      buyOrdersCount: 25, // More than 20 to trigger pagination
      sellOrdersCount: 15 // Less than 20, no pagination needed
    };

    // Stub p2pService.getMarketOrders
    sinon.stub(p2pService, 'getMarketOrders').resolves(mockOrders);
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  it('should display buy orders with pagination controls', async function() {
    await messageHandler.handleP2PBuyOrders(ctx, 1);
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information in the correct format
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('ЗАЯВКИ НА ПОКУПКУ');
    expect(replyArgs[0]).to.include('₽ 10.00 / CES @testuser1 800/1000');
    expect(replyArgs[0]).to.include('Лимит: 1.00 - 100.00 CES');
    expect(replyArgs[0]).to.include('[Купить](callback_data:buy_order_user1)');
    
    // Check that keyboard contains pagination controls
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    // With 25 orders and 20 per page, we should have pagination controls
    expect(keyboard).to.have.lengthOf(2); // Pagination controls + back button
    expect(keyboard[1][0].text).to.equal('🔙 Назад');
  });

  it('should display sell orders without pagination controls when not needed', async function() {
    await messageHandler.handleP2PSellOrders(ctx, 1);
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information in the correct format
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('ЗАЯВКИ НА ПРОДАЖУ');
    expect(replyArgs[0]).to.include('₽ 11.00 / CES @testuser3 700/1000');
    expect(replyArgs[0]).to.include('Лимит: 10.00 - 75.00 CES');
    expect(replyArgs[0]).to.include('[Продать](callback_data:sell_order_user3)');
    
    // Check that keyboard contains back button
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    expect(keyboard).to.have.lengthOf(1); // Only back button
    expect(keyboard[0][0].text).to.equal('🔙 Назад');
  });
});