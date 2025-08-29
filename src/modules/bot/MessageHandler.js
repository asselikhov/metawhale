/**
 * Message Handler
 * Centralized message handling for the Telegram bot
 */

const { Markup } = require('telegraf');

class MessageHandler {
  async handleStart(ctx) {
    try {
      const welcomeMessage = `
🚀 Добро пожаловать в CES Price Bot!

📈 Получите актуальную информацию о цене токена CES
📊 Красивые графики и исторические данные
💼 Управление кошельком и переводы
🔄 P2P торговля токенами

Команды:
/ces - Текущая цена CES
/pol - Текущая цена POL
/trx - Текущая цена TRX
и много других...

Нажмите кнопку ниже, чтобы открыть личный кабинет:
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👤 Личный кабинет', 'personal_cabinet')],
        [Markup.button.callback('🔄 P2P Биржа', 'p2p_menu')]
      ]);

      await ctx.reply(welcomeMessage, keyboard);
    } catch (error) {
      console.error('Error in handleStart:', error);
      await ctx.reply('❌ Ошибка обработки команды. Попробуйте позже.');
    }
  }

  async handlePrice(ctx, tokenSymbol = 'CES') {
    try {
      // This is a simplified version - in a full implementation,
      // you would include the price fetching and chart generation logic
      const message = `📈 Цена ${tokenSymbol}: $0.0000 (暂无数据)
      
Для получения актуальной цены используйте команду /${tokenSymbol.toLowerCase()}`;

      await ctx.reply(message);
    } catch (error) {
      console.error(`Error in handlePrice for ${tokenSymbol}:`, error);
      await ctx.reply('❌ Ошибка получения цены. Попробуйте позже.');
    }
  }
}

module.exports = MessageHandler;