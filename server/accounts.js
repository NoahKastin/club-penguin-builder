import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import db from './db.js';

let nextId = 1;
const maxRow = db.prepare('SELECT id FROM accounts ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC LIMIT 1').get();
if (maxRow) nextId = parseInt(maxRow.id.slice(5)) + 1;


export async function createAccount(username, password) {
  const id = 'acct_' + (nextId++);
  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = Date.now();
  try {
    db.prepare('INSERT INTO accounts (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username, passwordHash, createdAt);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
    throw err;
  }
  return { id, username };
}

export async function login(username, password) {
  const row = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);
  if (!row) return null;
  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) return null;
  return { id: row.id, username: row.username };
}

export function getAccount(id) {
  const row = db.prepare('SELECT id, username FROM accounts WHERE id = ?').get(id);
  return row || null;
}

export function createSession(accountId) {
  const token = randomBytes(32).toString('hex');
  const createdAt = Date.now();
  db.prepare('INSERT INTO sessions (token, account_id, created_at) VALUES (?, ?, ?)').run(token, accountId, createdAt);
  return token;
}

export function getSession(token) {
  const row = db.prepare('SELECT account_id FROM sessions WHERE token = ?').get(token);
  return row ? row.account_id : null;
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}
