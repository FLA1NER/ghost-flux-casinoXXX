import express from 'express';
import { startBot } from './bot/bot.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Ghost FluX Bot',
    timestamp: new Date().toISOString()
  });
});

// Запускаем сервер
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  // Запускаем бота после старта сервера
  startBot();
});

export default app;
