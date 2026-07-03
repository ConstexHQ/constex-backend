import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function yfChart(ticker, interval = '1d', range = '1d') {
  const sym = ticker.replace('-', '-');
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`;
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.chart?.result?.[0] ?? null;
  } catch { return null; }
}

async function yfSearch(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=20&quotesCount=1&enableFuzzyQuery=false`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return {};
    return await r.json();
  } catch { return {}; }
}

// Exported: pull Yahoo Finance news for a ticker (no API key needed)
export async function fetchYahooNews(ticker) {
  try {
    const d = await yfSearch(ticker);
    const items = d?.news ?? [];
    return items.map(n => ({
      title:       n.title || '',
      source:      n.publisher || 'Yahoo Finance',
      url:         n.link || '',
      publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : '',
    })).filter(n => n.title && n.url);
  } catch { return []; }
}

async function yfOptions(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
    const r = await fetch(url, { headers: { ...HEADERS, Accept: 'application/json,*/*' } });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.optionChain?.result?.[0] ?? null;
  } catch { return null; }
}

async function fetchFinvizFull(ticker) {
  try {
    const r = await fetch(`https://finviz.com/quote.ashx?t=${ticker}`, { headers: HEADERS });
    if (!r.ok) return {};
    const html = await r.text();
    const $ = cheerio.load(html);
    const data = {};
    $('table.snapshot-table2 td, .snapshot-td2').each((i, el) => {
      if (i % 2 === 0) data._key = $(el).text().trim();
      else if (data._key) { data[data._key] = $(el).text().trim(); delete data._key; }
    });
    const txt = (k) => data[k] || '';
    const num = (k) => { const v = parseFloat(txt(k).replace('%', '').replace('B', '').replace('M', '')); return isNaN(v) ? null : v; };
    const cap = txt('Market Cap');
    let marketCap = null;
    if (cap.endsWith('B')) marketCap = parseFloat(cap) * 1e9;
    else if (cap.endsWith('M')) marketCap = parseFloat(cap) * 1e6;

    return {
      price:         parseFloat(txt('Price')) || null,
      change:        txt('Change'),
      peRatio:       num('P/E'),
      forwardPE:     num('Forward P/E'),
      pegRatio:      num('PEG'),
      priceToBook:   num('P/B'),
      priceToSales:  num('P/S'),
      evEbitda:      num('EV/EBITDA'),
      epsTTM:        num('EPS (ttm)'),
      epsNextY:      num('EPS next Y'),
      marketCap,
      volume:        null,
      avgVolume:     null,
      beta:          num('Beta'),
      dividendYield: num('Dividend %') != null ? num('Dividend %') / 100 : null,
      shortPctFloat: txt('Short Float'),
      shortRatio:    txt('Short Ratio'),
      rsi:           num('RSI (14)'),
      sma20:         txt('SMA20'),
      sma50:         txt('SMA50'),
      sma200:        txt('SMA200'),
      perfWeek:      txt('Perf Week'),
      perfMonth:     txt('Perf Month'),
      perfYtd:       txt('Perf YTD'),
      perfYear:      txt('Perf Year'),
      atr:           txt('ATR (14)'),
      volatility:    txt('Volatility'),
      relVolume:     txt('Rel Volume'),
      analystRating: txt('Recom'),
      targetPrice:   num('Target Price'),
      high52:        num('52W High'),
      low52:         num('52W Low'),
      grossMargin:   num('Gross Margin') != null ? num('Gross Margin') / 100 : null,
      opMargin:      num('Oper. Margin') != null ? num('Oper. Margin') / 100 : null,
      netMargin:     num('Profit Margin') != null ? num('Profit Margin') / 100 : null,
      roe:           num('ROE') != null ? num('ROE') / 100 : null,
      roa:           num('ROA') != null ? num('ROA') / 100 : null,
      revenueTTM:    txt('Sales'),
      debtToEquity:  num('Debt/Eq'),
      currentRatio:  num('Current Ratio'),
      sector:        txt('Sector'),
      industry:      txt('Industry'),
      country:       txt('Country'),
      employees:     txt('Employees'),
      earningsDate:  txt('Earnings'),
    };
  } catch { return {}; }
}

async function timed(name, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    console.log(`[timer]   ${name}: ${Date.now() - t}ms`);
    return r;
  } catch (err) {
    console.log(`[timer]   ${name}: ${Date.now() - t}ms (ERROR: ${err.message})`);
    throw err;
  }
}

const withTimeout = (ms, p) =>
  Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]);

