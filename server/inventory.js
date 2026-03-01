import db from './db.js';

export function loadInventory(accountId) {
  const rows = db.prepare(
    'SELECT catalog_id, name, image, wear_offset_x, wear_offset_y, wear_width, wear_height, equipped, equip_order, attribution, collected_at FROM account_inventory WHERE account_id = ? ORDER BY equip_order ASC'
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
    attribution: r.attribution || '',
    collectedAt: r.collected_at || 0,
  }));
}

export function saveInventoryItem(accountId, item) {
  db.prepare(
    `INSERT OR IGNORE INTO account_inventory (account_id, catalog_id, name, image, wear_offset_x, wear_offset_y, wear_width, wear_height, equipped, attribution, collected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(accountId, item.catalogId, item.name, item.image, item.wearOffsetX, item.wearOffsetY, item.wearWidth, item.wearHeight, item.attribution || '', Date.now());
}

export function setEquipped(accountId, catalogId, wearOffsetX, wearOffsetY, wearWidth, wearHeight, equipped) {
  if (equipped) {
    const max = db.prepare(
      'SELECT COALESCE(MAX(equip_order), 0) AS m FROM account_inventory WHERE account_id = ? AND equipped = 1'
    ).get(accountId);
    db.prepare(
      `UPDATE account_inventory SET equipped = 1, equip_order = ? WHERE account_id = ? AND catalog_id = ? AND wear_offset_x = ? AND wear_offset_y = ? AND wear_width = ? AND wear_height = ?`
    ).run((max?.m || 0) + 1, accountId, catalogId, wearOffsetX, wearOffsetY, wearWidth, wearHeight);
  } else {
    db.prepare(
      `UPDATE account_inventory SET equipped = 0, equip_order = 0 WHERE account_id = ? AND catalog_id = ? AND wear_offset_x = ? AND wear_offset_y = ? AND wear_width = ? AND wear_height = ?`
    ).run(accountId, catalogId, wearOffsetX, wearOffsetY, wearWidth, wearHeight);
  }
}
