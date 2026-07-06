import { Router } from 'express';
import { fetchMarket } from '../data/market.js';

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
  { key: 'SP500',  ticker: 'SPY',    label: 'S&P 500' },
  { key: 'NASDAQ', ticker: 'QQQ',    label: 'NASDAQ'  },
  { key: 'DJI',    ticker: 'DIA',    label: 'DOW'     },
  { key: 'VIX',    ticker: '^VIX',   label: 'VIX'     },
  { key: 'BTC',    ticker: 'BTC-USD',label: 'BTC'     },
  { key: 'GOLD',   ticker: 'GLD',    label: 'GOLD'    },
  { key: 'OIL',    ticker: 'USO',    label: 'OIL'     },
  { key: 'BONDS',  ticker: 'TLT',    label: '20Y BOND'},
  { key: 'DXY',    ticker: 'UUP',    label: 'USD'     },
];

router.get('/', async (req, res) => {
  try {
    if (_cache && (Date.now() - _cacheAt) < CACHE_TTL) {
      return res.json(_cache);
    }

    const [macroResults, sectorResults] = await Promise.all([
      Promise.allSettled(MACRO_TICKERS.map(({ key, ticker, label }) =>
        fetchMarket(ticker).then(m => ({ key, label, price: m.price, changePct: m.changePct }))
      )),
      Promise.allSettled(SECTOR_ETFS.map(({ name, etf }) =>
        fetchMarket(etf).then(m => ({ name, etf, perf_5d: m.changePct, price: m.price }))
      )),
    ]);

    const macro = {};
    for (const r of macroResults) {
      if (r.status === 'fulfilled') {
        macro[r.value.key] = {
          label:      r.value.label,
          price:      r.value.price,
          change_pct: r.value.changePct,
        };
      }
    }

    const sectors = {};
    for (const r of sectorResults) {
      if (r.status === 'fulfilled') {
        sectors[r.value.name] = {
          etf:     r.value.etf,
          perf_5d: r.value.perf_5d,
          price:   r.value.price,
        };
      }
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
