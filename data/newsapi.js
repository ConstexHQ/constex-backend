import { NEWS_API_KEY } from '../config.js';

const CRYPTO_NAMES = {
  'BTC-USD':  'Bitcoin',
  'ETH-USD':  'Ethereum',
  'SOL-USD':  'Solana',
  'DOGE-USD': 'Dogecoin',
  'ADA-USD':  'Cardano',
  'XRP-USD':  'XRP Ripple',
  'AVAX-USD': 'Avalanche',
  'LTC-USD':  'Litecoin',
  'MATIC-USD':'Polygon',
  'LINK-USD': 'Chainlink',
  'DOT-USD':  'Polkadot',
  'UNI-USD':  'Uniswap',
  'SHIB-USD': 'Shiba Inu',
};

const LOW_QUALITY_SOURCES = new Set([
  'globenewswire.com', 'prnewswire.com', 'businesswire.com',
  'accesswire.com', 'einpresswire.com', 'newswire.com',
]);

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

export async function fetchNews(ticker, companyName = '') {
  if (!NEWS_API_KEY) return { available: false, reason: 'NEWS_API_KEY not set' };

  const display = ticker.replace('-USD', '');
  const cryptoName = CRYPTO_NAMES[ticker];

  // Build query and title-match terms
  let query;
  let titleTerms;

  if (cryptoName) {
    // Crypto — use full name only, ticker symbols are too ambiguous
    query = `"${cryptoName.split(' ')[0]}"`;
    titleTerms = cryptoName.toLowerCase().split(' ');
  } else if (display.length <= 3 && companyName) {
    // Short ticker (NU, TSM etc) — ticker is too ambiguous, use company name
    query = `"${companyName}"`;
    titleTerms = companyName.toLowerCase().split(' ').filter(w => w.length > 2);
  } else if (companyName) {
    const shortName = companyName.split(' ')[0];
    query = `"${display}" OR "${shortName}"`;
    titleTerms = [display.toLowerCase(), shortName.toLowerCase()];
  } else {
    query = `"${display}"`;
    titleTerms = [display.toLowerCase()];
  }

  const from = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);

  try {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', query);
    url.searchParams.set('from', from);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'relevancy');
    url.searchParams.set('pageSize', '40');
    url.searchParams.set('apiKey', NEWS_API_KEY);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) return { available: false, reason: data.message || 'API error' };

    const articles = (data.articles || [])
      .filter(a => {
        if (!a.title || a.title.includes('[Removed]')) return false;
        if (!a.source || a.source.name === '[Removed]') return false;
        try {
          const domain = new URL(a.url).hostname.replace('www.', '');
          if (LOW_QUALITY_SOURCES.has(domain)) return false;
        } catch {}
        // Title must contain at least one relevant term
        const title = a.title.toLowerCase();
        return titleTerms.some(t => t.length > 2 && title.includes(t));
      })
      .slice(0, 20)
      .map(a => {
        const s = score(`${a.title} ${a.description}`);
        return {
          title: a.title,
          source: a.source?.name || '',
          url: a.url || '',
          publishedAt: a.publishedAt || '',
          description: (a.description || '').slice(0, 300),
          sentimentScore: s,
          sentimentLabel: sentimentLabel(s),
        };
      });

    const scores = articles.map(a => a.sentimentScore);
    const avg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;

    return {
      available: true,
      articleCount: articles.length,
      articles,
      overallSentiment: sentimentLabel(avg),
      sentimentScore: avg,
      positiveCount: scores.filter(s => s > 0.15).length,
      negativeCount: scores.filter(s => s < -0.15).length,
      neutralCount:  scores.filter(s => s >= -0.15 && s <= 0.15).length,
    };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}
