/**
 * Message Handler
 * Centralized message handling for the Telegram bot
 */

const MessageHandlerImpl = require('../../handlers/messageHandler');

class MessageHandler {
  constructor() {
    this.handler = new MessageHandlerImpl();
  }

  async handleStart(ctx) {
    return this.handler.handleStart(ctx);
  }

  async handlePrice(ctx, tokenSymbol = 'CES') {
    return this.handler.handlePrice(ctx, tokenSymbol);
  }
}

module.exports = MessageHandler;