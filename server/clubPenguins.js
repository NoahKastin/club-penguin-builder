import { getPenguinCountForCP } from './state.js';

const clubPenguins = new Map();
let nextId = 1;

export function createClubPenguin(name, rooms) {
  const id = 'cp_' + (nextId++);
  const spawnRoom = Object.keys(rooms).find(k => rooms[k].spawn) || Object.keys(rooms)[0];
  const cp = { id, name, rooms, spawnRoom, createdAt: Date.now() };
  clubPenguins.set(id, cp);
  return cp;
}

export function getClubPenguin(cpId) {
  return clubPenguins.get(cpId);
}

export function updateClubPenguin(cpId, name, rooms) {
  const cp = clubPenguins.get(cpId);
  if (!cp) return null;
  cp.name = name;
  cp.rooms = rooms;
  cp.spawnRoom = Object.keys(rooms).find(k => rooms[k].spawn) || Object.keys(rooms)[0];
  return cp;
}

export function listClubPenguins() {
  return [...clubPenguins.values()].map(cp => ({
    id: cp.id,
    name: cp.name,
    roomCount: Object.keys(cp.rooms).length,
    penguinCount: getPenguinCountForCP(cp.id),
  }));
}

// Seed "Outdoors" CP with the original patio/veranda rooms
createClubPenguin('Outdoors', {
  patio: {
    id: 'patio',
    name: 'Patio',
    bgColor: '#8B6914',
    spawn: true,
    exits: [
      { targetRoom: 'veranda', label: 'Veranda →', x: 710, y: 200, width: 80, height: 120 },
    ],
  },
  veranda: {
    id: 'veranda',
    name: 'Veranda',
    bgColor: '#2E7D32',
    spawn: false,
    exits: [
      { targetRoom: 'patio', label: '← Patio', x: 10, y: 200, width: 80, height: 120 },
    ],
  },
});
