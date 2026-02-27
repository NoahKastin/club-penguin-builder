import db from './db.js';

export function loadInventory(accountId) {
  const rows = db.prepare(
    'SELECT catalog_id, name, image, wear_offset_x, wear_offset_y, wear_width, wear_height, equipped FROM account_inventory WHERE account_id = ?'
  ).all(accountId);
  return rows.map(r => ({
    catalogId: r.catalog_id,
    name: r.name,
    image: r.image,
    wearOffsetX: r.wear_offset_x,
    wearOffsetY: r.wear_offset_y,
    wearWidth: r.wear_width,
    wearHeight: r.wear_height,
    equipped: !!r.equipped,
  }));
}

export function saveInventoryItem(accountId, item) {
  db.prepare(
    `INSERT OR IGNORE INTO account_inventory (account_id, catalog_id, name, image, wear_offset_x, wear_offset_y, wear_width, wear_height, equipped)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(accountId, item.catalogId, item.name, item.image, item.wearOffsetX, item.wearOffsetY, item.wearWidth, item.wearHeight);
}

export function setEquipped(accountId, catalogId, wearOffsetX, wearOffsetY, wearWidth, wearHeight, equipped) {
  db.prepare(
    `UPDATE account_inventory SET equipped = ? WHERE account_id = ? AND catalog_id = ? AND wear_offset_x = ? AND wear_offset_y = ? AND wear_width = ? AND wear_height = ?`
  ).run(equipped ? 1 : 0, accountId, catalogId, wearOffsetX, wearOffsetY, wearWidth, wearHeight);
}
