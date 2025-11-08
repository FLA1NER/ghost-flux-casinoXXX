import express from 'express';
import cors from 'cors';
import { supabase } from '../config/database.js';
import { GameLogic } from '../game/logic.js';
import { AdminPanel } from '../bot/admin.js';
import dotenv from 'dotenv';

dotenv.config();

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

    if (error && error.code !== 'PGRST116') throw error;
    
    if (!user) {
      // Создаем нового пользователя
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          telegram_id: parseInt(telegramId),
          username: 'user_' + telegramId,
          first_name: 'User',
          balance: 0
        })
        .select()
        .single();
        
      return res.json(newUser || { balance: 0 });
    }

    // Получаем инвентарь пользователя
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', parseInt(telegramId))
      .eq('status', 'active');

    res.json({
      ...user,
      inventory: inventory || []
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Открытие кейса
app.post('/api/open-case', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await GameLogic.openCase(parseInt(userId));
    
    res.json({
      success: true,
      wonItem: result.wonItem,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Error opening case:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Вращение рулетки
app.post('/api/spin-roulette', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await GameLogic.spinRoulette(parseInt(userId));
    
    res.json({
      success: true,
      wonItem: result.wonItem,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Error spinning roulette:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Получение инвентаря
app.get('/api/inventory/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', parseInt(telegramId))
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    res.json(inventory || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Заявка на вывод подарка
app.post('/api/withdraw-item', async (req, res) => {
  try {
    const { userId, inventoryId } = req.body;
    
    // Создаем заявку на вывод
    const { data: request, error } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: parseInt(userId),
        inventory_id: parseInt(inventoryId)
      })
      .select(`
        *,
        users (username, first_name),
        inventory (item_name, item_price, item_emoji)
      `)
      .single();

    if (error) throw error;

    // Отправляем уведомление админу (здесь будет интеграция с ботом)
    console.log('📨 Новая заявка на вывод:', request);

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Продажа предмета
app.post('/api/sell-item', async (req, res) => {
  try {
    const { userId, inventoryId } = req.body;
    
    // Получаем информацию о предмете
    const { data: item, error: itemError } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', parseInt(inventoryId))
      .eq('user_id', parseInt(userId))
      .single();

    if (itemError) throw itemError;

    // Рассчитываем цену продажи (цена * 1.2)
    const sellPrice = Math.floor(item.item_price * 1.2);

    // Обновляем баланс пользователя
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', parseInt(userId))
      .single();

    const newBalance = user.balance + sellPrice;

    await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', parseInt(userId));

    // Помечаем предмет как проданный
    await supabase
      .from('inventory')
      .update({ status: 'sold' })
      .eq('id', parseInt(inventoryId));

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: parseInt(userId),
        type: 'item_sold',
        amount: sellPrice,
        details: { 
          inventory_id: parseInt(inventoryId),
          original_price: item.item_price,
          sell_price: sellPrice
        }
      });

    res.json({ 
      success: true, 
      sellPrice, 
      newBalance,
      itemName: item.item_name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
