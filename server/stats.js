// Lightweight per-operation CPU/time tracking
// Tracks call count, total wall-clock ms, and max ms per named operation
// Optionally tracks per-CP breakdowns for socket operations

const stats = new Map();
const cpStats = new Map(); // cpId -> Map(operation -> {count, totalMs, maxMs})

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

export function getStats() {
  const result = {};
  for (const [name, entry] of stats) {
    result[name] = formatEntry(entry);
  }
  return result;
}

export function getCPStats() {
  const result = {};
  for (const [cpId, opMap] of cpStats) {
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

export function resetStats() {
  stats.clear();
  cpStats.clear();
}
