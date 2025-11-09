import express from 'express';
import { bot } from './bot/bot.js';
import { AdminPanel } from './bot/admin.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Ghost FluX Bot',
    timestamp: new Date().toISOString()
  });
});

// Temporary admin API for balance top-up
app.post('/api/admin/add-balance', async (req, res) => {
  try {
    const { telegramId, amount, adminKey } = req.body;
    
    if (adminKey !== process.env.ADMIN_USER_ID.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await AdminPanel.addBalanceToUser(
      parseInt(telegramId), 
      parseInt(amount), 
      parseInt(adminKey)
    );
    
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple web interface for balance top-up
app.get('/admin', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Ghost FluX Admin</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          input, button { padding: 10px; margin: 5px; width: 200px; }
          button { background: #007bff; color: white; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>👻 Ghost FluX Admin - Add Balance</h2>
        <form action="/api/admin/add-balance" method="post">
          <input type="number" name="telegramId" placeholder="Telegram ID" required><br>
          <input type="number" name="amount" placeholder="Amount" required><br>
          <input type="text" name="adminKey" placeholder="Admin Key" required><br>
          <button type="submit">Add Balance</button>
        </form>
        <p><strong>Admin Key:</strong> ${process.env.ADMIN_USER_ID}</p>
        <p><strong>How to use:</strong></p>
        <ol>
          <li>Get user's Telegram ID using @userinfobot</li>
          <li>Enter the amount of stars to add</li>
          <li>Use admin key: ${process.env.ADMIN_USER_ID}</li>
          <li>Click "Add Balance"</li>
        </ol>
      </body>
    </html>
  `);
});

// Запускаем сервер
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Запускаем бота в polling режиме с ретраями
  startBotWithRetries();
});

// Функция запуска бота с ретраями
async function startBotWithRetries() {
  let retryCount = 0;
  const maxRetries = 10;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`🤖 Attempting to start bot... (attempt ${retryCount + 1}/${maxRetries})`);
      
      // Сначала сбрасываем вебхук
      await bot.telegram.deleteWebhook();
      console.log('✅ Webhook reset successfully');
      
      // Ждем 2 секунды
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Запускаем бота в polling режиме
      await bot.launch();
      console.log('✅ Bot started successfully in polling mode!');
      console.log('🎰 Ghost FluX Casino is now LIVE!');
      break;
      
    } catch (error) {
      retryCount++;
      console.error(`❌ Bot start failed (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error('🚨 Failed to start bot after all attempts');
        console.log('💡 Temporary solution: Use the admin panel at /admin to manage balances');
        break;
      }
      
      const delay = Math.min(2000 * retryCount, 30000);
      console.log(`⏳ Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export default app;
