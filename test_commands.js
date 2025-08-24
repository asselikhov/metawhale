/**
 * Simple test script to verify bot command handling
 */

const config = require('./src/config/configuration');
const { Telegraf } = require('telegraf');

// Create a simple test bot instance
const bot = new Telegraf(config.telegram.botToken);

// Handle the /start command
bot.start((ctx) => {
  console.log('Received /start command from:', ctx.from.username || ctx.from.first_name);
  ctx.reply('Hello! This is a test response to the /start command.');
});

// Handle the /price command
bot.command('price', (ctx) => {
  console.log('Received /price command from:', ctx.from.username || ctx.from.first_name);
  ctx.reply('This is a test response to the /price command.');
});

// Handle text messages
bot.on('text', (ctx) => {
  console.log('Received text message:', ctx.message.text, 'from:', ctx.from.username || ctx.from.first_name);
  ctx.reply(`You said: ${ctx.message.text}`);
});

// Handle callback queries (button presses)
bot.on('callback_query', (ctx) => {
  console.log('Received callback query:', ctx.callbackQuery.data, 'from:', ctx.from.username || ctx.from.first_name);
  ctx.reply(`You pressed a button with data: ${ctx.callbackQuery.data}`);
  // Answer the callback query to remove the loading indicator
  ctx.answerCbQuery();
});

console.log('Test bot started in polling mode. Send /start or /price commands to test.');
console.log('Press Ctrl+C to stop.');

// Start the bot in polling mode
bot.launch()
  .then(() => {
    console.log('Bot is running...');
  })
  .catch((error) => {
    console.error('Failed to start bot:', error);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));