import { Router } from 'express';
import { fetchFinnhubQuotes } from '../data/finnhub.js';

const router = Router();

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

const SECTOR_ETFS = [
  { name: 'Technology',    etf: 'XLK'  },
  { name: 'Energy',        etf: 'XLE'  },
  { name: 'Financials',    etf: 'XLF'  },
  { name: 'Healthcare',    etf: 'XLV'  },
  { name: 'Industrials',   etf: 'XLI'  },
  { name: 'Materials',     etf: 'XLB'  },
  { name: 'Utilities',     etf: 'XLU'  },
  { name: 'Real Estate',   etf: 'XLRE' },
  { name: 'Consumer Disc', etf: 'XLY'  },
  { name: 'Consumer Stap', etf: 'XLP'  },
  { name: 'Communication', etf: 'XLC'  },
];

const MACRO_TICKERS = [
  { key: 'SP500',  ticker: 'SPY',  label: 'S&P 500'  },
  { key: 'NASDAQ', ticker: 'QQQ',  label: 'NASDAQ'   },
  { key: 'DJI',    ticker: 'DIA',  label: 'DOW'      },
  { key: 'VIX',    ticker: '^VIX', label: 'VIX'      },
  { key: 'GOLD',   ticker: 'GLD',  label: 'GOLD'     },
  { key: 'OIL',    ticker: 'USO',  label: 'OIL'      },
  { key: 'BONDS',  ticker: 'TLT',  label: '20Y BOND' },
  { key: 'DXY',    ticker: 'UUP',  label: 'USD'      },
];

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

async function fetchBTC() {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=5d&includePrePost=false';
    const r = await fetch(url, { headers: YF_HEADERS });
    if (!r.ok) return null;
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const changePct = (price && prevClose && prevClose !== 0)
      ? +((((price - prevClose) / prevClose) * 100).toFixed(2))
      : null;
    return { price, changePct };
  } catch { return null; }
}

router.get('/', async (req, res) => {
  try {
    if (_cache && (Date.now() - _cacheAt) < CACHE_TTL) {
      return res.json(_cache);
    }

    const allFinnhubTickers = [
      ...MACRO_TICKERS.map(t => t.ticker),
      ...SECTOR_ETFS.map(s => s.etf),
    ];

    const [fhQuotes, btc] = await Promise.all([
      fetchFinnhubQuotes(allFinnhubTickers),
      fetchBTC(),
    ]);

    const macro = {};
    for (const { key, ticker, label } of MACRO_TICKERS) {
      const q = fhQuotes[ticker];
      if (q) macro[key] = { label, price: q.price, change_pct: q.changePct };
    }
    if (btc?.price != null) {
      macro['BTC'] = { label: 'BTC', price: btc.price, change_pct: btc.changePct };
    }

    const sectors = {};
    for (const { name, etf } of SECTOR_ETFS) {
      const q = fhQuotes[etf];
      if (q) sectors[name] = { etf, perf_5d: q.changePct, price: q.price };
    }

    const result = { macro, sectors, fred_available: false, fetchedAt: new Date().toISOString() };
    if (Object.keys(macro).length > 0) {
      _cache = result;
      _cacheAt = Date.now();
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
