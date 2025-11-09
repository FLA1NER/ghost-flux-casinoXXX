import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Обработчик ошибок
bot.catch((err, ctx) => {
  console.error('❌ Ошибка бота:', err);
});

// Главное меню
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    
    const menuText = `🎰 *Добро пожаловать в Ghost FluX Casino!* 👻

✨ *Открывайте кейсы и выигрывайте подарки!*

⚡️ *Режимы игры:*
• 🎁 Кейс Gift Box - 25 звёзд
• 🎡 Рулетка Ghost Roulette - 50 звёзд  
• 🎯 Бонусный кейс - бесплатно раз в 24ч

👇 *Нажмите кнопку ниже чтобы начать играть!*`;

    const keyboard = Markup.keyboard([
      ['🎰 Открыть Казино', '⭐️ Мой баланс'],
      ['🎁 Мой инвентарь', '📱 Пополнить баланс'],
      ['ℹ️ Правила', '📞 Поддержка']
    ]).resize().oneTime();

    await ctx.reply(menuText, { 
      parse_mode: 'Markdown', 
      ...keyboard 
    });
  } catch (error) {
    console.error('Ошибка в start:', error);
    ctx.reply('❌ Произошла ошибка. Попробуйте снова.');
  }
});

// Открытие Mini App
bot.hears('🎰 Открыть Казино', async (ctx) => {
  try {
    const miniAppUrl = `https://ghost-flux-casino-xxx.vercel.app?startapp=${ctx.from.id}`;
    
    await ctx.reply('🎮 *Открываем казино...*', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.webApp('🚀 Играть сейчас', miniAppUrl)
      ])
    });
  } catch (error) {
    console.error('Ошибка открытия казино:', error);
    ctx.reply('❌ Ошибка открытия казино.');
  }
});

// Баланс
bot.hears('⭐️ Мой баланс', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Получаем баланс через API
    const response = await fetch(`https://ghost-flux-casinoxxx.onrender.com/api/user/${userId}`);
    const userData = await response.json();
    
    const balance = userData.balance || 0;
    
    await ctx.reply(`✨ *Ваш баланс:* ${balance} звёзд\n\n💎 *Цены пополнения:*\n50 звёзд - 85 руб\n100 звёзд - 169 руб\n200 звёзд - 339 руб\n\nДля пополнения напишите: @KXKXKXKXKXKXKXKXKXKXK`, { 
      parse_mode: 'Markdown' 
    });
  } catch (error) {
    console.error('Ошибка получения баланса:', error);
    ctx.reply('❌ Ошибка получения баланса.');
  }
});

// Инвентарь
bot.hears('🎁 Мой инвентарь', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Получаем инвентарь через API
    const response = await fetch(`https://ghost-flux-casinoxxx.onrender.com/api/inventory/${userId}`);
    const inventory = await response.json();
    
    if (!inventory || inventory.length === 0) {
      return ctx.reply('📦 Ваш инвентарь пуст. Откройте кейсы чтобы получить подарки!');
    }
    
    let inventoryText = '🎁 *Ваш инвентарь:*\n\n';
    inventory.forEach((item) => {
      inventoryText += `${item.item_emoji} *${item.item_name}* - ${item.item_price} звёзд\n`;
    });
    
    await ctx.reply(inventoryText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка получения инвентаря:', error);
    ctx.reply('❌ Ошибка получения инвентаря.');
  }
});

// Пополнение баланса
bot.hears('📱 Пополнить баланс', async (ctx) => {
  try {
    await ctx.reply(`💎 *Пополнение баланса*

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
    console.error('Ошибка пополнения баланса:', error);
    ctx.reply('❌ Ошибка отображения информации.');
  }
});

// Правила
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

    await ctx.reply(rulesText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка правил:', error);
    ctx.reply('❌ Ошибка отображения правил.');
  }
});

// Поддержка
bot.hears('📞 Поддержка', async (ctx) => {
  try {
    await ctx.reply('📞 *Техническая поддержка*\n\nПо вопросам пополнения баланса и вывода подарков:\n@KXKXKXKXKXKXKXKXKXKXK', {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Ошибка поддержки:', error);
    ctx.reply('❌ Ошибка отображения поддержки.');
  }
});

// Админ команда
bot.command('admin', async (ctx) => {
  try {
    if (ctx.from.id !== parseInt(process.env.ADMIN_USER_ID)) {
      return ctx.reply('⛔️ У вас нет доступа к админ панели');
    }
    
    const adminUrl = 'https://ghost-flux-casinoxxx.onrender.com/admin';
    
    await ctx.reply('⚙️ *Админ панель Ghost FluX*', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.url('📊 Открыть админ панель', adminUrl)
      ])
    });
  } catch (error) {
    console.error('Ошибка админ панели:', error);
    ctx.reply('❌ Ошибка доступа к админ панели.');
  }
});

// Запускаем бота
bot.launch().then(() => {
  console.log('✅ Ghost FluX Bot запущен!');
}).catch(error => {
  console.error('❌ Ошибка запуска бота:', error);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export { bot };
