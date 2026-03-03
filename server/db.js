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

// Migration: add equip_order, attribution, collected_at to account_inventory
const invCols = db.prepare("PRAGMA table_info(account_inventory)").all().map(c => c.name);
if (!invCols.includes('equip_order')) {
  db.exec('ALTER TABLE account_inventory ADD COLUMN equip_order INTEGER NOT NULL DEFAULT 0');
}
if (!invCols.includes('attribution')) {
  db.exec("ALTER TABLE account_inventory ADD COLUMN attribution TEXT NOT NULL DEFAULT ''");
}
if (!invCols.includes('collected_at')) {
  db.exec('ALTER TABLE account_inventory ADD COLUMN collected_at INTEGER NOT NULL DEFAULT 0');
}

// Migration: add catalog/inventory sort prefs to account_preferences
const prefCols = db.prepare("PRAGMA table_info(account_preferences)").all().map(c => c.name);
if (!prefCols.includes('catalog_sort_field')) {
  db.exec("ALTER TABLE account_preferences ADD COLUMN catalog_sort_field TEXT NOT NULL DEFAULT 'name'");
  db.exec("ALTER TABLE account_preferences ADD COLUMN catalog_sort_dir TEXT NOT NULL DEFAULT 'asc'");
  db.exec("ALTER TABLE account_preferences ADD COLUMN inv_sort_field TEXT NOT NULL DEFAULT 'name'");
  db.exec("ALTER TABLE account_preferences ADD COLUMN inv_sort_dir TEXT NOT NULL DEFAULT 'asc'");
}

// Migration: add hide_emoji to account_preferences
if (!prefCols.includes('hide_emoji')) {
  db.exec("ALTER TABLE account_preferences ADD COLUMN hide_emoji INTEGER NOT NULL DEFAULT 0");
}

// Favorites table
db.exec(`
  CREATE TABLE IF NOT EXISTS account_favorites (
    account_id TEXT NOT NULL,
    catalog_id TEXT NOT NULL,
    UNIQUE(account_id, catalog_id)
  )
`);

// Migration: add pearl_balance to accounts
const acctCols = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
if (!acctCols.includes('pearl_balance')) {
  db.exec('ALTER TABLE accounts ADD COLUMN pearl_balance INTEGER NOT NULL DEFAULT 0');
}

// Migration: add price to catalog_items
const catCols2 = db.prepare("PRAGMA table_info(catalog_items)").all().map(c => c.name);
if (!catCols2.includes('price')) {
  db.exec('ALTER TABLE catalog_items ADD COLUMN price INTEGER NOT NULL DEFAULT 0');
}

// Pearl transactions
db.exec(`
  CREATE TABLE IF NOT EXISTS pearl_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    reference TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

// Stripe checkout sessions
db.exec(`
  CREATE TABLE IF NOT EXISTS stripe_sessions (
    session_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    pearls INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

// Item purchases (tracks who bought what)
db.exec(`
  CREATE TABLE IF NOT EXISTS item_purchases (
    account_id TEXT NOT NULL,
    catalog_id TEXT NOT NULL,
    purchased_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(account_id, catalog_id)
  )
`);

// Migration: add Stripe Connect fields to accounts
const acctCols2 = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
if (!acctCols2.includes('stripe_connect_id')) {
  db.exec("ALTER TABLE accounts ADD COLUMN stripe_connect_id TEXT");
  db.exec("ALTER TABLE accounts ADD COLUMN stripe_onboarding_complete INTEGER NOT NULL DEFAULT 0");
}

// Cash-out transfers
db.exec(`
  CREATE TABLE IF NOT EXISTS cashout_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    pearls INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    stripe_transfer_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

// Migration: add attribution_name to accounts
const acctCols3 = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
if (!acctCols3.includes('attribution_name')) {
  db.exec("ALTER TABLE accounts ADD COLUMN attribution_name TEXT NOT NULL DEFAULT ''");
}

export default db;
