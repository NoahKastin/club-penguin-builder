import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';

mkdirSync('data', { recursive: true });

const db = new Database('data/clubpenguins.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS club_penguins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rooms TEXT NOT NULL,
    spawn_room TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cp_id TEXT NOT NULL,
    name TEXT NOT NULL,
    launched_at INTEGER NOT NULL
  )
`);

// Migration: add creator_id to club_penguins
const columns = db.prepare("PRAGMA table_info(club_penguins)").all().map(c => c.name);
if (!columns.includes('creator_id')) {
  db.exec('ALTER TABLE club_penguins ADD COLUMN creator_id TEXT');
}

export default db;
