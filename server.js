import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Простой health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Ghost FluX Bot' });
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`🚀 Health check server running on port ${PORT}`);
});

// Экспортируем для Render
export default app;
