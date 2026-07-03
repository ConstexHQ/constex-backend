import { Router } from 'express';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

const ALLOWED_EXCHANGES = new Set([
  'NYSE', 'NASDAQ', 'AMEX', 'NYSEArca', 'NasdaqGS', 'NasdaqGM',
  'NasdaqCM', 'CBOE', 'NYSEMkt', 'Cryptocurrency',
]);

const router = Router();

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return res.json({ results: [] });

    const data = await r.json();
    const results = (data.quotes || [])
      .filter(q => ALLOWED_EXCHANGES.has(q.exchDisp) || q.quoteType === 'CRYPTOCURRENCY')
      .slice(0, 7)
      .map(q => ({
        ticker:   q.symbol,
        display:  q.symbol,
        name:     q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || '',
        type:     q.typeDisp === 'ETF' ? 'etf'
                : q.quoteType === 'CRYPTOCURRENCY' ? 'crypto'
                : 'stock',
      }));

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
