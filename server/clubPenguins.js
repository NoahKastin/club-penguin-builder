import db from './db.js';
import { getPenguinCountForCP } from './state.js';

// Determine next ID from existing data
const maxRow = db.prepare('SELECT id FROM club_penguins ORDER BY CAST(SUBSTR(id, 4) AS INTEGER) DESC LIMIT 1').get();
let nextId = maxRow ? parseInt(maxRow.id.slice(3)) + 1 : 1;

function rowToCP(row) {
  return {
    id: row.id,
    name: row.name,
    rooms: JSON.parse(row.rooms),
    spawnRoom: row.spawn_room,
    createdAt: row.created_at,
  };
}

export function createClubPenguin(name, rooms) {
  const id = 'cp_' + (nextId++);
  const spawnRoom = Object.keys(rooms).find(k => rooms[k].spawn) || Object.keys(rooms)[0];
  const createdAt = Date.now();
  db.prepare('INSERT INTO club_penguins (id, name, rooms, spawn_room, created_at) VALUES (?, ?, ?, ?, ?)').run(id, name, JSON.stringify(rooms), spawnRoom, createdAt);
  return { id, name, rooms, spawnRoom, createdAt };
}

export function getClubPenguin(cpId) {
  const row = db.prepare('SELECT * FROM club_penguins WHERE id = ?').get(cpId);
  return row ? rowToCP(row) : undefined;
}

export function updateClubPenguin(cpId, name, rooms) {
  const spawnRoom = Object.keys(rooms).find(k => rooms[k].spawn) || Object.keys(rooms)[0];
  const result = db.prepare('UPDATE club_penguins SET name = ?, rooms = ?, spawn_room = ? WHERE id = ?').run(name, JSON.stringify(rooms), spawnRoom, cpId);
  if (result.changes === 0) return null;
  return { id: cpId, name, rooms, spawnRoom };
}

export function listClubPenguins() {
  const rows = db.prepare('SELECT * FROM club_penguins').all();
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    roomCount: Object.keys(JSON.parse(row.rooms)).length,
    penguinCount: getPenguinCountForCP(row.id),
  }));
}

// Seed "Outdoors" only on first run (empty DB)
const count = db.prepare('SELECT COUNT(*) AS cnt FROM club_penguins').get().cnt;
if (count === 0) {
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
}
