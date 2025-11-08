import { Telegraf, Markup } from 'telegraf';
import { supabase } from '../config/database.js';
import { AdminPanel } from './admin.js';
import { GameLogic } from '../game/logic.js';
import { DatabaseOperations } from '../database/operations.js';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Главное меню с Reply-клавиатурой
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  await registerUser(userId, username, ctx.from.first_name);
  
  const user = await getUser(userId);
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

  await ctx.reply(menuText, { 
    parse_mode: 'Markdown', 
    ...keyboard 
  });
});

// АДМИН ПАНЕЛЬ
bot.command('admin', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) {
    return ctx.reply('⛔️ У вас нет доступа к админ панели');
  }
  
  const adminKeyboard = Markup.keyboard([
    ['👤 Пополнить баланс', '📊 Статистика'],
    ['📨 Заявки на вывод', '⬅️ Главное меню']
  ]).resize().oneTime();
  
  ctx.reply('⚙️ *Админ панель Ghost FluX*', { 
    parse_mode: 'Markdown',
    ...adminKeyboard 
  });
});

// Обработка кнопок Reply-клавиатуры
bot.hears('🎰 Открыть Казино', (ctx) => {
  const miniAppUrl = `https://ghost-flux-casino-xxx.vercel.app?startapp=${ctx.from.id}`;
  ctx.reply('🎮 *Открываем казино...*', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      Markup.button.webApp('🚀 Играть сейчас', miniAppUrl)
    ])
  });
});

bot.hears('⭐️ Мой баланс', async (ctx) => {
  const user = await getUser(ctx.from.id);
  ctx.reply(`✨ *Ваш баланс:* ${user.balance} звёзд\n\n💎 *Цены пополнения:*\n50 звёзд - 85 руб\n100 звёзд - 169 руб\n200 звёзд - 339 руб`, { 
    parse_mode: 'Markdown' 
  });
});

bot.hears('🎁 Мой инвентарь', async (ctx) => {
  const inventory = await getUserInventory(ctx.from.id);
  if (inventory.length === 0) {
    return ctx.reply('📦 Ваш инвентарь пуст. Откройте кейсы чтобы получить подарки!');
  }
  
  let inventoryText = '🎁 *Ваш инвентарь:*\n\n';
  inventory.forEach((item) => {
    inventoryText += `${item.item_emoji} *${item.item_name}* - ${item.item_price} звёзд\n`;
  });
  
  ctx.reply(inventoryText, { parse_mode: 'Markdown' });
});

bot.hears('📱 Пополнить баланс', (ctx) => {
  ctx.reply(`💎 *Пополнение баланса*

Для пополнения баланса напишите:
@KXKXKXKXKXKXKXKXKXKXK

💫 *Цены:*
50 звёзд - 85 руб
100 звёзд - 169 руб  
200 звёзд - 339 руб

После оплаты администратор пополнит ваш баланс!`, {
    parse_mode: 'Markdown'
  });
});

bot.hears('ℹ️ Правила', (ctx) => {
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

  ctx.reply(rulesText, { parse_mode: 'Markdown' });
});

bot.hears('📞 Поддержка', (ctx) => {
  ctx.reply('📞 *Техническая поддержка*\n\nПо вопросам пополнения баланса и вывода подарков:\n@KXKXKXKXKXKXKXKXKXKXK', {
    parse_mode: 'Markdown'
  });
});

// Админ функции
bot.hears('👤 Пополнить баланс', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) {
    return ctx.reply('⛔️ Доступ запрещен');
  }
  
  ctx.reply('Введите данные в формате:\n`@username количество_звезд`\nили\n`id количество_звезд`', {
    parse_mode: 'Markdown'
  });
});

bot.hears('📊 Статистика', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) return;
  
  try {
    const stats = await AdminPanel.getStats();
    const statsText = `📊 *Статистика Ghost FluX*

👥 Всего пользователей: ${stats.totalUsers}
⭐️ Всего звёзд в системе: ${stats.totalStars}
💰 Средний баланс: ${Math.round(stats.averageBalance)} звёзд`;

    ctx.reply(statsText, { parse_mode: 'Markdown' });
  } catch (error) {
    ctx.reply(`❌ Ошибка: ${error.message}`);
  }
});

bot.hears('⬅️ Главное меню', (ctx) => {
  ctx.reply('Возвращаемся в главное меню...', 
    Markup.removeKeyboard()
  );
  ctx.start();
});

// Обработка пополнения баланса
bot.on('text', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) return;
  
  const text = ctx.message.text;
  if ((text.startsWith('@') || !isNaN(parseInt(text.split(' ')[0]))) && text.includes(' ')) {
    const [identifier, amountStr] = text.split(' ');
    const amount = parseInt(amountStr);
    
    if (!amount || amount <= 0) {
      return ctx.reply('❌ Неверная сумма');
    }
    
    try {
      let telegramId;
      
      if (identifier.startsWith('@')) {
        // Поиск по username
        const { data: user } = await supabase
          .from('users')
          .select('telegram_id')
          .eq('username', identifier.slice(1))
          .single();
          
        if (!user) throw new Error('Пользователь не найден');
        telegramId = user.telegram_id;
      } else {
        // Поиск по ID
        telegramId = parseInt(identifier);
      }
      
      const result = await AdminPanel.addBalanceToUser(telegramId, amount, ctx.from.id);
      ctx.reply(`✅ Баланс пополнен!\nПользователь: ${result.username}\nДобавлено: ${amount} звёзд\nНовый баланс: ${result.newBalance} звёзд`);
      
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.message}`);
    }
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

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Ghost FluX Bot запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
