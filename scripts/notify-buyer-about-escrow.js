/**
 * Notify Buyer About Escrow Script
 * Отправка уведомления мейкеру о том, что CES токены находятся в эскроу и готовы к получению
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, P2PTrade } = require('../src/database/models');
const { Markup } = require('telegraf');

const BUYER_CHAT_ID = '2131340103'; // Liveliness - мейкер
const SELLER_CHAT_ID = '942851377'; // Алексей - тейкер

async function notifyBuyerAboutEscrow() {
  try {
    console.log('📧 УВЕДОМЛЕНИЕ МЕЙКЕРА ОБ ЭСКРОУ');
    console.log('================================');
    console.log(`🎯 Мейкер (покупатель): ${BUYER_CHAT_ID}`);
    console.log(`🎯 Тейкер (продавец): ${SELLER_CHAT_ID}`);
    console.log('');
    
    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к базе данных установлено');
    
    // Поиск пользователей
    const buyer = await User.findOne({ chatId: BUYER_CHAT_ID });
    const seller = await User.findOne({ chatId: SELLER_CHAT_ID });
    
    if (!buyer || !seller) {
      console.log('❌ Не найден один из пользователей');
      return;
    }
    
    console.log(`\n👤 МЕЙКЕР: ${buyer.firstName} (${buyer.chatId})`);
    console.log(`👤 ТЕЙКЕР: ${seller.firstName} (${seller.chatId})`);
    
    // Поиск активной сделки между ними
    const activeTrade = await P2PTrade.findOne({
      buyerId: buyer._id,
      sellerId: seller._id,
      status: { $in: ['escrow_locked', 'payment_pending'] }
    }).sort({ 'timeTracking.createdAt': -1 });
    
    if (!activeTrade) {
      console.log('❌ Активная сделка между пользователями не найдена');
      return;
    }
    
    console.log(`\n🤝 НАЙДЕНА АКТИВНАЯ СДЕЛКА: ${activeTrade._id}`);
    console.log(`   - Количество: ${activeTrade.amount} CES`);
    console.log(`   - Сумма: ${activeTrade.totalValue} ₽`);
    console.log(`   - Статус: ${activeTrade.status}`);
    console.log(`   - Создана: ${activeTrade.timeTracking.createdAt.toLocaleString('ru-RU')}`);
    
    // Получаем данные для оплаты из профиля продавца
    let sellerName = 'Пользователь';
    let sellerCard = 'Не указано';
    let sellerBank = 'Банк не указан';
    
    if (seller.p2pProfile && seller.p2pProfile.fullName) {
      sellerName = seller.p2pProfile.fullName;
    } else if (seller.firstName) {
      sellerName = seller.firstName;
      if (seller.lastName) {
        sellerName += ` ${seller.lastName}`;
      }
    }
    
    if (seller.p2pProfile && seller.p2pProfile.paymentMethods) {
      const activeMethod = seller.p2pProfile.paymentMethods.find(pm => pm.isActive);
      if (activeMethod) {
        sellerCard = activeMethod.cardNumber || 'Не указано';
        
        const bankNames = {
          'sberbank': 'Сбербанк',
          'vtb': 'ВТБ',
          'gazprombank': 'Газпромбанк',
          'alfabank': 'Альфа-Банк',
          'rshb': 'Россельхозбанк',
          'mkb': 'МКБ',
          'sovcombank': 'Совкомбанк',
          'tbank': 'Т-Банк',
          'domrf': 'ДОМ.РФ',
          'otkritie': 'Открытие',
          'raiffeisenbank': 'Райффайзенбанк',
          'rosbank': 'Росбанк'
        };
        
        sellerBank = bankNames[activeMethod.bank] || activeMethod.bank;
      }
    }
    
    // Создаем номер ордера
    const orderNumber = `CES${Date.now().toString().slice(-8)}`;
    const currentTime = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Рассчитываем время истечения (30 минут от текущего времени)
    const expiryTime = new Date(Date.now() + 30 * 60 * 1000);
    const expiryTimeStr = expiryTime.toLocaleTimeString('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Формируем сообщение для мейкера
    const buyerMessage = `💳 УВЕДОМЛЕНИЕ ОБ ОПЛАТЕ\n` +
                        `⁠⁠⁠⁠⁠⁠⁠⁠⁠⁠\n` +
                        `🔔 Продавец передал вам ${activeTrade.amount} CES в безопасный эскроу!\n\n` +
                        `📋 ДЕТАЛИ СДЕЛКИ:\n` +
                        `Ордер: ${orderNumber}\n` +
                        `Время: ${currentTime}\n` +
                        `Количество: ${activeTrade.amount} CES\n` +
                        `Сумма к оплате: ${activeTrade.totalValue.toFixed(2)} ₽\n` +
                        `Время на оплату: 30 мин. (до ${expiryTimeStr})\n\n` +
                        `💰 ДАННЫЕ ДЛЯ ОПЛАТЫ:\n` +
                        `Банк: ${sellerBank}\n` +
                        `Карта: ${sellerCard}\n` +
                        `Получатель: ${sellerName}\n\n` +
                        `⚠️ ВАЖНО:\n` +
                        `• Оплатите точную сумму: ${activeTrade.totalValue.toFixed(2)} ₽\n` +
                        `• Не указывайте CES в комментарии\n` +
                        `• После оплаты нажмите "Платёж выполнен"\n` +
                        `• CES будут переданы автоматически после подтверждения`;

    const buyerKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Платёж выполнен', 'payment_completed')],
      [Markup.button.callback('❌ Отменить сделку', 'cancel_payment')],
      [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
    ]);
    
    // Отправляем уведомление мейкеру
    console.log(`\n📤 ОТПРАВЛЯЮ УВЕДОМЛЕНИЕ МЕЙКЕРУ...`);
    
    try {
      const botInstance = require('../src/bot/telegramBot');
      const bot = botInstance.getInstance();
      
      await bot.telegram.sendMessage(buyer.chatId, buyerMessage, {
        reply_markup: buyerKeyboard.reply_markup,
        parse_mode: 'HTML'
      });
      
      console.log(`✅ Уведомление успешно отправлено мейкеру ${buyer.chatId}`);
      
      // Также отправим уведомление тейкеру о том, что мейкер уведомлен
      const sellerNotification = `🔔 МЕЙКЕР УВЕДОМЛЕН\n\n` +
                                 `Мы отправили уведомление покупателю о том, что ваши ${activeTrade.amount} CES находятся в эскроу.\n\n` +
                                 `💰 Он должен оплатить ${activeTrade.totalValue.toFixed(2)} ₽\n` +
                                 `⏰ Время на оплату: 30 минут\n\n` +
                                 `После получения оплаты подтвердите это нажав "Платёж получен".`;
      
      const sellerKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Платёж получен', 'payment_received')],
        [Markup.button.callback('❌ Отменить сделку', 'cancel_payment')],
        [Markup.button.callback('🔙 К P2P меню', 'p2p_menu')]
      ]);
      
      await bot.telegram.sendMessage(seller.chatId, sellerNotification, {
        reply_markup: sellerKeyboard.reply_markup,
        parse_mode: 'HTML'
      });
      
      console.log(`✅ Уведомление также отправлено тейкеру ${seller.chatId}`);
      
    } catch (sendError) {
      console.error(`❌ Ошибка отправки уведомления: ${sendError.message}`);
    }
    
    console.log(`\n🎉 ОПЕРАЦИЯ ЗАВЕРШЕНА!`);
    console.log(`📧 Мейкер теперь знает, что CES токены в эскроу`);
    console.log(`💰 Он может выполнить оплату и завершить сделку`);
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Отключение от базы данных');
  }
}

// Запуск скрипта
if (require.main === module) {
  notifyBuyerAboutEscrow().catch(console.error);
}

module.exports = { notifyBuyerAboutEscrow };