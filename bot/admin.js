import { supabase } from '../config/database.js';
import { DatabaseOperations } from '../database/operations.js';

export class AdminPanel {
  // Пополнение баланса пользователя (ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ updated_at)
  static async addBalanceToUser(telegramId, amount, adminId) {
    try {
      if (adminId !== parseInt(process.env.ADMIN_USER_ID)) {
        throw new Error('Недостаточно прав');
      }

      console.log(`🔧 Пополнение баланса для ${telegramId} на ${amount} звезд`);

      // Находим пользователя
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (userError) {
        console.error('❌ Ошибка поиска пользователя:', userError);
        throw new Error('Пользователь не найден в базе');
      }

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      console.log(`📊 Найден пользователь:`, user);

      // Обновляем баланс (БЕЗ updated_at)
      const newBalance = (user.balance || 0) + parseInt(amount);
      console.log(`💰 Новый баланс: ${newBalance}`);

      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          balance: newBalance
          // Убрали updated_at так как его нет в таблице
        })
        .eq('telegram_id', telegramId);

      if (updateError) {
        console.error('❌ Ошибка обновления баланса:', updateError);
        throw new Error('Ошибка обновления баланса: ' + updateError.message);
      }

      // Записываем транзакцию
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: telegramId,
          type: 'deposit',
          amount: parseInt(amount),
          details: { 
            admin_id: adminId, 
            method: 'manual',
            old_balance: user.balance || 0,
            new_balance: newBalance
          }
        });

      if (transactionError) {
        console.error('⚠️ Ошибка записи транзакции (но баланс пополнен):', transactionError);
        // Не бросаем ошибку, так как баланс уже пополнен
      }

      console.log(`✅ Баланс успешно пополнен. Новый баланс: ${newBalance}`);

      return { 
        success: true, 
        newBalance, 
        username: user.username || user.first_name || 'Пользователь'
      };

    } catch (error) {
      console.error('❌ Критическая ошибка в addBalanceToUser:', error);
      throw error;
    }
  }

  // Получение статистики
  static async getStats() {
    try {
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact' });

      const { data: users, error: balanceError } = await supabase
        .from('users')
        .select('balance');

      if (usersError || balanceError) {
        console.error('Ошибка получения статистики:', usersError || balanceError);
        throw new Error('Ошибка получения статистики');
      }

      const totalStars = users.reduce((sum, user) => sum + (user.balance || 0), 0);
      const averageBalance = totalUsers > 0 ? totalStars / totalUsers : 0;

      return {
        totalUsers: totalUsers || 0,
        totalStars,
        averageBalance: Math.round(averageBalance)
      };
    } catch (error) {
      console.error('Ошибка в getStats:', error);
      throw error;
    }
  }

  // Получение заявок на вывод
  static async getWithdrawalRequests() {
    try {
      const { data: requests, error } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          users (username, first_name),
          inventory (item_name, item_price, item_emoji)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Ошибка получения заявок:', error);
        throw error;
      }
      
      return requests || [];
    } catch (error) {
      console.error('Ошибка в getWithdrawalRequests:', error);
      throw error;
    }
  }

  // Подтверждение вывода
  static async confirmWithdrawal(requestId, adminId) {
    try {
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
    } catch (error) {
      console.error('Ошибка в confirmWithdrawal:', error);
      throw error;
    }
  }
}
