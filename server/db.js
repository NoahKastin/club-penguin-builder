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

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS account_preferences (
    account_id TEXT PRIMARY KEY,
    sort_field TEXT NOT NULL DEFAULT 'name',
    sort_dir TEXT NOT NULL DEFAULT 'asc'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS catalog_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    uploader_id TEXT,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS account_inventory (
    account_id TEXT NOT NULL,
    catalog_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    wear_offset_x INTEGER NOT NULL DEFAULT 0,
    wear_offset_y INTEGER NOT NULL DEFAULT 0,
    wear_width INTEGER NOT NULL DEFAULT 40,
    wear_height INTEGER NOT NULL DEFAULT 40,
    equipped INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, catalog_id, wear_offset_x, wear_offset_y, wear_width, wear_height)
  )
`);

// Migration: add creator_id to club_penguins
const columns = db.prepare("PRAGMA table_info(club_penguins)").all().map(c => c.name);
if (!columns.includes('creator_id')) {
  db.exec('ALTER TABLE club_penguins ADD COLUMN creator_id TEXT');
}

// Migration: add attribution to catalog_items
const catalogCols = db.prepare("PRAGMA table_info(catalog_items)").all().map(c => c.name);
if (!catalogCols.includes('attribution')) {
  db.exec("ALTER TABLE catalog_items ADD COLUMN attribution TEXT NOT NULL DEFAULT ''");
}

export default db;
