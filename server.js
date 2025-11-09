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

// Webhook endpoint for Telegram
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Temporary admin API for balance top-up
app.post('/api/admin/add-balance', async (req, res) => {
  try {
    const { telegramId, amount, adminKey } = req.body;
    
    // Простая проверка админа
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
      </body>
    </html>
  `);
});

// Set webhook on startup
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  try {
    // Устанавливаем вебхук
    const webhookUrl = `https://${process.env.RENDER_EXTERNAL_URL || 'ghost-flux-casinoxxx.onrender.com'}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ Webhook set successfully:', webhookUrl);
    console.log('🤖 Bot is ready in webhook mode!');
  } catch (error) {
    console.error('❌ Webhook setup failed:', error.message);
  }
});

export default app;
