import fs from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../config.js';

const WL_FILE = join(DATA_DIR, 'watchlist.json');

export const DEFAULT_WATCHLIST = [
  // Crypto
  { ticker: 'BTC-USD',  display: 'BTC',  name: 'Bitcoin',                type: 'crypto' },
  { ticker: 'ETH-USD',  display: 'ETH',  name: 'Ethereum',               type: 'crypto' },
  { ticker: 'SOL-USD',  display: 'SOL',  name: 'Solana',                 type: 'crypto' },
  { ticker: 'DOGE-USD', display: 'DOGE', name: 'Dogecoin',               type: 'crypto' },
  { ticker: 'XRP-USD',  display: 'XRP',  name: 'XRP',                    type: 'crypto' },
  { ticker: 'ADA-USD',  display: 'ADA',  name: 'Cardano',                type: 'crypto' },
  { ticker: 'AVAX-USD', display: 'AVAX', name: 'Avalanche',              type: 'crypto' },
  { ticker: 'LTC-USD',  display: 'LTC',  name: 'Litecoin',               type: 'crypto' },
  // ETFs
  { ticker: 'VOO',      display: 'VOO',  name: 'Vanguard S&P 500 ETF',  type: 'etf'    },
  { ticker: 'URNM',     display: 'URNM', name: 'Sprott Uranium Miners',  type: 'etf'    },
  // Stocks
  { ticker: 'NVDA',     display: 'NVDA', name: 'NVIDIA Corporation',     type: 'stock'  },
  { ticker: 'TSM',      display: 'TSM',  name: 'Taiwan Semiconductor',   type: 'stock'  },
  { ticker: 'QXO',      display: 'QXO',  name: 'QXO Inc.',              type: 'stock'  },
  { ticker: 'VRT',      display: 'VRT',  name: 'Vertiv Holdings',        type: 'stock'  },
  { ticker: 'NU',       display: 'NU',   name: 'Nu Holdings',            type: 'stock'  },
  { ticker: 'CEG',      display: 'CEG',  name: 'Constellation Energy',   type: 'stock'  },
];

const DEFAULT = DEFAULT_WATCHLIST;

export function getWatchlist() {
  try {
    const raw = fs.readFileSync(WL_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return DEFAULT;
  }
}

export function saveWatchlist(list) {
  fs.writeFileSync(WL_FILE, JSON.stringify(list, null, 2));
}

export function getTickers() {
  return getWatchlist().map(w => w.ticker);
}

// Seed the file on first run if it doesn't exist
if (!fs.existsSync(WL_FILE)) {
  saveWatchlist(DEFAULT);
}
