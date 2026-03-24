// Lightweight per-operation CPU/time tracking with SQLite persistence
// Tracks call count, total wall-clock ms, and max ms per named operation
// Optionally tracks per-CP breakdowns for socket operations
// Stats survive server restarts — loaded from DB on startup, flushed periodically + on shutdown

import db from './db.js';

const stats = new Map();
const cpStats = new Map(); // cpId -> Map(operation -> {count, totalMs, maxMs})

// --- DB statements ---
const upsertOp = db.prepare(`
  INSERT INTO stats_operations (operation, count, total_ms, max_ms)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(operation) DO UPDATE SET
    count = count + excluded.count,
    total_ms = total_ms + excluded.total_ms,
    max_ms = MAX(max_ms, excluded.max_ms)
`);

const upsertCpOp = db.prepare(`
  INSERT INTO stats_cp_operations (cp_id, operation, count, total_ms, max_ms)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(cp_id, operation) DO UPDATE SET
    count = count + excluded.count,
    total_ms = total_ms + excluded.total_ms,
    max_ms = MAX(max_ms, excluded.max_ms)
`);

const getMeta = db.prepare('SELECT value FROM stats_meta WHERE key = ?');
const setMeta = db.prepare(`
  INSERT INTO stats_meta (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

// --- Load persisted stats on startup ---
function loadFromDB() {
  for (const row of db.prepare('SELECT * FROM stats_operations').all()) {
    stats.set(row.operation, { count: row.count, totalMs: row.total_ms, maxMs: row.max_ms });
  }
  for (const row of db.prepare('SELECT * FROM stats_cp_operations').all()) {
    if (!cpStats.has(row.cp_id)) cpStats.set(row.cp_id, new Map());
    cpStats.get(row.cp_id).set(row.operation, { count: row.count, totalMs: row.total_ms, maxMs: row.max_ms });
  }
  // Initialize "since" timestamp if not set
  if (!getMeta.get('since')) {
    setMeta.run('since', String(Date.now()));
  }
}

loadFromDB();

// --- Flush in-memory deltas to DB ---
// We accumulate in-memory, then flush deltas to DB and clear in-memory maps.
const flushToDB = db.transaction(() => {
  for (const [name, entry] of stats) {
    upsertOp.run(name, entry.count, entry.totalMs, entry.maxMs);
  }
  for (const [cpId, opMap] of cpStats) {
    for (const [name, entry] of opMap) {
      upsertCpOp.run(cpId, name, entry.count, entry.totalMs, entry.maxMs);
    }
  }
  stats.clear();
  cpStats.clear();
});

// Flush every 5 minutes
const flushInterval = setInterval(() => {
  try { flushToDB(); } catch (e) { console.error('Stats flush error:', e); }
}, 5 * 60 * 1000);
flushInterval.unref();

// Flush on shutdown
function onExit() {
  try { flushToDB(); } catch (e) { /* shutting down */ }
}
process.on('SIGTERM', onExit);
process.on('SIGINT', onExit);
process.on('beforeExit', onExit);

// --- Public API (same interface as before) ---

function record(map, key, elapsed) {
  let entry = map.get(key);
  if (!entry) {
    entry = { count: 0, totalMs: 0, maxMs: 0 };
    map.set(key, entry);
  }
  entry.count++;
  entry.totalMs += elapsed;
  if (elapsed > entry.maxMs) entry.maxMs = elapsed;
}

export function trackStart(name, cpId) {
  const start = performance.now();
  return () => {
    const elapsed = performance.now() - start;
    record(stats, name, elapsed);
    if (cpId) {
      if (!cpStats.has(cpId)) cpStats.set(cpId, new Map());
      record(cpStats.get(cpId), name, elapsed);
    }
  };
}

function formatEntry(entry) {
  return {
    count: entry.count,
    totalMs: Math.round(entry.totalMs * 100) / 100,
    avgMs: entry.count > 0 ? Math.round((entry.totalMs / entry.count) * 100) / 100 : 0,
    maxMs: Math.round(entry.maxMs * 100) / 100,
  };
}

// Merges DB rows + in-memory (unflushed) data for a complete view
function mergedOpStats() {
  const merged = new Map();
  // DB rows first
  for (const row of db.prepare('SELECT * FROM stats_operations').all()) {
    merged.set(row.operation, { count: row.count, totalMs: row.total_ms, maxMs: row.max_ms });
  }
  // Layer in-memory on top
  for (const [name, entry] of stats) {
    const existing = merged.get(name);
    if (existing) {
      existing.count += entry.count;
      existing.totalMs += entry.totalMs;
      existing.maxMs = Math.max(existing.maxMs, entry.maxMs);
    } else {
      merged.set(name, { ...entry });
    }
  }
  return merged;
}

function mergedCPStats() {
  const merged = new Map(); // cpId -> Map(op -> entry)
  // DB rows
  for (const row of db.prepare('SELECT * FROM stats_cp_operations').all()) {
    if (!merged.has(row.cp_id)) merged.set(row.cp_id, new Map());
    merged.get(row.cp_id).set(row.operation, { count: row.count, totalMs: row.total_ms, maxMs: row.max_ms });
  }
  // In-memory
  for (const [cpId, opMap] of cpStats) {
    if (!merged.has(cpId)) merged.set(cpId, new Map());
    const target = merged.get(cpId);
    for (const [name, entry] of opMap) {
      const existing = target.get(name);
      if (existing) {
        existing.count += entry.count;
        existing.totalMs += entry.totalMs;
        existing.maxMs = Math.max(existing.maxMs, entry.maxMs);
      } else {
        target.set(name, { ...entry });
      }
    }
  }
  return merged;
}

export function getStats() {
  const result = {};
  for (const [name, entry] of mergedOpStats()) {
    result[name] = formatEntry(entry);
  }
  return result;
}

export function getCPStats() {
  const result = {};
  for (const [cpId, opMap] of mergedCPStats()) {
    const ops = {};
    let totalMs = 0;
    let totalCount = 0;
    for (const [name, entry] of opMap) {
      ops[name] = formatEntry(entry);
      totalMs += entry.totalMs;
      totalCount += entry.count;
    }
    result[cpId] = {
      totalMs: Math.round(totalMs * 100) / 100,
      totalCount,
      operations: ops,
    };
  }
  return result;
}

export function getStatsSince() {
  const row = getMeta.get('since');
  return row ? Number(row.value) : Date.now();
}

export function resetStats() {
  stats.clear();
  cpStats.clear();
  db.prepare('DELETE FROM stats_operations').run();
  db.prepare('DELETE FROM stats_cp_operations').run();
  setMeta.run('since', String(Date.now()));
}
