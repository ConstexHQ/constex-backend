import { Router } from 'express';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const PERIOD_MAP = {
  '1D':  { interval: '5m',  range: '1d'  },
  '5D':  { interval: '15m', range: '5d'  },
  '1M':  { interval: '1d',  range: '1mo' },
  '3M':  { interval: '1d',  range: '3mo' },
  '6M':  { interval: '1wk', range: '6mo' },
  '1Y':  { interval: '1wk', range: '1y'  },
  'MAX': { interval: '1mo', range: 'max' },
};

function formatLabel(ts, period) {
  const d = new Date(ts * 1000);
  if (period === '1D') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' });
  }
  if (period === 'MAX') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const router = Router();

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const period = (req.query.period || '1M').toUpperCase();
  const map = PERIOD_MAP[period];

  if (!map) return res.status(400).json({ error: `Unknown period: ${period}` });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${map.interval}&range=${map.range}&includePrePost=false`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) throw new Error(`Yahoo returned ${r.status}`);

    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No data returned');

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens  = quote.open  || [];
    const highs  = quote.high  || [];
    const lows   = quote.low   || [];
    const closes = quote.close || [];

    const sparkline = [];
    const labels = [];
    const candles = [];

    // 1D uses 5m intraday bars — Yahoo often omits o/h/l for many bars,
    // so synthesize from prev close rather than dropping them (would leave ~5 candles).
    // All other periods use daily/weekly/monthly bars which always have full OHLC.
    let prevC = null;
    for (let i = 0; i < timestamps.length; i++) {
      const rawC = closes[i];
      if (rawC == null || isNaN(rawC)) continue;

      const rawO = opens[i], rawH = highs[i], rawL = lows[i];
      let o, h, l;

      if (period === '1D') {
        o = (rawO != null && !isNaN(rawO)) ? rawO : (prevC ?? rawC);
        h = (rawH != null && !isNaN(rawH)) ? rawH : Math.max(o, rawC);
        l = (rawL != null && !isNaN(rawL)) ? rawL : Math.min(o, rawC);
      } else {
        if (rawO == null || isNaN(rawO) || rawH == null || isNaN(rawH) || rawL == null || isNaN(rawL)) continue;
        o = rawO; h = rawH; l = rawL;
      }

      const c = rawC;
      const label = formatLabel(timestamps[i], period);
      sparkline.push(c);
      labels.push(label);
      candles.push({ o, h, l, c, label });
      prevC = c;
    }

    res.json({ sparkline, labels, candles });
  } catch (err) {
    console.error(`[chart] ${ticker} ${period}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
