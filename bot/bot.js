import { Telegraf, Markup } from 'telegraf';
import { supabase } from '../config/database.js';
import { AdminPanel } from './admin.js';
import { DatabaseOperations } from '../database/operations.js';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: {
    agent: null,
    attachmentAgent: null,
    apiRoot: 'https://api.telegram.org',
    webhookReply: true,
    testEnv: false
  },
  handlerTimeout: 30000,
});

bot.telegram.options.timeout = 60000;

// Обработчик ошибок бота
bot.catch((err, ctx) => {
  console.error('❌ Ошибка бота:', err.message);
  try {
    ctx.reply('⚠️ Произошла временная ошибка. Попробуйте позже.');
  } catch (e) {
    console.error('Не удалось отправить сообщение об ошибке:', e);
  }
});

// Функция для безопасного выполнения операций с базой
async function safeDbOperation(operation, fallback = null, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`❌ Ошибка базы данных (попытка ${attempt}/${maxRetries}):`, error.message);
      if (attempt === maxRetries) {
        return fallback;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Функция для безопасной отправки сообщений
async function safeReply(ctx, text, extra = {}) {
  try {
    await ctx.reply(text, extra);
    return true;
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.message);
    return false;
  }
}

// Главное меню
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    
    await safeDbOperation(() => registerUser(userId, username, ctx.from.first_name));
    
    const user = await safeDbOperation(() => getUser(userId), { balance: 0 });
    
    const menuText = `🎰 *Добро пожаловать в Ghost FluX Casino!* 👻

✨ *Ваш баланс:* ${user.balance} звёзд
🎁 *Открывайте кейсы и выигрывайте подарки!*

👇 *Выберите действие:*`;

    const keyboard = Markup.keyboard([
      ['🎰 Открыть Казино', '⭐️ Мой баланс'],
      ['🎁 Мой инвентарь', '📱 Пополнить баланс'],
      ['ℹ️ Правила', '📞 Поддержка']
    ]).resize().oneTime();

    await safeReply(ctx, menuText, { 
      parse_mode: 'Markdown', 
      ...keyboard 
    });
  } catch (error) {
    console.error('Ошибка в start:', error.message);
    await safeReply(ctx, '❌ Произошла ошибка. Попробуйте снова.');
  }
});

// [ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ БОТА ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ...]
// ... (остальной код бота из предыдущей версии)

// Функции работы с базой данных
async function registerUser(telegramId, username, firstName) {
  const { data, error } = await DatabaseOperations.createUser(telegramId, username, firstName);
  return { data, error };
}

async function getUser(telegramId) {
  const { data, error } = await DatabaseOperations.getUser(telegramId);
  return data || { balance: 0, username: 'user', first_name: 'User' };
}

async function getUserInventory(telegramId) {
  const { data, error } = await DatabaseOperations.getUserInventory(telegramId);
  return data || [];
}

// Запуск бота
async function startBot() {
  let retryCount = 0;
  const maxRetries = 5;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`🤖 Запуск Ghost FluX Bot... (попытка ${retryCount + 1}/${maxRetries})`);
      await bot.launch();
      console.log('✅ Ghost FluX Bot успешно запущен!');
      break;
    } catch (error) {
      retryCount++;
      console.error(`❌ Ошибка запуска бота (попытка ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error('🚨 Не удалось запустить бота после всех попыток');
        return;
      }
      
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`⏳ Повторная попытка через ${delay/1000} секунд...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Экспортируем бота для использования в server.js
export { bot, startBot };

// Запускаем бота если файл запущен напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  startBot();
}
