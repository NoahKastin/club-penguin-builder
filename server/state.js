const penguins = new Map();

export function addPenguin(socketId, name, cpId, spawnRoom, accountId = null) {
  const penguin = {
    id: socketId,
    name,
    cpId,
    roomId: spawnRoom,
    accountId,
    x: 400,
    y: 350,
    inventory: [], // all collected items
    clothes: [],   // currently worn items (subset of inventory)
    hideEmoji: false,
  };
  penguins.set(socketId, penguin);
  return penguin;
}

export function removePenguin(socketId) {
  const penguin = penguins.get(socketId);
  penguins.delete(socketId);
  return penguin;
}

export function getPenguin(socketId) {
  return penguins.get(socketId);
}

export function movePenguin(socketId, x, y) {
  const penguin = penguins.get(socketId);
  if (penguin) {
    penguin.x = x;
    penguin.y = y;
  }
  return penguin;
}

export function addToInventory(socketId, item) {
  const penguin = penguins.get(socketId);
  if (penguin) {
    const duplicate = penguin.inventory.some(i =>
      i.catalogId === item.catalogId &&
      i.wearOffsetX === item.wearOffsetX &&
      i.wearOffsetY === item.wearOffsetY &&
      i.wearWidth === item.wearWidth &&
      i.wearHeight === item.wearHeight
    );
    if (!duplicate) {
      penguin.inventory.push(item);
    }
  }
  return penguin;
}

export function equipItem(socketId, inventoryIndex) {
  const penguin = penguins.get(socketId);
  if (penguin && inventoryIndex >= 0 && inventoryIndex < penguin.inventory.length) {
    const item = penguin.inventory[inventoryIndex];
    // Check if already worn (by index reference)
    if (!penguin.clothes.some(c => c === item)) {
      penguin.clothes.push(item);
    }
  }
  return penguin;
}

export function unequipItem(socketId, clothesIndex) {
  const penguin = penguins.get(socketId);
  if (penguin && clothesIndex >= 0 && clothesIndex < penguin.clothes.length) {
    penguin.clothes.splice(clothesIndex, 1);
  }
  return penguin;
}

export function changePenguinRoom(socketId, roomId) {
  const penguin = penguins.get(socketId);
  if (penguin) {
    penguin.roomId = roomId;
    penguin.x = 400;
    penguin.y = 350;
  }
  return penguin;
}

export function getPenguinCountForCP(cpId) {
  let count = 0;
  for (const penguin of penguins.values()) {
    if (penguin.cpId === cpId) count++;
  }
  return count;
}

export function getPenguinsInCPRoom(cpId, roomId) {
  const result = [];
  for (const penguin of penguins.values()) {
    if (penguin.cpId === cpId && penguin.roomId === roomId) {
      result.push(penguin);
    }
  }
  return result;
}
