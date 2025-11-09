import { Telegraf, Markup } from 'telegraf';
import { supabase } from '../config/database.js';
import { AdminPanel } from './admin.js';
import { DatabaseOperations } from '../database/operations.js';
import dotenv from 'dotenv';

dotenv.config();

// Конфигурация бота с ретраями
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: {
    agent: null, // Используем дефолтный агент
    attachmentAgent: null,
    apiRoot: 'https://api.telegram.org',
    webhookReply: true,
    testEnv: false
  },
  handlerTimeout: 30000, // 30 секунд таймаут
});

// Увеличиваем таймауты для бота
bot.telegram.options.timeout = 60000; // 60 секунд

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
      // Ждем перед повторной попыткой
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

// Главное меню с Reply-клавиатурой
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    
    await safeDbOperation(() => registerUser(userId, username, ctx.from.first_name));
    
    const user = await safeDbOperation(() => getUser(userId), { balance: 0 });
    
    const menuText = `🎰 *Добро пожаловать в Ghost FluX Casino!* 👻

✨ *Ваш баланс:* ${user.balance} звёзд
🎁 *Открывайте кейсы и выигрывайте подарки!*

⚡️ *Режимы игры:*
• 🎁 Кейс Gift Box - 25 звёзд
• 🎡 Рулетка Ghost Roulette - 50 звёзд  
• 🎯 Бонусный кейс - бесплатно раз в 24ч

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

// АДМИН ПАНЕЛЬ
bot.command('admin', async (ctx) => {
  try {
    if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) {
      return await safeReply(ctx, '⛔️ У вас нет доступа к админ панели');
    }
    
    const adminKeyboard = Markup.keyboard([
      ['👤 Пополнить баланс', '📊 Статистика'],
      ['📨 Заявки на вывод', '⬅️ Главное меню']
    ]).resize().oneTime();
    
    await safeReply(ctx, '⚙️ *Админ панель Ghost FluX*', { 
      parse_mode: 'Markdown',
      ...adminKeyboard 
    });
  } catch (error) {
    console.error('Ошибка в admin:', error.message);
    await safeReply(ctx, '❌ Ошибка доступа к админ панели.');
  }
});

// Обработка кнопок Reply-клавиатуры
bot.hears('🎰 Открыть Казино', async (ctx) => {
  try {
    const miniAppUrl = `https://ghost-flux-casino-xxx.vercel.app?startapp=${ctx.from.id}`;
    await safeReply(ctx, '🎮 *Открываем казино...*', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.webApp('🚀 Играть сейчас', miniAppUrl)
      ])
    });
  } catch (error) {
    console.error('Ошибка в Открыть Казино:', error.message);
    await safeReply(ctx, '❌ Ошибка открытия казино.');
  }
});

bot.hears('⭐️ Мой баланс', async (ctx) => {
  try {
    const user = await safeDbOperation(() => getUser(ctx.from.id), { balance: 0 });
    await safeReply(ctx, `✨ *Ваш баланс:* ${user.balance} звёзд\n\n💎 *Цены пополнения:*\n50 звёзд - 85 руб\n100 звёзд - 169 руб\n200 звёзд - 339 руб`, { 
      parse_mode: 'Markdown' 
    });
  } catch (error) {
    console.error('Ошибка в Мой баланс:', error.message);
    await safeReply(ctx, '❌ Ошибка получения баланса.');
  }
});

