import express from 'express';
import { bot } from './bot/bot.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'webhook mode' });
});

// Webhook endpoint for Telegram
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Set webhook on startup
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  try {
    // Устанавливаем вебхук
    const webhookUrl = `https://ghost-flux-casinoxxx.onrender.com/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ Webhook set successfully');
    
    // Запускаем бота в вебхук режиме
    bot.startWebhook(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, null, PORT);
    console.log('✅ Bot started in webhook mode');
  } catch (error) {
    console.error('❌ Webhook setup failed:', error.message);
  }
});

export default app;
