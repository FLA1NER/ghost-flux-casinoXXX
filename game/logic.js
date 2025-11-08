import { DatabaseOperations } from '../database/operations.js';

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
}
