import { AV_KEY, AV_CACHE_HRS, DATA_DIR } from '../config.js';
import { join } from 'path';
import fs from 'fs';

const CACHE_FILE = join(DATA_DIR, 'av_cache.json');

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}
function saveCache(c) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(c)); } catch {}
}
function isFresh(entry) {
  if (!entry?.fetchedAt) return false;
  return Date.now() - new Date(entry.fetchedAt).getTime() < AV_CACHE_HRS * 3600 * 1000;
}

async function avGet(params) {
  if (!AV_KEY) return {};
  const url = new URL('https://www.alphavantage.co/query');
  Object.entries({ ...params, apikey: AV_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const r = await fetch(url.toString());
    const d = await r.json();
    if (d.Note || d.Information) { console.warn('Alpha Vantage rate limit hit'); return {}; }
    return d;
  } catch { return {}; }
}

export async function fetchTechnicals(ticker) {
  if (!AV_KEY) return { available: false, reason: 'ALPHA_VANTAGE_KEY not set' };

  const sym = ticker.replace('-USD', 'USD');
  const cache = loadCache();
  if (cache[sym] && isFresh(cache[sym])) return { ...cache[sym], cached: true };

  const timed = async (name, fn) => {
    const t = Date.now();
    const r = await fn();
    console.log(`[timer]   av:${name}: ${Date.now() - t}ms`);
    return r;
  };

  const [rsiData, macdData, bbData, sma50Data, sma200Data] = await Promise.all([
    timed('RSI',    () => avGet({ function: 'RSI',    symbol: sym, interval: 'daily', time_period: 14, series_type: 'close' })),
    timed('MACD',   () => avGet({ function: 'MACD',   symbol: sym, interval: 'daily', series_type: 'close' })),
    timed('BBANDS', () => avGet({ function: 'BBANDS', symbol: sym, interval: 'daily', time_period: 20, series_type: 'close', nbdevup: 2, nbdevdn: 2 })),
    timed('SMA50',  () => avGet({ function: 'SMA',    symbol: sym, interval: 'daily', time_period: 50,  series_type: 'close' })),
    timed('SMA200', () => avGet({ function: 'SMA',    symbol: sym, interval: 'daily', time_period: 200, series_type: 'close' })),
  ]);

  function latest(ts) { const keys = Object.keys(ts || {}).sort().reverse(); return keys[0] ? ts[keys[0]] : null; }

  const rsiRow   = latest(rsiData['Technical Analysis: RSI']);
  const macdRow  = latest(macdData['Technical Analysis: MACD']);
  const bbRow    = latest(bbData['Technical Analysis: BBANDS']);
  const sma50Row = latest(sma50Data['Technical Analysis: SMA']);
  const sma200Row= latest(sma200Data['Technical Analysis: SMA']);

  const rsi   = rsiRow  ? +parseFloat(rsiRow.RSI).toFixed(2)        : null;
  const macd  = macdRow ? +parseFloat(macdRow.MACD).toFixed(4)       : null;
  const macdSig = macdRow ? +parseFloat(macdRow.MACD_Signal).toFixed(4) : null;
  const macdHist= macdRow ? +parseFloat(macdRow.MACD_Hist).toFixed(4)   : null;
  const bbUpper = bbRow   ? +parseFloat(bbRow['Real Upper Band']).toFixed(2) : null;
  const bbMid   = bbRow   ? +parseFloat(bbRow['Real Middle Band']).toFixed(2): null;
  const bbLower = bbRow   ? +parseFloat(bbRow['Real Lower Band']).toFixed(2) : null;
  const sma50   = sma50Row  ? +parseFloat(sma50Row.SMA).toFixed(2)   : null;
  const sma200  = sma200Row ? +parseFloat(sma200Row.SMA).toFixed(2)  : null;

  const rsiSignal = rsi === null ? null : rsi >= 70 ? 'OVERBOUGHT' : rsi <= 30 ? 'OVERSOLD' : rsi >= 60 ? 'BULLISH' : rsi <= 40 ? 'BEARISH' : 'NEUTRAL';
  const macdLabel = macd === null ? null : macd > macdSig ? 'BULLISH' : macd < macdSig ? 'BEARISH' : 'NEUTRAL';

  const result = {
    available: !!(rsi || macd || bbUpper),
    cached: false, fetchedAt: new Date().toISOString(),
    rsi, rsiSignal, macd, macdSignalLine: macdSig, macdHist, macdInterpretation: macdLabel,
    bbUpper, bbMiddle: bbMid, bbLower, sma50, sma200,
  };

  if (result.available) { cache[sym] = result; saveCache(cache); }
  return result;
}
