import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { DATA_DIR } from '../config.js';

const DB_FILE = join(DATA_DIR, 'db.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: {}, sessions: {}, watchlists: {}, usage: {} }; }
}

function save(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch {}
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function findUserByEmail(email) {
  return load().users[email] || null;
}

export function createUser(id, email) {
  const db = load();
  const user = { id, email, tier: 'free', created_at: new Date().toISOString() };
  db.users[email] = user;
  save(db);
  return user;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function createSession(userId) {
  const db = load();
  const user = Object.values(db.users).find(u => u.id === userId);
  if (!user) throw new Error('user not found');
  const token = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.sessions[token] = { user_id: userId, email: user.email, tier: user.tier, expires_at: expires };
  save(db);
  return token;
}

export function validateSession(token) {
  if (!token) return null;
  const db = load();
  const session = db.sessions[token];
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    delete db.sessions[token];
    save(db);
    return null;
  }
  return session;
}

export function deleteSession(token) {
  const db = load();
  delete db.sessions[token];
  save(db);
}

// ── User Watchlists ───────────────────────────────────────────────────────────

export function getUserWatchlist(userId) {
  return load().watchlists[userId] || [];
}

export function addToUserWatchlist(userId, item) {
  const db = load();
  if (!db.watchlists[userId]) db.watchlists[userId] = [];
  if (db.watchlists[userId].find(w => w.ticker === item.ticker)) throw new Error('already in watchlist');
  db.watchlists[userId].push({ ...item, added_at: new Date().toISOString() });
  save(db);
}

export function removeFromUserWatchlist(userId, ticker) {
  const db = load();
  db.watchlists[userId] = (db.watchlists[userId] || []).filter(w => w.ticker !== ticker);
  save(db);
}

export function seedUserWatchlist(userId, items) {
  const db = load();
  if (!db.watchlists[userId]) db.watchlists[userId] = [];
  const existing = new Set(db.watchlists[userId].map(w => w.ticker));
  const now = new Date().toISOString();
  for (const item of items) {
    if (!existing.has(item.ticker)) {
      db.watchlists[userId].push({ ...item, added_at: now });
    }
  }
  save(db);
}

// ── Report Usage ──────────────────────────────────────────────────────────────

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function getUsage(userId) {
  const key = `${userId}:${currentMonth()}`;
  return load().usage[key] || 0;
}

export function incrementUsage(userId) {
  const db = load();
  const key = `${userId}:${currentMonth()}`;
  db.usage[key] = (db.usage[key] || 0) + 1;
  save(db);
}
