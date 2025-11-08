import { DatabaseOperations } from '../database/operations.js';
import { supabase } from '../config/database.js';

export class GameLogic {
  // Шансы для кейса Gift Box
  static caseItems = [
    { type: 'bear', name: 'Мишка', emoji: '🧸', price: 15, chance: 35 },
    { type: 'heart', name: 'Сердечко', emoji: '💝', price: 15, chance: 35 },
    { type: 'rose', name: 'Роза', emoji: '🌹', price: 25, chance: 7.5 },
    { type: 'gift', name: 'Подарок', emoji: '🎁', price: 25, chance: 7.5 },
    { type: 'rocket', name: 'Ракета', emoji: '🚀', price: 50, chance: 5 },
    { type: 'champagne', name: 'Шампанское', emoji: '🍾', price: 50, chance: 5 },
    { type: 'trophy', name: 'Кубок', emoji: '🏆', price: 100, chance: 2.5 },
    { type: 'ring', name: 'Кольцо', emoji: '💍', price: 100, chance: 2.5 }
  ];

  // Шансы для рулетки
  static rouletteItems = [
    { type: 'bear', name: 'Мишка', emoji: '🧸', price: 15, chance: 34.5 },
    { type: 'heart', name: 'Сердечко', emoji: '💝', price: 15, chance: 34.5 },
    { type: 'rose', name: 'Роза', emoji: '🌹', price: 25, chance: 7.5 },
    { type: 'gift', name: 'Подарок', emoji: '🎁', price: 25, chance: 7.5 },
    { type: 'rocket', name: 'Ракета', emoji: '🚀', price: 50, chance: 5 },
    { type: 'champagne', name: 'Шампанское', emoji: '🍾', price: 50, chance: 5 },
    { type: 'trophy', name: 'Кубок', emoji: '🏆', price: 100, chance: 2.5 },
    { type: 'ring', name: 'Кольцо', emoji: '💍', price: 100, chance: 2.5 },
    { type: 'nft', name: 'Random NFT Gift', emoji: '❔', price: 500, chance: 1 }
  ];

  // Генерация случайного предмета по шансам
  static getRandomItem(items) {
    const random = Math.random() * 100;
    let currentChance = 0;

    for (const item of items) {
      currentChance += item.chance;
      if (random <= currentChance) {
        return item;
      }
    }
    return items[items.length - 1];
  }

  // Открытие кейса
  static async openCase(userId) {
    const casePrice = parseInt(process.env.CASE_PRICE);
    
    // Проверяем баланс
    const { data: user, error: userError } = await DatabaseOperations.getUser(userId);
    if (userError) throw new Error('Ошибка получения данных пользователя');

    if (user.balance < casePrice) {
      throw new Error('Недостаточно звёзд');
    }

    // Списываем звёзды
    const newBalance = user.balance - casePrice;
    const { error: updateError } = await DatabaseOperations.updateBalance(userId, newBalance);
    if (updateError) throw updateError;

    // Генерируем предмет
    const wonItem = this.getRandomItem(this.caseItems);

    // Добавляем в инвентарь
    const { data: inventoryItem, error: inventoryError } = await DatabaseOperations.addToInventory(userId, wonItem);
    if (inventoryError) throw inventoryError;

    // Записываем транзакцию
    await DatabaseOperations.createTransaction(
      userId, 
      'case_open', 
      -casePrice, 
      { 
        case_type: 'gift_box',
        won_item: wonItem,
        inventory_id: inventoryItem[0].id 
      }
    );

    return { 
      wonItem, 
      newBalance, 
      inventoryId: inventoryItem[0].id 
    };
  }

  // Вращение рулетки
  static async spinRoulette(userId) {
    const roulettePrice = parseInt(process.env.ROULETTE_PRICE);
    
    // Проверяем баланс
    const { data: user, error: userError } = await DatabaseOperations.getUser(userId);
    if (userError) throw new Error('Ошибка получения данных пользователя');

    if (user.balance < roulettePrice) {
      throw new Error('Недостаточно звёзд');
    }

    // Списываем звёзды
    const newBalance = user.balance - roulettePrice;
    const { error: updateError } = await DatabaseOperations.updateBalance(userId, newBalance);
    if (updateError) throw updateError;

    // Генерируем предмет
    const wonItem = this.getRandomItem(this.rouletteItems);

    // Добавляем в инвентарь
    const { data: inventoryItem, error: inventoryError } = await DatabaseOperations.addToInventory(userId, wonItem);
    if (inventoryError) throw inventoryError;

    // Записываем транзакцию
    await DatabaseOperations.createTransaction(
      userId, 
      'roulette_spin', 
      -roulettePrice, 
      { 
        won_item: wonItem,
        inventory_id: inventoryItem[0].id 
      }
    );

    return { 
      wonItem, 
      newBalance, 
      inventoryId: inventoryItem[0].id 
    };
  }

  // Бонусный кейс
  static async openBonusCase(userId) {
    // Проверяем подписку на канал (пока заглушка - всегда true)
    const isSubscribed = await DatabaseOperations.checkChannelSubscription(userId);
    
    if (!isSubscribed) {
      throw new Error('Для получения бонуса нужно быть подписанным на канал @Ghost_FluX');
    }

    // Проверяем когда последний раз получал бонус
    const { data: user } = await DatabaseOperations.getUser(userId);
    const now = new Date();
    const lastBonus = user.last_bonus_claim ? new Date(user.last_bonus_claim) : null;

    if (lastBonus && (now - lastBonus) < 24 * 60 * 60 * 1000) {
      const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - lastBonus)) / (60 * 60 * 1000));
      throw new Error(`Следующий бонусный кейс через ${hoursLeft} часов`);
    }

    // Генерируем случайное количество звезд
    const minStars = parseInt(process.env.BONUS_MIN_STARS);
    const maxStars = parseInt(process.env.BONUS_MAX_STARS);
    const starsWon = Math.floor(Math.random() * (maxStars - minStars + 1)) + minStars;

    // Обновляем баланс
    const newBalance = (user.balance || 0) + starsWon;
    await DatabaseOperations.updateBalance(userId, newBalance);

    // Обновляем время последнего бонуса
    await supabase
      .from('users')
      .update({ last_bonus_claim: now.toISOString() })
      .eq('telegram_id', userId);

    // Записываем транзакцию
    await DatabaseOperations.createTransaction(
      userId, 
      'bonus', 
      starsWon, 
      { 
        bonus_type: 'daily',
        stars_won: starsWon
      }
    );

    return { 
      starsWon, 
      newBalance 
    };
  }
}
