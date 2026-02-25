import db from './db.js';

export function launchParty(cpId, name) {
  const launchedAt = Date.now();
  const result = db.prepare('INSERT INTO parties (cp_id, name, launched_at) VALUES (?, ?, ?)').run(cpId, name, launchedAt);
  return { id: result.lastInsertRowid, cpId, name, launchedAt };
}

export function getPartyLog(cpId) {
  return db.prepare('SELECT id, cp_id AS cpId, name, launched_at AS launchedAt FROM parties WHERE cp_id = ? ORDER BY launched_at DESC').all(cpId);
}
