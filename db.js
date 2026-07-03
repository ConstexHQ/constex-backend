import fs from 'fs';
import { join } from 'path';
import { DATA_DIR, CACHE_TTL_HRS } from './config.js';

const DB_FILE = join(DATA_DIR, 'reports.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return {}; }
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function getCachedReport(ticker) {
  const db = load();
  const entry = db[ticker];
  if (!entry) return null;
  const age = Date.now() - new Date(entry.generated_at).getTime();
  if (age > CACHE_TTL_HRS * 3600 * 1000) return null;
  return entry;
}

export function saveReport(ticker, rawData, reportMd, price, changePct) {
  const db = load();
  db[ticker] = {
    ticker,
    generated_at: new Date().toISOString(),
    raw_data: JSON.stringify(rawData),
    report_md: reportMd,
    price: price || 0,
    change_pct: changePct || 0,
  };
  save(db);
}

export function getAllReports() {
  return load();
}
