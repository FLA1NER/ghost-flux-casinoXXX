import { supabase } from '../config/database.js';

export class AdminPanel {
  // Пополнение баланса пользователя (ИСПРАВЛЕННАЯ ВЕРСИЯ)
  static async addBalanceToUser(telegramId, amount, adminId) {
    if (adminId !== parseInt(process.env.ADMIN_USER_ID)) {
      throw new Error('Недостаточно прав');
    }

    console.log(`Пополнение баланса для ${telegramId} на ${amount} звезд`);

    // Находим пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (userError) {
      console.error('Ошибка поиска пользователя:', userError);
      throw new Error('Пользователь не найден');
    }

    if (!user) {
      throw new Error('Пользователь не найден в базе');
    }

    // Обновляем баланс
    const newBalance = (user.balance || 0) + amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', telegramId);

    if (updateError) {
      console.error('Ошибка обновления баланса:', updateError);
      throw updateError;
    }

    // Записываем транзакцию
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: telegramId,
        type: 'deposit',
        amount: amount,
        details: { admin_id: adminId, method: 'manual' }
      });

    if (transactionError) {
      console.error('Ошибка записи транзакции:', transactionError);
    }

    console.log(`Баланс успешно пополнен. Новый баланс: ${newBalance}`);

    return { 
      success: true, 
      newBalance, 
      username: user.username || user.first_name 
    };
  }

  // Получение статистики
  static async getStats() {
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    const { data: users, error: balanceError } = await supabase
      .from('users')
      .select('balance');

    if (usersError || balanceError) {
      throw new Error('Ошибка получения статистики');
    }

    const totalStars = users.reduce((sum, user) => sum + (user.balance || 0), 0);
    const averageBalance = totalUsers > 0 ? totalStars / totalUsers : 0;

    return {
      totalUsers: totalUsers || 0,
      totalStars,
      averageBalance: Math.round(averageBalance)
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
    return requests || [];
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
