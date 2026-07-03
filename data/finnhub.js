import { FINNHUB_KEY } from '../config.js';

const BASE = 'https://finnhub.io/api/v1';

// Single real-time quote — returns { price, change, changePct, high, low, open, prevClose }
export async function fetchFinnhubQuote(ticker) {
  if (!FINNHUB_KEY) return null;
  try {
    const url = `${BASE}/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.c || d.c === 0) return null;
    return {
      price:     d.c,
      change:    d.d,
      changePct: d.dp,
      high:      d.h,
      low:       d.l,
      open:      d.o,
      prevClose: d.pc,
    };
  } catch {
    return null;
  }
}

// Batch quotes for multiple tickers — stays under 60 req/min free limit
export async function fetchFinnhubQuotes(tickers) {
  const results = await Promise.allSettled(
    tickers.map(t => fetchFinnhubQuote(t).then(q => ({ ticker: t, quote: q })))
  );
  const map = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.quote) {
      map[r.value.ticker] = r.value.quote;
    }
  }
  return map;
}
