const penguins = new Map();

export function addPenguin(socketId, name, cpId, spawnRoom) {
  const penguin = {
    id: socketId,
    name,
    cpId,
    roomId: spawnRoom,
    x: 400,
    y: 350,
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

export function changePenguinRoom(socketId, roomId) {
  const penguin = penguins.get(socketId);
  if (penguin) {
    penguin.roomId = roomId;
    penguin.x = 400;
    penguin.y = 350;
  }
  return penguin;
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
