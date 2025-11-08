import express from 'express';
import cors from 'cors';
import { supabase } from '../config/database.js';

const app = express();
app.use(cors());
app.use(express.json());

// Получение данных пользователя
app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) throw error;
    res.json(user || { balance: 0, inventory: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
