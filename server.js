import express from 'express';
import { bot } from './bot/bot.js';
import { supabase } from './config/database.js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== API ДЛЯ MINI APP ====================

// Получение данных пользователя
app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    
    console.log(`🔍 Запрос данных пользователя: ${telegramId}`);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Пользователь не найден - создаем нового
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
          username: 'user_' + telegramId,
          first_name: 'User',
          balance: 0
        })
        .select()
        .single();
      
      console.log(`✅ Создан новый пользователь: ${telegramId}`);
      return res.json(newUser);
    }

    if (error) throw error;
    
    console.log(`✅ Данные пользователя получены: ${telegramId}, баланс: ${user?.balance}`);
    res.json(user || { balance: 0 });
    
  } catch (error) {
    console.error('❌ Ошибка получения пользователя:', error);
    res.status(500).json({ error: error.message });
  }
});

// Открытие кейса
app.post('/api/open-case', async (req, res) => {
  try {
    const { userId } = req.body;
    const telegramId = parseInt(userId);
    const casePrice = 25;

    console.log(`🎁 Открытие кейса для: ${telegramId}`);

    // Получаем пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: 'Пользователь не найден' });
    }

    // Проверяем баланс
    if (user.balance < casePrice) {
      return res.status(400).json({ error: 'Недостаточно звёзд' });
    }

    // Генерируем выигрыш
    const items = [
      { emoji: '🧸', name: 'Мишка', price: 15, chance: 35 },
      { emoji: '💝', name: 'Сердечко', price: 15, chance: 35 },
      { emoji: '🌹', name: 'Роза', price: 25, chance: 7.5 },
      { emoji: '🎁', name: 'Подарок', price: 25, chance: 7.5 },
      { emoji: '🚀', name: 'Ракета', price: 50, chance: 5 },
      { emoji: '🍾', name: 'Шампанское', price: 50, chance: 5 },
      { emoji: '🏆', name: 'Кубок', price: 100, chance: 2.5 },
      { emoji: '💍', name: 'Кольцо', price: 100, chance: 2.5 }
    ];

    const random = Math.random() * 100;
    let currentChance = 0;
    let wonItem = items[0];

    for (const item of items) {
      currentChance += item.chance;
      if (random <= currentChance) {
        wonItem = item;
        break;
      }
    }

    // Обновляем баланс
    const newBalance = user.balance - casePrice;
    await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', telegramId);

    // Добавляем предмет в инвентарь
    const { data: inventoryItem } = await supabase
      .from('inventory')
      .insert({
        user_id: telegramId,
        item_type: wonItem.name.toLowerCase(),
        item_name: wonItem.name,
        item_price: wonItem.price,
        item_emoji: wonItem.emoji
      })
      .select()
      .single();

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: telegramId,
        type: 'case_open',
        amount: -casePrice,
        details: { 
          case_type: 'gift_box',
          won_item: wonItem,
          inventory_id: inventoryItem.id 
        }
      });

    console.log(`✅ Кейс открыт: ${telegramId} выиграл ${wonItem.name}`);

    res.json({
      success: true,
      wonItem: wonItem,
      newBalance: newBalance
    });

  } catch (error) {
    console.error('❌ Ошибка открытия кейса:', error);
    res.status(500).json({ error: error.message });
  }
});

