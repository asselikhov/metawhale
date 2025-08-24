const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const messageHandler = require('../handlers/messageHandler');
const p2pService = require('../services/p2pService');

describe('P2P Orders Display', function() {
  let ctx;
  let mockOrders;

  beforeEach(function() {
    // Create mock context
    ctx = {
      chat: { id: '123456' },
      reply: sinon.spy()
    };

    // Create mock orders data
    mockOrders = {
      buyOrders: [
        {
          _id: '1',
          remainingAmount: 100,
          pricePerToken: 10,
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
          userId: {
            _id: 'user2',
            username: 'testuser2',
            trustScore: 900
          }
        }
      ]
    };

    // Stub p2pService.getMarketOrders
    sinon.stub(p2pService, 'getMarketOrders').resolves(mockOrders);
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  it('should display buy orders with interaction buttons', async function() {
    await messageHandler.handleP2PBuyOrders(ctx);
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('ЗАЯВКИ НА ПОКУПКУ');
    expect(replyArgs[0]).to.include('100.00 CES по ₽ 10.00');
    expect(replyArgs[0]).to.include('@testuser1 800/1000');
    
    // Check that keyboard contains interaction button
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    expect(keyboard).to.have.lengthOf(2); // One button for interaction + back button
    expect(keyboard[0][0].text).to.include('Создать сделку с @testuser1');
    expect(keyboard[0][0].callback_data).to.include('create_order_with_user1');
    expect(keyboard[1][0].text).to.equal('🔙 Назад');
  });

  it('should display sell orders with interaction buttons', async function() {
    await messageHandler.handleP2PSellOrders(ctx);
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('ЗАЯВКИ НА ПРОДАЖУ');
    expect(replyArgs[0]).to.include('50.00 CES по ₽ 12.00');
    expect(replyArgs[0]).to.include('@testuser2 900/1000');
    
    // Check that keyboard contains interaction button
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    expect(keyboard).to.have.lengthOf(2); // One button for interaction + back button
    expect(keyboard[0][0].text).to.include('Создать сделку с @testuser2');
    expect(keyboard[0][0].callback_data).to.include('create_order_with_user2');
    expect(keyboard[1][0].text).to.equal('🔙 Назад');
  });
});