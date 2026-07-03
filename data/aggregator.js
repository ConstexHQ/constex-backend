import { fetchMarket }      from './market.js';
import { fetchNews }        from './newsapi.js';
import { fetchTechnicals }  from './alphavantage.js';
import { fetchStockTwits, fetchFinviz } from './sentiment.js';
import { CRYPTO }           from '../config.js';

async function timed(name, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    console.log(`[timer] ${name}: ${Date.now() - t}ms`);
    return r;
  } catch (err) {
    console.log(`[timer] ${name}: ${Date.now() - t}ms (ERROR: ${err.message})`);
    throw err;
  }
}

export async function aggregateAll(ticker) {
  const isCrypto = CRYPTO.has(ticker);
  const start = Date.now();

  const [market, newsApi, alphavantage, stocktwits, finviz] = await Promise.allSettled([
    timed(`market(${ticker})`,      () => fetchMarket(ticker)),
    timed(`newsapi(${ticker})`,     () => fetchNews(ticker)),
    timed(`alphavantage(${ticker})`,() => fetchTechnicals(ticker)),
    timed(`stocktwits(${ticker})`,  () => fetchStockTwits(ticker)),
    timed(`finviz(${ticker})`,      () => fetchFinviz(ticker)),
  ]);

  console.log(`[timer] aggregateAll(${ticker}) total: ${Date.now() - start}ms`);

  const get = r => r.status === 'fulfilled' ? r.value : {};

  const mkt = get(market);

  return {
    ticker,
    isCrypto,
    fetchedAt: new Date().toISOString(),
    market:      mkt,
    newsApi:     get(newsApi),
    alphavantage:get(alphavantage),
    stocktwits:  get(stocktwits),
    finviz:      get(finviz),
  };
}
