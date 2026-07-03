import { Router } from 'express';
import { fetchMarket } from '../data/market.js';
import { fetchFinnhubQuote, fetchFinnhubQuotes } from '../data/finnhub.js';
import { getWatchlist } from '../data/watchlist.js';

const router = Router();

async function fetchAll() {
  const watchlist = getWatchlist();
  return Promise.allSettled(
    watchlist.map(async item => {
      const [market] = await Promise.allSettled([fetchMarket(item.ticker)]);
      const m = market.status === 'fulfilled' ? market.value : {};

      // Override price with real-time Finnhub quote for stocks/ETFs
      if (item.type !== 'crypto') {
        const q = await fetchFinnhubQuote(item.ticker);
        if (q) {
          m.price     = q.price;
          m.changePct = q.changePct;
          m.change    = q.change;
        }
      }

      return { item, market: m };
    })
  );
}

function transformPosition(item, m) {
  return {
    ticker:              item.ticker,
    display:             item.display,
    name:                m.name || item.name,
    type:                item.type,
    price:               m.price,
    change_pct:          m.changePct,
    market_cap:          m.marketCap,
    volume:              m.volume,
    '52w_high':          m.high52w,
    '52w_low':           m.low52w,
    perf_52w:            m.perf52w,
    pe_ratio:            m.peRatio,
    analyst_target_mean: m.analystTargetMean,
    recommendation:      m.recommendation,
    short_percent_float: m.shortPctFloat,
    news:                m.news ?? [],
  };
}

router.get('/', async (req, res) => {
  try {
    const results = await fetchAll();
    const positions = results.map(r => {
      if (r.status !== 'fulfilled') return { error: 'fetch failed' };
      const { item, market } = r.value;
      return transformPosition(item, market);
    });
    res.json({ positions, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fast prices endpoint — Finnhub for stocks, Yahoo for crypto
router.get('/prices', async (req, res) => {
  try {
    const watchlist = getWatchlist();
    const stocks  = watchlist.filter(w => w.type !== 'crypto');
    const cryptos = watchlist.filter(w => w.type === 'crypto');

    const [fhQuotes, cryptoResults] = await Promise.all([
      fetchFinnhubQuotes(stocks.map(w => w.ticker)),
      Promise.allSettled(cryptos.map(w => fetchMarket(w.ticker).then(m => ({ w, m })))),
    ]);

    const prices = [
      // Real-time stock/ETF prices from Finnhub
      ...stocks.map(w => {
        const q = fhQuotes[w.ticker];
        return { ticker: w.ticker, display: w.display, price: q?.price ?? null, change_pct: q?.changePct ?? null };
      }),
      // Crypto from Yahoo (essentially real-time)
      ...cryptoResults.map(r => {
        if (r.status !== 'fulfilled') return null;
        const { w, m } = r.value;
        return { ticker: w.ticker, display: w.display, price: m.price, change_pct: m.changePct };
      }).filter(Boolean),
    ];

    res.json({ prices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
