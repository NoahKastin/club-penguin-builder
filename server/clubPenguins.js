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
    spawnConfig: row.spawn_config ? JSON.parse(row.spawn_config) : { mode: 'fixed', x: 400, y: 350 },
    creatorId: row.creator_id || null,
    createdAt: row.created_at,
  };
}

export function createClubPenguin(name, rooms, creatorId = null, spawnConfig = null) {
  const id = 'cp_' + (nextId++);
  const spawnRoom = Object.keys(rooms).find(k => !rooms[k].hidden) || Object.keys(rooms)[0];
  const createdAt = Date.now();
  const sc = spawnConfig || { mode: 'fixed', x: 400, y: 350 };
  db.prepare('INSERT INTO club_penguins (id, name, rooms, spawn_room, created_at, creator_id, spawn_config) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name, JSON.stringify(rooms), spawnRoom, createdAt, creatorId, JSON.stringify(sc));
  return { id, name, rooms, spawnRoom, spawnConfig: sc, creatorId, createdAt };
}

export function getClubPenguin(cpId) {
  const row = db.prepare('SELECT * FROM club_penguins WHERE id = ?').get(cpId);
  return row ? rowToCP(row) : undefined;
}

export function updateClubPenguin(cpId, name, rooms, spawnConfig = null) {
  const spawnRoom = Object.keys(rooms).find(k => !rooms[k].hidden) || Object.keys(rooms)[0];
  if (spawnConfig) {
    const result = db.prepare('UPDATE club_penguins SET name = ?, rooms = ?, spawn_room = ?, spawn_config = ? WHERE id = ?').run(name, JSON.stringify(rooms), spawnRoom, JSON.stringify(spawnConfig), cpId);
    if (result.changes === 0) return null;
    return { id: cpId, name, rooms, spawnRoom, spawnConfig };
  }
  const result = db.prepare('UPDATE club_penguins SET name = ?, rooms = ?, spawn_room = ? WHERE id = ?').run(name, JSON.stringify(rooms), spawnRoom, cpId);
  if (result.changes === 0) return null;
  const existing = getClubPenguin(cpId);
  return { id: cpId, name, rooms, spawnRoom, spawnConfig: existing?.spawnConfig || { mode: 'fixed', x: 400, y: 350 } };
}

export function updateRoomItemPosition(cpId, roomId, itemIndex, x, y) {
  const cp = getClubPenguin(cpId);
  if (!cp || !cp.rooms[roomId]) return false;
  const items = cp.rooms[roomId].items;
  if (!items || itemIndex < 0 || itemIndex >= items.length) return false;
  items[itemIndex].x = x;
  items[itemIndex].y = y;
  db.prepare('UPDATE club_penguins SET rooms = ? WHERE id = ?').run(JSON.stringify(cp.rooms), cpId);
  return true;
}

export function listClubPenguins() {
  const rows = db.prepare(`
    SELECT cp.*, (SELECT MAX(launched_at) FROM parties WHERE cp_id = cp.id) AS latest_party
    FROM club_penguins cp
  `).all();
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    roomCount: Object.keys(JSON.parse(row.rooms)).length,
    penguinCount: getPenguinCountForCP(row.id),
    creatorId: row.creator_id || null,
    createdAt: row.created_at,
    latestParty: row.latest_party || null,
  }));
}
