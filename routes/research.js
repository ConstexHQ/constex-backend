import { Router } from 'express';
import { aggregateAll } from '../data/aggregator.js';
import { fetchMarket } from '../data/market.js';
import { fetchNews } from '../data/newsapi.js';
import { fetchTechnicals } from '../data/alphavantage.js';
import { fetchStockTwits, fetchFinviz } from '../data/sentiment.js';
import { generateReport, generateReportStream } from '../report/generator.js';
import { getCachedReport, saveReport } from '../db.js';
import { transformAgg } from './transform.js';
import { CRYPTO, FREE_REPORT_CAP, PAID_REPORT_CAP } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { getUsage, incrementUsage } from '../db/index.js';

const router = Router();

function buildResponse(ticker, report, rawData, generatedAt, cached) {
  const transformed = transformAgg(rawData);
  return {
    ticker,
    price:           transformed.market?.price ?? null,
    change_pct:      transformed.market?.change_pct ?? null,
    report_markdown: report,
    raw_data:        transformed,
    generated_at:    generatedAt,
    cached,
  };
}

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const forceRefresh = req.query.refresh === 'true';

  try {
    if (!forceRefresh) {
      const cached = getCachedReport(ticker);
      if (cached) {
        return res.json(buildResponse(
          ticker,
          cached.report_md,
          JSON.parse(cached.raw_data),
          cached.generated_at,
          true
        ));
      }
    }

    const agg = await aggregateAll(ticker);
    const report = await generateReport(agg);
    saveReport(ticker, agg, report, agg.market?.price, agg.market?.changePct);

    res.json(buildResponse(ticker, report, agg, new Date().toISOString(), false));
  } catch (err) {
    console.error(`Research error for ${ticker}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ticker/refresh', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const agg = await aggregateAll(ticker);
    const report = await generateReport(agg);
    saveReport(ticker, agg, report, agg.market?.price, agg.market?.changePct);
    res.json(buildResponse(ticker, report, agg, new Date().toISOString(), false));
  } catch (err) {
    console.error(`Refresh error for ${ticker}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ticker/data', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const agg = await aggregateAll(ticker);
    res.json(transformAgg(agg));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ticker/stream', requireAuth, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const forceRefresh = req.query.refresh === 'true';

  // Check cache before setting SSE headers so we can enforce the cap cleanly
  const cached = !forceRefresh ? getCachedReport(ticker) : null;

  if (!cached) {
    // Will call Claude — enforce cap before committing to SSE
    const cap = req.user.tier === 'paid' ? PAID_REPORT_CAP : FREE_REPORT_CAP;
    const used = getUsage(req.user.user_id);
    if (used >= cap) {
      const resets = new Date();
      resets.setMonth(resets.getMonth() + 1);
      resets.setDate(1);
      resets.setHours(0, 0, 0, 0);
      return res.status(429).json({ error: 'cap_exceeded', used, cap, resets_on: resets.toISOString() });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    if (cached) {
      // Serve from cache — no usage increment (cached reports are free)
      const rawData = JSON.parse(cached.raw_data);
      send({ type: 'data', payload: transformAgg(rawData) });
      const lines = (cached.report_md || '').split('\n');
      let title = null, content = '';
      for (const line of lines) {
        if (line.startsWith('## ')) {
          if (title) send({ type: 'section', payload: { title, content: content.trim() } });
          title = line.slice(3).trim();
          content = '';
        } else {
          content += line + '\n';
        }
      }
      if (title) send({ type: 'section', payload: { title, content: content.trim() } });
      send({ type: 'done', cached: true, generated_at: cached.generated_at });
      return res.end();
    }

    // Fresh generation — fire all fetchers in parallel
    const isCrypto = CRYPTO.has(ticker);
    const fetchedAt = new Date().toISOString();
    const marketP = fetchMarket(ticker).catch(() => ({}));
    const newsP   = fetchNews(ticker).catch(() => ({ available: false }));
    const avP     = fetchTechnicals(ticker).catch(() => ({ available: false }));
    const stP     = fetchStockTwits(ticker).catch(() => ({ available: false }));
    const fvP     = fetchFinviz(ticker).catch(() => ({}));

    const market = await marketP;
    send({ type: 'data', payload: transformAgg({ ticker, isCrypto, fetchedAt, market,
      newsApi: { available: false }, alphavantage: { available: false },
      stocktwits: { available: false }, finviz: {} }) });

    const timeout = (ms, fallback) => new Promise(r => setTimeout(() => r(fallback), ms));
    const [newsApi, alphavantage, stocktwits, finviz] = await Promise.all([
      Promise.race([newsP, timeout(4000, { available: false })]),
      Promise.race([avP,   timeout(4000, { available: false })]),
      Promise.race([stP,   timeout(3000, { available: false })]),
      Promise.race([fvP,   timeout(3000, {})]),
    ]);
    const agg = { ticker, isCrypto, fetchedAt, market, newsApi, alphavantage, stocktwits, finviz };
    send({ type: 'data', payload: transformAgg(agg) });

    const fullText = await generateReportStream(agg, (section) => {
      send({ type: 'section', payload: section });
    });

    saveReport(ticker, agg, fullText, agg.market?.price, agg.market?.changePct);
    incrementUsage(req.user.user_id); // Only count successful generations against the cap
    send({ type: 'done', cached: false, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error(`Stream error for ${ticker}:`, err);
    send({ type: 'error', message: err.message });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

export default router;
