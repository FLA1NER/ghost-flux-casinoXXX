import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

async function testBot() {
  try {
    console.log('🧪 Testing bot connection...');
    
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    // Проверяем подключение к Telegram API
    const me = await bot.telegram.getMe();
    console.log('✅ Bot connected successfully:', me);
    
    // Проверяем отправку сообщения
    await bot.telegram.sendMessage(
      process.env.ADMIN_USER_ID, 
      '🤖 Bot test: Connection successful!'
    );
    console.log('✅ Test message sent successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Bot test failed:', error.message);
    process.exit(1);
  }
}

testBot();
