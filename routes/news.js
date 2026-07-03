import { Router } from 'express';
import { fetchNews } from '../data/newsapi.js';
import { fetchYahooNews } from '../data/market.js';
import { getWatchlist } from '../data/watchlist.js';

const router = Router();

const POS = new Set(['beat','surge','soar','rally','record','strong','growth','bullish','buy','upgrade','outperform','profit','rise','gain','deal','approval','breakthrough']);
const NEG = new Set(['miss','fall','drop','crash','weak','loss','bearish','sell','downgrade','underperform','recall','lawsuit','decline','cut','layoff','warning','fraud','default']);

function score(text) {
  const words = (text || '').toLowerCase().match(/\b\w+\b/g) || [];
  const p = words.filter(w => POS.has(w)).length;
  const n = words.filter(w => NEG.has(w)).length;
  const t = p + n;
  return t === 0 ? 0 : +((p - n) / t).toFixed(2);
}

function sentimentLabel(s) {
  return s > 0.15 ? 'POSITIVE' : s < -0.15 ? 'NEGATIVE' : 'NEUTRAL';
}

async function fetchCombinedNews(item) {
  const [yahooArticles, napiResult] = await Promise.allSettled([
    fetchYahooNews(item.ticker),
    fetchNews(item.ticker, item.name),
  ]);

  const yahoo = (yahooArticles.status === 'fulfilled' ? yahooArticles.value : []).map(a => ({
    ...a,
    source: a.source || 'Yahoo Finance',
    sentimentScore: score(a.title),
    sentimentLabel: sentimentLabel(score(a.title)),
    _src: 'yahoo',
  }));

  const napi = napiResult.status === 'fulfilled' && napiResult.value.available
    ? (napiResult.value.articles || []).map(a => ({ ...a, _src: 'newsapi' }))
    : [];

  // Merge and deduplicate by title prefix
  const seen = new Set();
  const merged = [];
  for (const a of [...yahoo, ...napi]) {
    const key = a.title.slice(0, 55).toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key)) { seen.add(key); merged.push(a); }
  }

  return merged;
}

router.get('/', async (req, res) => {
  const watchlist = getWatchlist();

  try {
    const results = await Promise.allSettled(
      watchlist.map(item => fetchCombinedNews(item).then(articles => ({ item, articles })))
    );

    const allArticles = [];
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { item, articles } = r.value;
      for (const a of articles) {
        allArticles.push({ ...a, ticker: item.display });
      }
    }

    allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    const deduped = [];
    const seen = new Set();
    for (const a of allArticles) {
      const key = a.title.slice(0, 60).toLowerCase().replace(/\s+/g, '');
      if (!seen.has(key)) { seen.add(key); deduped.push(a); }
    }

    const news = deduped.slice(0, 120).map(a => ({
      title:     a.title,
      publisher: a.source,
      link:      a.url,
      published: a.publishedAt ? Math.floor(new Date(a.publishedAt).getTime() / 1000) : 0,
      ticker:    a.ticker,
      sentiment: a.sentimentLabel,
    }));

    res.json({ news, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const watchlist = getWatchlist();
  const item = watchlist.find(w => w.ticker === ticker || w.display === ticker)
    || { ticker, display: ticker, name: ticker };

  try {
    const articles = await fetchCombinedNews(item);
    const news = articles.map(a => ({
      title:     a.title,
      publisher: a.source,
      link:      a.url,
      published: a.publishedAt ? Math.floor(new Date(a.publishedAt).getTime() / 1000) : 0,
      ticker:    item.display || ticker,
      sentiment: a.sentimentLabel,
    }));
    const scores = articles.map(a => a.sentimentScore).filter(s => s != null);
    const avg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;
    res.json({ news, available: news.length > 0, sentiment: sentimentLabel(avg) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