// Бонусный кейс
app.post('/api/open-bonus', async (req, res) => {
  try {
    const { userId } = req.body;
    const telegramId = parseInt(userId);

    console.log(`🎯 Бонусный кейс для: ${telegramId}`);

    // Получаем пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: 'Пользователь не найден' });
    }

    // Проверяем время последнего бонуса
    const now = new Date();
    const lastBonus = user.last_bonus_claim ? new Date(user.last_bonus_claim) : null;

    if (lastBonus && (now - lastBonus) < 24 * 60 * 60 * 1000) {
      const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - lastBonus)) / (60 * 60 * 1000));
      return res.status(400).json({ error: `Следующий бонус через ${hoursLeft} часов` });
    }

    // Генерируем бонус (1-5 звезд)
    const starsWon = Math.floor(Math.random() * 5) + 1;
    const newBalance = user.balance + starsWon;

    // Обновляем баланс и время бонуса
    await supabase
      .from('users')
      .update({ 
        balance: newBalance,
        last_bonus_claim: now.toISOString()
      })
      .eq('telegram_id', telegramId);

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: telegramId,
        type: 'bonus',
        amount: starsWon,
        details: { 
          bonus_type: 'daily',
          stars_won: starsWon
        }
      });

    console.log(`✅ Бонус получен: ${telegramId} +${starsWon} звезд`);

    res.json({
      success: true,
      starsWon: starsWon,
      newBalance: newBalance
    });

  } catch (error) {
    console.error('❌ Ошибка бонусного кейса:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение инвентаря
app.get('/api/inventory/:telegramId', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);

    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', telegramId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(inventory || []);

  } catch (error) {
    console.error('❌ Ошибка получения инвентаря:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== АДМИН ПАНЕЛЬ ====================

app.get('/admin', async (req, res) => {
  try {
    // Получаем пользователей
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    let usersHtml = '';
    if (users && users.length > 0) {
      users.forEach(user => {
        usersHtml += `
          <tr>
            <td>${user.telegram_id}</td>
            <td>${user.username || '—'}</td>
            <td>${user.first_name || '—'}</td>
            <td><strong>${user.balance} ⭐</strong></td>
            <td>
              <form action="/admin/add-balance" method="post" style="display: inline;">
                <input type="hidden" name="telegramId" value="${user.telegram_id}">
                <input type="number" name="amount" placeholder="Сумма" required style="width: 80px; padding: 5px;">
                <button type="submit" style="padding: 5px 10px; background: #00ff00; color: black; border: none; border-radius: 3px; cursor: pointer;">➕</button>
              </form>
            </td>
          </tr>
        `;
      });
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ghost FluX Admin</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #0a0a0a; color: white; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; }
          .neon-text { color: #00ffff; text-shadow: 0 0 10px #00ffff; font-size: 2.5em; }
          table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
          th { background: rgba(0, 255, 255, 0.2); color: #00ffff; }
          input, button { padding: 8px; border: none; border-radius: 5px; }
          input { background: rgba(255,255,255,0.9); color: #000; }
          button { background: #00ff00; color: black; cursor: pointer; font-weight: bold; }
          button:hover { background: #00cc00; }
          .success { color: #00ff00; padding: 10px; background: rgba(0,255,0,0.1); border-radius: 5px; margin: 10px 0; }
          .error { color: #ff4444; padding: 10px; background: rgba(255,0,0,0.1); border-radius: 5px; margin: 10px 0; }
          .search-box { margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; }
          .stats { display: flex; gap: 20px; margin: 20px 0; }
          .stat-card { flex: 1; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="neon-text">👻 Ghost FluX Admin Panel</h1>
            <p>Управление балансами пользователей</p>
          </div>

          ${req.query.success ? '<div class="success">✅ Баланс успешно пополнен!</div>' : ''}
          ${req.query.error ? `<div class="error">❌ Ошибка: ${req.query.error}</div>` : ''}

          <div class="search-box">
            <h3>🔍 Быстрый поиск пользователя</h3>
            <form action="/admin/search" method="get">
              <input type="text" name="query" placeholder="Введите Telegram ID или username" style="width: 300px; padding: 10px;">
              <button type="submit" style="padding: 10px 20px;">Найти</button>
            </form>
          </div>

          <h3>📊 Все пользователи (${users?.length || 0})</h3>
          <table>
            <thead>
              <tr>
                <th>Telegram ID</th>
                <th>Username</th>
                <th>Имя</th>
                <th>Баланс</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${usersHtml || '<tr><td colspan="5" style="text-align: center; padding: 20px;">Нет пользователей</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`❌ Ошибка: ${error.message}`);
  }
});

// Поиск пользователя
app.get('/admin/search', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.redirect('/admin');

    let users;
    
    if (!isNaN(query)) {
      // Поиск по ID
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', parseInt(query));
      
      if (error) throw error;
      users = data;
    } else {
      // Поиск по username
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', `%${query}%`);
      
      if (error) throw error;
      users = data;
    }

    let usersHtml = '';
    if (users && users.length > 0) {
      users.forEach(user => {
        usersHtml += `
          <tr>
            <td>${user.telegram_id}</td>
            <td>${user.username || '—'}</td>
            <td>${user.first_name || '—'}</td>
            <td><strong>${user.balance} ⭐</strong></td>
            <td>
              <form action="/admin/add-balance" method="post" style="display: inline;">
                <input type="hidden" name="telegramId" value="${user.telegram_id}">
                <input type="number" name="amount" placeholder="Сумма" required style="width: 80px; padding: 5px;">
                <button type="submit" style="padding: 5px 10px; background: #00ff00; color: black; border: none; border-radius: 3px; cursor: pointer;">➕</button>
              </form>
            </td>
          </tr>
        `;
      });
    } else {
      usersHtml = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Пользователь не найден</td></tr>';
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ghost FluX Admin - Search</title>
        <style>/* тот же стиль что выше */</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="neon-text">👻 Результаты поиска</h1>
            <p><a href="/admin" style="color: #00ffff;">← Назад к списку</a></p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Telegram ID</th>
                <th>Username</th>
                <th>Имя</th>
                <th>Баланс</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>${usersHtml}</tbody>
          </table>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    res.redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }
});

// Пополнение баланса
app.post('/admin/add-balance', async (req, res) => {
  try {
    const { telegramId, amount } = req.body;
    
    if (!telegramId || !amount) {
      return res.redirect('/admin?error=Заполните все поля');
    }

    console.log(`💰 Пополнение баланса: ${telegramId} +${amount}`);

    // Находим пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', parseInt(telegramId))
      .single();

    if (userError || !user) {
      return res.redirect('/admin?error=Пользователь не найден');
    }

    // Обновляем баланс
    const newBalance = (user.balance || 0) + parseInt(amount);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', parseInt(telegramId));

    if (updateError) throw updateError;

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: parseInt(telegramId),
        type: 'deposit',
        amount: parseInt(amount),
        details: { 
          method: 'web_admin',
          old_balance: user.balance || 0,
          new_balance: newBalance
        }
      });

    console.log(`✅ Баланс пополнен: ${telegramId} = ${newBalance} звезд`);

    res.redirect('/admin?success=true');

  } catch (error) {
    console.error('❌ Ошибка пополнения:', error);
    res.redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Ghost FluX Casino API', 
    version: '1.0',
    endpoints: {
      user: '/api/user/:telegramId',
      openCase: '/api/open-case',
      openBonus: '/api/open-bonus',
      inventory: '/api/inventory/:telegramId',
      admin: '/admin'
    }
  });
});

// Запускаем сервер
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Ghost FluX Casino API запущен на порту ${PORT}`);
  console.log(`📊 Админ панель: https://your-render-url.onrender.com/admin`);
  console.log(`🎮 Mini App API готов к работе!`);
});

export default app;
