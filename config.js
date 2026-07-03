import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

export const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY || '';
export const FINNHUB_KEY     = process.env.FINNHUB_KEY || '';
export const NEWS_API_KEY    = process.env.NEWS_API_KEY || '';
export const AV_KEY          = process.env.ALPHA_VANTAGE_KEY || '';
export const REDDIT_ID       = process.env.REDDIT_CLIENT_ID || '';
export const REDDIT_SECRET   = process.env.REDDIT_CLIENT_SECRET || '';
export const PORT             = parseInt(process.env.PORT || '4001');
export const CACHE_TTL_HRS   = parseInt(process.env.CACHE_TTL_HOURS || '6');
export const AV_CACHE_HRS    = parseInt(process.env.AV_CACHE_TTL_HOURS || '23');
export const REPORT_REFRESH_HOUR = parseInt(process.env.REPORT_REFRESH_HOUR || '7');
export const RESEND_API_KEY    = process.env.RESEND_API_KEY || '';
export const FREE_REPORT_CAP   = parseInt(process.env.FREE_REPORT_CAP  || '10');
export const PAID_REPORT_CAP   = parseInt(process.env.PAID_REPORT_CAP  || '100');

const defaultData = join(__dir, '..', 'data');
export const DATA_DIR = process.env.DATA_DIR || defaultData;
fs.mkdirSync(DATA_DIR, { recursive: true });

export const WATCHLIST = [
  { ticker: 'ETH-USD', display: 'ETH',  name: 'Ethereum',                  type: 'crypto' },
  { ticker: 'VOO',     display: 'VOO',  name: 'Vanguard S&P 500 ETF',      type: 'etf'    },
  { ticker: 'NVDA',    display: 'NVDA', name: 'NVIDIA Corporation',         type: 'stock'  },
  { ticker: 'TSM',     display: 'TSM',  name: 'Taiwan Semiconductor',       type: 'stock'  },
  { ticker: 'QXO',     display: 'QXO',  name: 'QXO Inc.',                   type: 'stock'  },
  { ticker: 'VRT',     display: 'VRT',  name: 'Vertiv Holdings',             type: 'stock'  },
  { ticker: 'URNM',    display: 'URNM', name: 'Sprott Uranium Miners ETF',  type: 'etf'    },
  { ticker: 'NU',      display: 'NU',   name: 'Nu Holdings',                 type: 'stock'  },
  { ticker: 'CEG',     display: 'CEG',  name: 'Constellation Energy',        type: 'stock'  },
];

export const TICKERS = WATCHLIST.map(w => w.ticker);

export const CRYPTO = new Set([
  'BTC-USD','ETH-USD','SOL-USD','DOGE-USD','ADA-USD',
  'XRP-USD','AVAX-USD','LTC-USD','MATIC-USD','LINK-USD',
  'DOT-USD','UNI-USD','SHIB-USD',
]);
