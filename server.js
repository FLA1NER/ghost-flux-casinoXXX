import express from 'express';
import { bot } from './bot/bot.js';
import { supabase } from './config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Главная админ-страница
app.get('/admin', async (req, res) => {
  try {
    // Получаем список пользователей
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    let usersHtml = '';
    if (users && users.length > 0) {
      users.forEach(user => {
        usersHtml += `
          <tr>
            <td>${user.telegram_id}</td>
            <td>${user.username || 'N/A'}</td>
            <td>${user.first_name || 'N/A'}</td>
            <td>${user.balance} ⭐</td>
            <td>
              <form action="/admin/add-balance" method="post" style="display: inline;">
                <input type="hidden" name="telegramId" value="${user.telegram_id}">
                <input type="number" name="amount" placeholder="Сумма" required style="width: 80px;">
                <button type="submit">➕</button>
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
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a2e; color: white; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; }
          .neon-text { 
            color: #00ffff; 
            text-shadow: 0 0 10px #00ffff;
            font-size: 2.5em;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            overflow: hidden;
          }
          th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid rgba(255,255,255,0.2);
          }
          th { 
            background: rgba(0, 255, 255, 0.2);
            color: #00ffff;
          }
          input, button { 
            padding: 8px; 
            border: none; 
            border-radius: 5px; 
          }
          input { 
            background: rgba(255,255,255,0.9); 
            color: #000;
          }
          button { 
            background: #00ff00; 
            color: black; 
            cursor: pointer;
            font-weight: bold;
          }
          button:hover { background: #00cc00; }
          .success { color: #00ff00; padding: 10px; background: rgba(0,255,0,0.1); border-radius: 5px; }
          .error { color: #ff4444; padding: 10px; background: rgba(255,0,0,0.1); border-radius: 5px; }
          .search-box { margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; }
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
              <input type="text" name="query" placeholder="Введите Telegram ID или username" style="width: 300px;">
              <button type="submit">Найти</button>
            </form>
          </div>

          <h3>📊 Последние пользователи</h3>
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
              ${usersHtml || '<tr><td colspan="5" style="text-align: center;">Нет пользователей</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 10px;">
            <h3>💫 Создать нового пользователя</h3>
            <form action="/admin/create-user" method="post">
              <input type="number" name="telegramId" placeholder="Telegram ID" required>
              <input type="text" name="username" placeholder="Username">
              <input type="text" name="firstName" placeholder="Имя" required>
              <button type="submit">Создать пользователя</button>
            </form>
          </div>
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
    if (!query) {
      return res.redirect('/admin');
    }

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
            <td>${user.username || 'N/A'}</td>
            <td>${user.first_name || 'N/A'}</td>
            <td>${user.balance} ⭐</td>
            <td>
              <form action="/admin/add-balance" method="post" style="display: inline;">
                <input type="hidden" name="telegramId" value="${user.telegram_id}">
                <input type="number" name="amount" placeholder="Сумма" required style="width: 80px;">
                <button type="submit">➕</button>
              </form>
            </td>
          </tr>
        `;
      });
    } else {
      usersHtml = '<tr><td colspan="5" style="text-align: center;">Пользователь не найден</td></tr>';
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

    if (updateError) {
      throw updateError;
    }

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

    // Отправляем уведомление пользователю в Telegram
    try {
      await bot.telegram.sendMessage(
        parseInt(telegramId),
        `🎉 *Ваш баланс пополнен!*\n\n➕ Добавлено: ${amount} звёзд\n✨ Новый баланс: ${newBalance} звёзд\n\nСпасибо за покупку! 🎰`,
        { parse_mode: 'Markdown' }
      );
    } catch (tgError) {
      console.log('Не удалось отправить уведомление пользователю:', tgError.message);
    }

    res.redirect('/admin?success=true');

  } catch (error) {
    console.error('Ошибка пополнения баланса:', error);
    res.redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }
});

// Создание пользователя
app.post('/admin/create-user', async (req, res) => {
  try {
    const { telegramId, username, firstName } = req.body;
    
    if (!telegramId || !firstName) {
      return res.redirect('/admin?error=Заполните обязательные поля');
    }

    const { error } = await supabase
      .from('users')
      .upsert({
        telegram_id: parseInt(telegramId),
        username: username || null,
        first_name: firstName,
        balance: 0
      }, { onConflict: 'telegram_id' });

    if (error) {
      throw error;
    }

    res.redirect('/admin?success=true');

  } catch (error) {
    res.redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }
});

// Запускаем сервер
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Admin panel running on port ${PORT}`);
  console.log(`📊 Admin URL: https://your-render-url.onrender.com/admin`);
  
  // Запускаем бота
  startBot();
});

// Функция запуска бота
async function startBot() {
  try {
    await bot.launch();
    console.log('✅ Bot started successfully!');
  } catch (error) {
    console.error('❌ Bot failed to start:', error.message);
    console.log('💡 Bot is optional, admin panel will work without it');
  }
}

export default app;
