import { Telegraf, Markup } from 'telegraf';
import { supabase } from '../config/database.js';
import { AdminPanel } from './admin.js';
import { GameLogic } from '../game/logic.js';
import { DatabaseOperations } from '../database/operations.js';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Главное меню
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
  ]).resize();

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
  ]).resize();
  
  ctx.reply('⚙️ *Админ панель Ghost FluX*', { 
    parse_mode: 'Markdown',
    ...adminKeyboard 
  });
});

// Пополнение баланса (админ)
bot.hears('👤 Пополнить баланс', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) {
    return ctx.reply('⛔️ Доступ запрещен');
  }
  
  ctx.reply('Введите данные в формате:\n`@username количество_звезд`\nили\n`id количество_звезд`', {
    parse_mode: 'Markdown'
  });
});

// Обработка пополнения баланса
bot.on('text', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) return;
  
  const text = ctx.message.text;
  if (text.startsWith('@') || !isNaN(parseInt(text.split(' ')[0]))) {
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

// Статистика (админ)
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

// Заявки на вывод (админ)
bot.hears('📨 Заявки на вывод', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) return;
  
  try {
    const requests = await AdminPanel.getWithdrawalRequests();
    
    if (requests.length === 0) {
      return ctx.reply('📭 Нет pending заявок на вывод');
    }
    
    let requestsText = '📨 *Заявки на вывод:*\n\n';
    requests.forEach((request, index) => {
      requestsText += `${index + 1}. @${request.users.username}\n`;
      requestsText += `   ${request.inventory.item_emoji} ${request.inventory.item_name} (${request.inventory.item_price} звёзд)\n`;
      requestsText += `   ID заявки: ${request.id}\n\n`;
    });
    
    ctx.reply(requestsText, { parse_mode: 'Markdown' });
    
  } catch (error) {
    ctx.reply(`❌ Ошибка: ${error.message}`);
  }
});

// Открытие Mini App
bot.hears('🎰 Открыть Казино', (ctx) => {
  const miniAppUrl = `https://your-mini-app-url.vercel.app?startapp=${ctx.from.id}`;
  ctx.reply('🎮 *Открываем казино...*', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      Markup.button.webApp('🚀 Играть сейчас', miniAppUrl)
    ])
  });
});

// Баланс
bot.hears('⭐️ Мой баланс', async (ctx) => {
  const user = await getUser(ctx.from.id);
  ctx.reply(`✨ *Ваш баланс:* ${user.balance} звёзд\n\n💎 *Цены пополнения:*\n50 звёзд - 85 руб\n100 звёзд - 169 руб\n200 звёзд - 339 руб`, { 
    parse_mode: 'Markdown' 
  });
});

// Инвентарь с кнопками
bot.hears('🎁 Мой инвентарь', async (ctx) => {
  const inventory = await getUserInventory(ctx.from.id);
  if (inventory.length === 0) {
    return ctx.reply('📦 Ваш инвентарь пуст. Откройте кейсы чтобы получить подарки!');
  }
  
  let inventoryText = '🎁 *Ваш инвентарь:*\n\n';
  const buttons = [];
  
  inventory.forEach((item, index) => {
    inventoryText += `${item.item_emoji} *${item.item_name}* - ${item.item_price} звёзд\n`;
    
    if (index % 2 === 0) {
      buttons.push([
        Markup.button.callback(`🎁 ${item.item_name}`, `withdraw_${item.id}`),
        Markup.button.callback(`💰 Продать`, `sell_${item.id}`)
      ]);
    } else {
      buttons[buttons.length - 1].push(
        Markup.button.callback(`🎁 ${item.item_name}`, `withdraw_${item.id}`),
        Markup.button.callback(`💰 Продать`, `sell_${item.id}`)
      );
    }
  });
  
  await ctx.reply(inventoryText, { 
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Главное меню
bot.hears('⬅️ Главное меню', (ctx) => {
  ctx.reply('Возвращаемся в главное меню...');
  ctx.start();
});

// Правила
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

// Поддержка
bot.hears('📞 Поддержка', (ctx) => {
  ctx.reply('📞 *Техническая поддержка*\n\nПо вопросам пополнения баланса и вывода подарков:\n@KXKXKXKXKXKXKXKXKXKXK', {
    parse_mode: 'Markdown'
  });
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
