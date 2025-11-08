import { supabase } from '../config/database.js';

export class DatabaseOperations {
  // Создание нового пользователя
  static async createUser(telegramId, username, firstName) {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: telegramId,
        username: username,
        first_name: firstName,
        balance: 0,
        last_bonus_claim: null
      }, { onConflict: 'telegram_id' });
    
    return { data, error };
  }

  // Получение пользователя
  static async getUser(telegramId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    return { data, error };
  }

  // Обновление баланса
  static async updateBalance(telegramId, newBalance) {
    const { data, error } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', telegramId)
      .select();
    
    return { data, error };
  }

  // Добавление предмета в инвентарь
  static async addToInventory(userId, item) {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        item_type: item.type,
        item_name: item.name,
        item_price: item.price,
        item_emoji: item.emoji,
        status: 'active'
      })
      .select();
    
    return { data, error };
  }

  // Получение инвентаря пользователя
  static async getUserInventory(telegramId) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', telegramId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    return { data, error };
  }

  // Создание транзакции
  static async createTransaction(userId, type, amount, details = {}) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: type,
        amount: amount,
        details: details
      });
    
    return { data, error };
  }

  // Проверка подписки на канал
  static async checkChannelSubscription(telegramId) {
    // Эта функция будет интегрирована с Telegram API
    // Пока возвращаем true для тестирования
    return true;
  }

  // Получение статистики
  static async getStats() {
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    const { data: balances, error: balanceError } = await supabase
      .from('users')
      .select('balance');

    if (usersError || balanceError) {
      throw new Error('Error getting stats');
    }

    const totalStars = balances.reduce((sum, user) => sum + user.balance, 0);
    const averageBalance = totalUsers > 0 ? totalStars / totalUsers : 0;

    return {
      totalUsers,
      totalStars,
      averageBalance: Math.round(averageBalance)
    };
  }
}
