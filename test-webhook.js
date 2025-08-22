const axios = require('axios');
require('dotenv').config();

async function testWebhook() {
  const webhookUrl = process.env.WEBHOOK_URL || 'https://metawhale.onrender.com';
  
  console.log('🧪 Тестирование webhook и проверка работы бота...\n');
  
  try {
    // Тест основного endpoint
    console.log('1️⃣ Проверка основного endpoint...');
    const mainResponse = await axios.get(webhookUrl, { timeout: 10000 });
    console.log('✅ Основной endpoint:', mainResponse.data);
    
    // Тест ping endpoint
    console.log('\n2️⃣ Проверка ping endpoint...');
    const pingResponse = await axios.get(`${webhookUrl}/ping`, { timeout: 10000 });
    console.log('✅ Ping endpoint:', pingResponse.data);
    
    // Тест health endpoint
    console.log('\n3️⃣ Проверка health endpoint...');
    const healthResponse = await axios.get(`${webhookUrl}/health`, { timeout: 10000 });
    console.log('✅ Health endpoint:', healthResponse.data);
    
    // Проверка webhook Telegram
    console.log('\n4️⃣ Проверка webhook информации Telegram...');
    const webhookInfoResponse = await axios.get(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    
    const webhookInfo = webhookInfoResponse.data.result;
    console.log('📡 Webhook Info:');
    console.log(`   URL: ${webhookInfo.url}`);
    console.log(`   Pending updates: ${webhookInfo.pending_update_count}`);
    console.log(`   Last error: ${webhookInfo.last_error_message || 'Нет ошибок'}`);
    console.log(`   Last error date: ${webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000) : 'Никогда'}`);
    
    console.log('\n🎉 Все тесты прошли успешно!');
    console.log('✅ Бот готов к работе в режиме webhook на Render');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Данные:', error.response.data);
    }
  }
}

// Запуск тестирования
testWebhook();