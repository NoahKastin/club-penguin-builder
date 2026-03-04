import db from './db.js';

const maxRow = db.prepare('SELECT id FROM catalog_games ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC LIMIT 1').get();
let nextId = maxRow ? parseInt(maxRow.id.slice(5)) + 1 : 1;

export function createGame(name, items, width, height, gravityDirection, creatorId, attribution = '', price = 0) {
  const id = 'game_' + (nextId++);
  const createdAt = Date.now();
  db.prepare('INSERT INTO catalog_games (id, name, creator_id, items, width, height, gravity_direction, price, attribution, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, name, creatorId, JSON.stringify(items), width, height, gravityDirection || null, price, attribution, createdAt
  );
  return { id, name, creatorId, items, width, height, gravityDirection, price, attribution, createdAt };
}

export function getGame(id) {
  const row = db.prepare('SELECT * FROM catalog_games WHERE id = ?').get(id);
  if (!row) return undefined;
  return {
    id: row.id, name: row.name, creatorId: row.creator_id,
    items: JSON.parse(row.items), width: row.width, height: row.height,
    gravityDirection: row.gravity_direction, price: row.price || 0,
    attribution: row.attribution || '', createdAt: row.created_at,
  };
}

export function gameExistsByName(name) {
  return !!db.prepare('SELECT 1 FROM catalog_games WHERE name = ?').get(name);
}

export function listGames() {
  const rows = db.prepare('SELECT id, name, creator_id, items, width, height, gravity_direction, price, attribution, created_at FROM catalog_games ORDER BY created_at DESC').all();
  return rows.map(row => ({
    id: row.id, name: row.name, creatorId: row.creator_id,
    items: JSON.parse(row.items), width: row.width, height: row.height,
    gravityDirection: row.gravity_direction, price: row.price || 0,
    attribution: row.attribution || '', createdAt: row.created_at,
  }));
}
