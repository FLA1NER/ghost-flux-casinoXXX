import { Telegraf, Markup } from 'telegraf';
import { supabase } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Главное меню
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  // Регистрируем пользователя если его нет
  await registerUser(userId, username, ctx.from.first_name);
  
  const menuText = `🎰 *Добро пожаловать в Ghost FluX Casino!* 👻

✨ *Ваш баланс:* 0 звёзд
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

  await ctx.replyWithPhoto(
    { url: 'https://i.imgur.com/placeholder-casino.png' },
    { caption: menuText, parse_mode: 'Markdown', ...keyboard }
  );
});

// Открытие Mini App
bot.hears('🎰 Открыть Казино', (ctx) => {
  const miniAppUrl = `https://your-mini-app-url.vercel.app?startapp=${ctx.from.id}`;
  ctx.reply('🎮 Открываем казино...', Markup.inlineKeyboard([
    Markup.button.webApp('🚀 Играть сейчас', miniAppUrl)
  ]));
});

// Баланс
bot.hears('⭐️ Мой баланс', async (ctx) => {
  const user = await getUser(ctx.from.id);
  ctx.reply(`✨ *Ваш баланс:* ${user.balance} звёзд`, { parse_mode: 'Markdown' });
});

// Инвентарь
bot.hears('🎁 Мой инвентарь', async (ctx) => {
  const inventory = await getUserInventory(ctx.from.id);
  if (inventory.length === 0) {
    return ctx.reply('📦 Ваш инвентарь пуст. Откройте кейсы чтобы получить подарки!');
  }
  
  let inventoryText = '🎁 *Ваш инвентарь:*\n\n';
  inventory.forEach(item => {
    inventoryText += `${item.item_emoji} ${item.item_name} - ${item.item_price} звёзд\n`;
  });
  
  ctx.reply(inventoryText, { parse_mode: 'Markdown' });
});

// Админ панель (только для вас)
bot.command('admin', async (ctx) => {
  if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) {
    return ctx.reply('⛔️ У вас нет доступа к админ панели');
  }
  
  const adminKeyboard = Markup.keyboard([
    ['👤 Пополнить баланс', '📊 Статистика'],
    ['📨 Уведомления о выводе', '⬅️ Главное меню']
  ]).resize();
  
  ctx.reply('⚙️ *Админ панель Ghost FluX*', { 
    parse_mode: 'Markdown',
    ...adminKeyboard 
  });
});

// Функции работы с базой данных
async function registerUser(telegramId, username, firstName) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      telegram_id: telegramId,
      username: username,
      first_name: firstName,
      balance: 0,
      last_bonus_claim: null
    }, { onConflict: 'telegram_id' });
    
  return { data, error };
}

async function getUser(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
    
  return data || { balance: 0 };
}

async function getUserInventory(telegramId) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', telegramId)
    .eq('status', 'active');
    
  return data || [];
}

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Ghost FluX Bot запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
