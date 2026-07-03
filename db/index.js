import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR } from '../config.js';

const db = new Database(join(DATA_DIR, 'users.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_watchlists (
    user_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    display TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, ticker),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS report_usage (
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, month),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// ── OTP ──────────────────────────────────────────────────────────────────────

export function saveOtp(email, code, expiresAt) {
  db.prepare('DELETE FROM otp_codes WHERE email = ? AND consumed = 0').run(email);
  db.prepare('INSERT INTO otp_codes (email, code, expires_at, consumed) VALUES (?, ?, ?, 0)')
    .run(email, code, expiresAt);
}

export function consumeOtp(email, code) {
  const now = new Date().toISOString();
  const row = db.prepare(
    'SELECT id FROM otp_codes WHERE email = ? AND code = ? AND consumed = 0 AND expires_at > ?'
  ).get(email, code, now);
  if (!row) return false;
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id);
  return true;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function createUser(id, email) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, email, tier, created_at) VALUES (?, ?, ?, ?)').run(id, email, 'free', now);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function createSession(userId) {
  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(id, userId, now.toISOString(), expires.toISOString());
  return id;
}

export function validateSession(token) {
  if (!token) return null;
  const now = new Date().toISOString();
  const row = db.prepare(
    'SELECT s.user_id, u.email, u.tier FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > ?'
  ).get(token, now);
  return row || null;
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

// ── User Watchlists ───────────────────────────────────────────────────────────

export function getUserWatchlist(userId) {
  return db.prepare(
    'SELECT ticker, display, name, type FROM user_watchlists WHERE user_id = ? ORDER BY added_at ASC'
  ).all(userId);
}

export function addToUserWatchlist(userId, item) {
  const existing = db.prepare(
    'SELECT 1 FROM user_watchlists WHERE user_id = ? AND ticker = ?'
  ).get(userId, item.ticker);
  if (existing) throw new Error('already in watchlist');
  db.prepare(
    'INSERT INTO user_watchlists (user_id, ticker, display, name, type, added_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, item.ticker, item.display, item.name, item.type, new Date().toISOString());
}

export function removeFromUserWatchlist(userId, ticker) {
  db.prepare('DELETE FROM user_watchlists WHERE user_id = ? AND ticker = ?').run(userId, ticker);
}

export function seedUserWatchlist(userId, items) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO user_watchlists (user_id, ticker, display, name, type, added_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const now = new Date().toISOString();
  const insertMany = db.transaction((rows) => {
    for (const item of rows) insert.run(userId, item.ticker, item.display, item.name, item.type, now);
  });
  insertMany(items);
}

// ── Report Usage ──────────────────────────────────────────────────────────────

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

export function getUsage(userId) {
  const row = db.prepare(
    'SELECT count FROM report_usage WHERE user_id = ? AND month = ?'
  ).get(userId, currentMonth());
  return row ? row.count : 0;
}

export function incrementUsage(userId) {
  db.prepare(`
    INSERT INTO report_usage (user_id, month, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1
  `).run(userId, currentMonth());
}
