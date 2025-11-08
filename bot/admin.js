import { supabase } from '../config/database.js';

export class AdminPanel {
  // Пополнение баланса пользователя
  static async addBalanceToUser(telegramId, amount, adminId) {
    if (adminId !== parseInt(process.env.ADMIN_USER_ID)) {
      throw new Error('Недостаточно прав');
    }

    // Находим пользователя
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) throw new Error('Пользователь не найден');

    // Обновляем баланс
    const newBalance = user.balance + amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', telegramId);

    if (updateError) throw updateError;

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: telegramId,
        type: 'deposit',
        amount: amount,
        details: { admin_id: adminId, method: 'manual' }
      });

    return { success: true, newBalance, username: user.username };
  }

  // Получение статистики
  static async getStats() {
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    const { data: totalBalance } = await supabase
      .from('users')
      .select('balance');

    const totalStars = totalBalance.reduce((sum, user) => sum + user.balance, 0);

    return {
      totalUsers,
      totalStars,
      averageBalance: totalStars / totalUsers
    };
  }

  // Получение заявок на вывод
  static async getWithdrawalRequests() {
    const { data: requests, error } = await supabase
      .from('withdrawal_requests')
      .select(`
        *,
        users (username, first_name),
        inventory (item_name, item_price, item_emoji)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return requests;
  }

  // Подтверждение вывода
  static async confirmWithdrawal(requestId, adminId) {
    if (adminId !== parseInt(process.env.ADMIN_USER_ID)) {
      throw new Error('Недостаточно прав');
    }

    // Обновляем статус заявки
    const { error: updateError } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'completed' })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // Получаем данные заявки
    const { data: request } = await supabase
      .from('withdrawal_requests')
      .select('inventory_id')
      .eq('id', requestId)
      .single();

    // Обновляем статус предмета в инвентаре
    const { error: inventoryError } = await supabase
      .from('inventory')
      .update({ status: 'withdrawn' })
      .eq('id', request.inventory_id);

    if (inventoryError) throw inventoryError;

    return { success: true };
  }
}
