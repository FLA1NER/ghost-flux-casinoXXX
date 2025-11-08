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
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', userId)
      .single();

    if (user.balance < casePrice) {
      throw new Error('Недостаточно звёзд');
    }

    // Списываем звёзды
    const newBalance = user.balance - casePrice;
    await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', userId);

    // Генерируем предмет
    const wonItem = this.getRandomItem(this.caseItems);

    // Добавляем в инвентарь
    const { data: inventoryItem } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        item_type: wonItem.type,
        item_name: wonItem.name,
        item_price: wonItem.price,
        item_emoji: wonItem.emoji
      })
      .select()
      .single();

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'case_open',
        amount: -casePrice,
        details: { 
          case_type: 'gift_box',
          won_item: wonItem,
          inventory_id: inventoryItem.id 
        }
      });

    return { wonItem, newBalance, inventoryId: inventoryItem.id };
  }

  // Вращение рулетки
  static async spinRoulette(userId) {
    const roulettePrice = parseInt(process.env.ROULETTE_PRICE);
    
    // Проверяем баланс
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', userId)
      .single();

    if (user.balance < roulettePrice) {
      throw new Error('Недостаточно звёзд');
    }

    // Списываем звёзды
    const newBalance = user.balance - roulettePrice;
    await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('telegram_id', userId);

    // Генерируем предмет
    const wonItem = this.getRandomItem(this.rouletteItems);

    // Добавляем в инвентарь
    const { data: inventoryItem } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        item_type: wonItem.type,
        item_name: wonItem.name,
        item_price: wonItem.price,
        item_emoji: wonItem.emoji
      })
      .select()
      .single();

    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'roulette_spin',
        amount: -roulettePrice,
        details: { 
          won_item: wonItem,
          inventory_id: inventoryItem.id 
        }
      });

    return { wonItem, newBalance, inventoryId: inventoryItem.id };
  }
}
