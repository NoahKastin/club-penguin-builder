import db from './db.js';

const maxRow = db.prepare('SELECT id FROM catalog_items ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC LIMIT 1').get();
let nextId = maxRow ? parseInt(maxRow.id.slice(5)) + 1 : 1;

export function createCatalogItem(name, image, uploaderId, attribution = '', price = 0, width = null, height = null) {
  const id = 'item_' + (nextId++);
  const createdAt = Date.now();
  db.prepare('INSERT INTO catalog_items (id, name, image, uploader_id, attribution, price, created_at, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, name, image, uploaderId, attribution, price, createdAt, width, height);
  return { id, name, image, uploaderId, attribution, price, createdAt, width, height };
}

export function getCatalogItem(id) {
  const row = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id);
  if (!row) return undefined;
  return { id: row.id, name: row.name, image: row.image, uploaderId: row.uploader_id, attribution: row.attribution || '', price: row.price || 0, createdAt: row.created_at, width: row.width || null, height: row.height || null };
}

export function catalogItemExistsByName(name) {
  return !!db.prepare('SELECT 1 FROM catalog_items WHERE name = ?').get(name);
}

export function listCatalogItems() {
  const rows = db.prepare('SELECT id, name, image, uploader_id, attribution, price, created_at, width, height FROM catalog_items ORDER BY created_at DESC').all();
  return rows.map(row => ({ id: row.id, name: row.name, image: row.image, uploaderId: row.uploader_id, attribution: row.attribution || '', price: row.price || 0, createdAt: row.created_at, width: row.width || null, height: row.height || null }));
}