export async function fetchMarket(ticker) {
  const isCrypto = ticker.endsWith('-USD');

  const [chart1d, chart1y, searchRes, optRes, fvData] = await Promise.allSettled([
    timed('yf:chart1d',  () => yfChart(ticker, '1d', '5d')),
    timed('yf:chart1y',  () => yfChart(ticker, '1mo', '1y')),
    timed('yf:search',   () => yfSearch(ticker)),
    timed('yf:options',  () => isCrypto ? Promise.resolve(null) : withTimeout(3000, yfOptions(ticker))),
    timed('yf:finviz',   () => isCrypto ? Promise.resolve({}) : fetchFinvizFull(ticker)),
  ]);

  const get = r => r.status === 'fulfilled' ? r.value : null;
  const chart  = get(chart1d);
  const chart1Y = get(chart1y);
  const search  = get(searchRes) || {};
  const opts    = get(optRes);
  const fv      = get(fvData) || {};

  const meta = chart?.meta || {};
  const price = fv.price ?? meta.regularMarketPrice ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const changePct = (price && prevClose && prevClose !== 0)
    ? +((((price - prevClose) / prevClose) * 100).toFixed(2))
    : null;

  let sparkline = [];
  try {
    const closes = chart?.indicators?.quote?.[0]?.close || [];
    sparkline = closes.filter(c => c != null).slice(-30);
  } catch {}

  let perf52w = null;
  try {
    const closes = chart1Y?.indicators?.quote?.[0]?.close || [];
    const valid = closes.filter(c => c != null);
    if (valid.length >= 2 && price) {
      perf52w = +((((price - valid[0]) / valid[0]) * 100).toFixed(2));
    }
  } catch {}

  const news = (search.news || []).slice(0, 20).map(n => ({
    title: n.title,
    publisher: n.publisher,
    link: n.link,
    published: n.providerPublishTime || 0,
  }));

  let putCallRatio = null, maxPain = null;
  if (opts?.options?.length > 0) {
    const chain = opts.options[0];
    const callsOI = chain.calls.reduce((s, c) => s + (c.openInterest || 0), 0);
    const putsOI  = chain.puts.reduce((s, c)  => s + (c.openInterest || 0), 0);
    if (callsOI > 0) putCallRatio = +(putsOI / callsOI).toFixed(2);
    const strikes = [...new Set([
      ...chain.calls.map(c => c.strike),
      ...chain.puts.map(c => c.strike),
    ])].sort((a, b) => a - b);
    let minPain = Infinity, mpStrike = null;
    for (const s of strikes) {
      const cp = chain.calls.reduce((t, c) => t + Math.max(0, s - c.strike) * (c.openInterest || 0), 0);
      const pp = chain.puts.reduce((t, c)  => t + Math.max(0, c.strike - s) * (c.openInterest || 0), 0);
      if (cp + pp < minPain) { minPain = cp + pp; mpStrike = s; }
    }
    maxPain = mpStrike;
  }

  const quoteRes = search.quotes?.[0] || {};

  return {
    ticker,
    isCrypto,
    price,
    prevClose,
    changePct,
    change: price != null && prevClose != null ? +(price - prevClose).toFixed(2) : null,
    sparkline,
    perf52w,
    volume:       meta.regularMarketVolume ?? null,
    avgVolume:    null,
    marketCap:    fv.marketCap ?? quoteRes.marketCap ?? meta.marketCap ?? null,
    high52w:      fv.high52 ?? meta.fiftyTwoWeekHigh ?? null,
    low52w:       fv.low52  ?? meta.fiftyTwoWeekLow  ?? null,
    peRatio:      fv.peRatio    ?? null,
    forwardPE:    fv.forwardPE  ?? null,
    pegRatio:     fv.pegRatio   ?? null,
    evEbitda:     fv.evEbitda   ?? null,
    evRevenue:    null,
    priceToSales: fv.priceToSales ?? null,
    priceToBook:  fv.priceToBook  ?? null,
    beta:         fv.beta         ?? null,
    dividendYield: fv.dividendYield ?? null,
    shortPctFloat: fv.shortPctFloat ?? null,
    shortRatio:    fv.shortRatio    ?? null,
    sharesOutstanding: null,
    revenueTTM:   fv.revenueTTM   ? parseFinvizSize(fv.revenueTTM) : null,
    ebitda:       null,
    freeCashflow: null,
    grossMargin:  fv.grossMargin ?? null,
    opMargin:     fv.opMargin    ?? null,
    netMargin:    fv.netMargin   ?? null,
    revenueGrowth: null,
    earningsGrowth: null,
    roe:          fv.roe ?? null,
    roa:          fv.roa ?? null,
    totalCash:    null,
    totalDebt:    null,
    currentRatio: fv.currentRatio  ?? null,
    debtToEquity: fv.debtToEquity  ?? null,
    epsTTM:       fv.epsTTM        ?? null,
    epsForward:   fv.epsNextY      ?? null,
    enterpriseValue: null,
    analystTargetLow:  null,
    analystTargetMean: fv.targetPrice ?? null,
    analystTargetHigh: null,
    analystCount:  null,
    recommendation: fv.analystRating ?? '',
    recTrend:     [],
    insiders:     [],
    putCallRatio,
    maxPain,
    earningsDate: fv.earningsDate ?? null,
    sector:   fv.sector   ?? quoteRes.sector   ?? '',
    industry: fv.industry ?? quoteRes.industry ?? '',
    description: '',
    exchange: meta.exchangeName ?? '',
    currency: meta.currency     ?? 'USD',
    name:     meta.instrumentType === 'CRYPTOCURRENCY'
      ? ticker.replace('-USD', '')
      : (quoteRes.longname || quoteRes.shortname || ticker),
    news,
    finvizExtra: {
      rsi:        fv.rsi,
      sma20:      fv.sma20,
      sma50:      fv.sma50,
      sma200:     fv.sma200,
      perfWeek:   fv.perfWeek,
      perfMonth:  fv.perfMonth,
      perfYtd:    fv.perfYtd,
      perfYear:   fv.perfYear,
      atr:        fv.atr,
      volatility: fv.volatility,
      relVolume:  fv.relVolume,
      shortFloat: fv.shortPctFloat,
      shortRatio: fv.shortRatio,
      analystRating: fv.analystRating,
    },
  };
}

function parseFinvizSize(s) {
  if (!s) return null;
  if (s.endsWith('B')) return parseFloat(s) * 1e9;
  if (s.endsWith('M')) return parseFloat(s) * 1e6;
  if (s.endsWith('K')) return parseFloat(s) * 1e3;
  return parseFloat(s) || null;
}
