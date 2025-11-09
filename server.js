import express from 'express';
import { bot, startBot } from './bot/bot.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Ghost FluX Bot',
    botStatus: 'running',
    timestamp: new Date().toISOString()
  });
});

// Запускаем сервер и бота
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Запускаем бота
  startBot().then(() => {
    console.log('✅ Bot initialization completed');
  }).catch(error => {
    console.error('❌ Bot failed to start:', error);
  });
});

// Экспортируем для тестирования
export default app;
