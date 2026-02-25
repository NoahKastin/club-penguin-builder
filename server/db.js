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

export default db;
