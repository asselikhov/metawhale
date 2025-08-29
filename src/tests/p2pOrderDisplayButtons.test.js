/**
 * Test P2P Order Display with Inline Buttons
 * Tests the new order display format and inline button functionality
 */

const { expect } = require('chai');
const sinon = require('sinon');
const MessageHandler = require('../handlers/messageHandler');
const p2pService = require('../services/p2p');
const reputationService = require('../services/reputationService');

describe('P2P Order Display with Inline Buttons', function() {
  let messageHandler;
  let ctx;

  beforeEach(function() {
    messageHandler = new MessageHandler();
    
    // Mock Telegraf context
    ctx = {
      reply: sinon.stub().resolves(),
      chat: { id: 123456789 },
      callbackQuery: { data: 'test_callback' }
    };

    // Mock orders data
    const mockOrders = {
      buyOrders: [{
        _id: 'order1',
        userId: {
          _id: 'user1',
          username: 'testuser1',
          firstName: 'Test',
          trustScore: 100
        },
        pricePerToken: 1.00,
        remainingAmount: 4000,
        minTradeAmount: 500,
        maxTradeAmount: 3000
      }],
      sellOrders: [{
        _id: 'order2',
        userId: {
          _id: 'user2',
          username: 'testuser2',
          firstName: 'Test2',
          trustScore: 100
        },
        pricePerToken: 5.00,
        remainingAmount: 10000,
        minTradeAmount: 500,
        maxTradeAmount: 5000
      }],
      buyOrdersCount: 1,
      sellOrdersCount: 1
    };

    // Mock reputation data
    const mockReputation = {
      totalTrades: 0,
      trustScore: 100
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
    sinon.stub(p2pService, 'getMarketOrders').resolves(mockOrders);
    sinon.stub(reputationService, 'getUserReputation').resolves(mockReputation);
    sinon.stub(reputationService, 'getStandardizedUserStats').resolves(mockStats);
  });

  afterEach(function() {
    sinon.restore();
  });

  it('should display buy orders with each order in separate message', async function() {
    await messageHandler.handleP2PBuyOrders(ctx, 1);
    
    // Check that reply was called multiple times (header + individual orders)
    expect(ctx.reply.callCount).to.be.greaterThan(1);
    
    // Check header message
    const firstReplyArgs = ctx.reply.firstCall.args;
    expect(firstReplyArgs[0]).to.include('📈 ОРДЕРА НА ПОКУПКУ');
    
    // Check individual order message
    const secondReplyArgs = ctx.reply.secondCall.args;
    expect(secondReplyArgs[0]).to.include('₽ 5.00 / CES | @testuser2 0/1000 🐹');
    expect(secondReplyArgs[0]).to.include('Количество: 10000.00 CES');
    expect(secondReplyArgs[0]).to.include('Лимиты: 2500.00 - 25000.00 ₽');
    
    // Check that individual order has inline button
    const orderKeyboard = secondReplyArgs[1];
    expect(orderKeyboard.reply_markup.inline_keyboard).to.have.length(1);
    expect(orderKeyboard.reply_markup.inline_keyboard[0][0].text).to.equal('🟩 Купить');
  });

  it('should display sell orders with each order in separate message', async function() {
    await messageHandler.handleP2PSellOrders(ctx, 1);
    
    // Check that reply was called multiple times (header + individual orders)
    expect(ctx.reply.callCount).to.be.greaterThan(1);
    
    // Check header message
    const firstReplyArgs = ctx.reply.firstCall.args;
    expect(firstReplyArgs[0]).to.include('📉 ОРДЕРА НА ПРОДАЖУ');
    
    // Check individual order message
    const secondReplyArgs = ctx.reply.secondCall.args;
    expect(secondReplyArgs[0]).to.include('₽ 1.00 / CES @testuser1 0/1000 🐹');
    expect(secondReplyArgs[0]).to.include('Количество: 4000.00 CES');
    expect(secondReplyArgs[0]).to.include('Лимиты: 500.00 - 3000.00 ₽');
    
    // Check that individual order has inline button
    const orderKeyboard = secondReplyArgs[1];
    expect(orderKeyboard.reply_markup.inline_keyboard).to.have.length(1);
    expect(orderKeyboard.reply_markup.inline_keyboard[0][0].text).to.equal('🟥 Продать');
  });

  it('should handle buy order details display', async function() {
    const { User } = require('../database/models');
    sinon.stub(User, 'findById').resolves({
      _id: 'user1',
      username: 'testuser',
      firstName: 'Test'
    });

    await messageHandler.handleBuyOrderDetails(ctx, 'user1', 'order1');
    
    expect(ctx.reply.calledOnce).to.be.true;
    
    const replyArgs = ctx.reply.firstCall.args;
    const message = replyArgs[0];
    
    // Check detailed info format
    expect(message).to.include('Рейтинг: 0/1000 🐹');
    expect(message).to.include('Исполненные ордера за 30 дней: 85 ордера');
    expect(message).to.include('Процент исполнения за 30 дней: 94%');
    expect(message).to.include('Среднее время перевода: 1 мин.');
  });

  it('should handle sell order details display', async function() {
    const { User } = require('../database/models');
    sinon.stub(User, 'findById').resolves({
      _id: 'user2',
      username: 'testuser2',
      firstName: 'Test2'
    });

    await messageHandler.handleSellOrderDetails(ctx, 'user2', 'order2');
    
    expect(ctx.reply.calledOnce).to.be.true;
    
    const replyArgs = ctx.reply.firstCall.args;
    const message = replyArgs[0];
    
    // Check detailed info format for sell orders
    expect(message).to.include('Рейтинг: 0/1000 🐹');
    expect(message).to.include('Исполненные ордера за 30 дней: 85 ордера');
    expect(message).to.include('Процент исполнения за 30 дней: 94%');
    expect(message).to.include('Среднее время оплаты: 5 мин.');
  });
});