bot.hears('🎁 Мой инвентарь', async (ctx) => {
  try {
    const inventory = await safeDbOperation(() => getUserInventory(ctx.from.id), []);
    if (inventory.length === 0) {
      return await safeReply(ctx, '📦 Ваш инвентарь пуст. Откройте кейсы чтобы получить подарки!');
    }
    
    let inventoryText = '🎁 *Ваш инвентарь:*\n\n';
    inventory.forEach((item) => {
      inventoryText += `${item.item_emoji} *${item.item_name}* - ${item.item_price} звёзд\n`;
    });
    
    await safeReply(ctx, inventoryText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка в Мой инвентарь:', error.message);
    await safeReply(ctx, '❌ Ошибка получения инвентаря.');
  }
});

bot.hears('📱 Пополнить баланс', async (ctx) => {
  try {
    await safeReply(ctx, `💎 *Пополнение баланса*

Для пополнения баланса напишите:
@KXKXKXKXKXKXKXKXKXKXK

💫 *Цены:*
50 звёзд - 85 руб
100 звёзд - 169 руб  
200 звёзд - 339 руб

После оплаты администратор пополнит ваш баланс!`, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Ошибка в Пополнить баланс:', error.message);
    await safeReply(ctx, '❌ Ошибка отображения информации.');
  }
});

bot.hears('ℹ️ Правила', async (ctx) => {
  try {
    const rulesText = `📖 *Правила Ghost FluX Casino*

🎰 *Общие положения:*
• Игровая валюта - звёзды
• Минимальное пополнение - 50 звёзд
• Вывод подарков в течение 3 часов

🎁 *Кейсы:*
• Gift Box - 25 звёзд
• Ghost Roulette - 50 звёзд
• Бонусный кейс - бесплатно раз в 24ч

⚠️ *Важно:*
• Администратор не несет ответственности за игровую валюту
• Игрок может как выиграть, так и проиграть звёзды
• Запрещено создание мультиаккаунтов`;

    await safeReply(ctx, rulesText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка в Правила:', error.message);
    await safeReply(ctx, '❌ Ошибка отображения правил.');
  }
});

bot.hears('📞 Поддержка', async (ctx) => {
  try {
    await safeReply(ctx, '📞 *Техническая поддержка*\n\nПо вопросам пополнения баланса и вывода подарков:\n@KXKXKXKXKXKXKXKXKXKXK', {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Ошибка в Поддержка:', error.message);
    await safeReply(ctx, '❌ Ошибка отображения поддержки.');
  }
});

// Админ функции
bot.hears('👤 Пополнить баланс', async (ctx) => {
  try {
    if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) {
      return await safeReply(ctx, '⛔️ Доступ запрещен');
    }
    
    await safeReply(ctx, 'Введите данные в формате:\n`@username количество_звезд`\nили\n`id количество_звезд`', {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Ошибка в админ Пополнить баланс:', error.message);
    await safeReply(ctx, '❌ Ошибка админ функции.');
  }
});

bot.hears('📊 Статистика', async (ctx) => {
  try {
    if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) return;
    
    const stats = await safeDbOperation(() => AdminPanel.getStats(), { 
      totalUsers: 0, 
      totalStars: 0, 
      averageBalance: 0 
    });
    
    const statsText = `📊 *Статистика Ghost FluX*

👥 Всего пользователей: ${stats.totalUsers}
⭐️ Всего звёзд в системе: ${stats.totalStars}
💰 Средний баланс: ${Math.round(stats.averageBalance)} звёзд`;

    await safeReply(ctx, statsText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка в Статистика:', error.message);
    await safeReply(ctx, '❌ Ошибка получения статистики.');
  }
});

bot.hears('⬅️ Главное меню', async (ctx) => {
  try {
    await safeReply(ctx, 'Возвращаемся в главное меню...', 
      Markup.removeKeyboard()
    );
    // Вызываем start команду через 1 секунду
    setTimeout(() => {
      ctx.start();
    }, 1000);
  } catch (error) {
    console.error('Ошибка в Главное меню:', error.message);
    await safeReply(ctx, '❌ Ошибка возврата в меню.');
  }
});

// Обработка пополнения баланса
bot.on('text', async (ctx) => {
  try {
    if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) return;
    
    const text = ctx.message.text;
    if ((text.startsWith('@') || !isNaN(parseInt(text.split(' ')[0]))) && text.includes(' ')) {
      const [identifier, amountStr] = text.split(' ');
      const amount = parseInt(amountStr);
      
      if (!amount || amount <= 0) {
        return await safeReply(ctx, '❌ Неверная сумма');
      }
      
      let telegramId;
      
      if (identifier.startsWith('@')) {
        // Поиск по username
        const { data: user } = await safeDbOperation(() => 
          supabase
            .from('users')
            .select('telegram_id')
            .eq('username', identifier.slice(1))
            .single()
        );
          
        if (!user) throw new Error('Пользователь не найден');
        telegramId = user.telegram_id;
      } else {
        // Поиск по ID
        telegramId = parseInt(identifier);
      }
      
      const result = await AdminPanel.addBalanceToUser(telegramId, amount, ctx.from.id);
      await safeReply(ctx, `✅ Баланс пополнен!\nПользователь: ${result.username}\nДобавлено: ${amount} звёзд\nНовый баланс: ${result.newBalance} звёзд`);
      
    }
  } catch (error) {
    console.error('Ошибка в обработке пополнения:', error.message);
    await safeReply(ctx, `❌ Ошибка: ${error.message}`);
  }
});

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

// Запуск бота с обработкой ошибок и ретраями
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
        process.exit(1);
      }
      
      // Ждем перед следующей попыткой (экспоненциальная задержка)
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`⏳ Повторная попытка через ${delay/1000} секунд...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Обработчики graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Остановка бота (SIGINT)...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 Остановка бота (SIGTERM)...');
  bot.stop('SIGTERM');
});

// Обработчик необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('❌ Необработанная ошибка:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанный rejection:', reason);
});

// Запускаем бота
startBot();
