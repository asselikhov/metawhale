const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const messageHandler = require('../handlers/messageHandler');
const p2pService = require('../services/p2pService');

describe('P2P Orders Cancel Functionality', function() {
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

    // Create mock orders data with active orders
    mockOrders = [
      {
        _id: 'order1',
        type: 'buy',
        amount: 100,
        pricePerToken: 10,
        status: 'active',
        createdAt: new Date(),
        userId: {
          _id: 'user1',
          username: 'testuser1',
          trustScore: 800
        }
      },
      {
        _id: 'order2',
        type: 'sell',
        amount: 50,
        pricePerToken: 12,
        status: 'partial',
        createdAt: new Date(),
        userId: {
          _id: 'user2',
          username: 'testuser2',
          trustScore: 900
        }
      },
      {
        _id: 'order3',
        type: 'buy',
        amount: 75,
        pricePerToken: 11,
        status: 'completed',
        createdAt: new Date(),
        userId: {
          _id: 'user3',
          username: 'testuser3',
          trustScore: 700
        }
      }
    ];

    // Stub p2pService.getUserOrders
    sinon.stub(p2pService, 'getUserOrders').resolves(mockOrders);
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  it('should display my orders with cancel buttons for active orders', async function() {
    await messageHandler.handleP2PMyOrders(ctx);
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains order information
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('МОИ ОРДЕРА');
    expect(replyArgs[0]).to.include('100.00 CES по ₽ 10.00');
    expect(replyArgs[0]).to.include('50.00 CES по ₽ 12.00');
    expect(replyArgs[0]).to.include('75.00 CES по ₽ 11.00');
    expect(replyArgs[0]).to.include('Активен');
    expect(replyArgs[0]).to.include('Частично исполнен');
    expect(replyArgs[0]).to.include('Исполнен');
    
    // Check that keyboard contains cancel buttons for active orders
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    expect(keyboard).to.have.lengthOf(3); // Two cancel buttons + back button
    expect(keyboard[0][0].text).to.include('❌ Отменить ордер #order1');
    expect(keyboard[0][0].callback_data).to.include('cancel_order_order1');
    expect(keyboard[1][0].text).to.include('❌ Отменить ордер #order2');
    expect(keyboard[1][0].callback_data).to.include('cancel_order_order2');
    expect(keyboard[2][0].text).to.equal('🔙 Назад');
  });

  it('should show cancel confirmation when cancel button is pressed', async function() {
    ctx.callbackQuery.data = 'cancel_order_order1';
    
    // Mock the handleCancelOrder function call
    await messageHandler.handleCancelOrder(ctx, 'order1');
    
    // Check that reply was called
    expect(ctx.reply.calledOnce).to.be.true;
    
    // Check that message contains confirmation
    const replyArgs = ctx.reply.firstCall.args;
    expect(replyArgs[0]).to.include('Подтверждение отмены ордера');
    expect(replyArgs[0]).to.include('Вы уверены, что хотите отменить ордер #order1');
    
    // Check that keyboard contains confirmation buttons
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    expect(keyboard).to.have.lengthOf(2); // Confirm and cancel buttons
    expect(keyboard[0][0].text).to.include('✅ Да, отменить');
    expect(keyboard[0][0].callback_data).to.include('confirm_cancel_order_order1');
    expect(keyboard[1][0].text).to.include('❌ Нет, вернуться');
    expect(keyboard[1][0].callback_data).to.equal('p2p_my_orders');
  });
});