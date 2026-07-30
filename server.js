process.on('uncaughtException', (err) => { console.error('[CRASH]', err.message, err.stack); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error('[REJECT]', err); });
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { PORT, REPORT_REFRESH_HOUR } from './config.js';
import researchRouter  from './routes/research.js';
import monitorRouter   from './routes/monitor.js';
import newsRouter      from './routes/news.js';
import macroRouter     from './routes/macro.js';
import watchlistRouter from './routes/watchlist.js';
import searchRouter    from './routes/search.js';
import chartRouter     from './routes/chart.js';
import gateRouter      from './routes/gate.js';
import authRouter      from './routes/auth.js';
import usageRouter     from './routes/usage.js';
import { aggregateAll } from './data/aggregator.js';
import { generateReport } from './report/generator.js';
import { getCachedReport, saveReport } from './db.js';
import { getTickers } from './data/watchlist.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/research',  researchRouter);
app.use('/api/monitor',   monitorRouter);
app.use('/api/news',      newsRouter);
app.use('/api/macro',     macroRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/search',    searchRouter);
app.use('/api/chart',     chartRouter);
app.use('/api/gate',      gateRouter);
app.use('/api/auth',      authRouter);
app.use('/api/usage',     usageRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

async function refreshWatchlist() {
  const tickers = getTickers();
  console.log(`[cron] Refreshing ${tickers.length} watchlist reports...`);
  for (const ticker of tickers) {
    try {
      const agg = await aggregateAll(ticker);
      const report = await generateReport(agg);
      saveReport(ticker, report, agg);
      console.log(`[cron] ${ticker} refreshed`);
    } catch (err) {
      console.error(`[cron] ${ticker} failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log('[cron] Watchlist refresh complete');
}

cron.schedule(`0 ${REPORT_REFRESH_HOUR} * * *`, () => {
  refreshWatchlist().catch(console.error);
}, { timezone: 'America/New_York' });

app.listen(PORT, () => {
  console.log(`Terminal backend running on http://localhost:${PORT}`);
  console.log(`Watchlist: ${getTickers().join(', ')}`);
  console.log(`Daily refresh: ${REPORT_REFRESH_HOUR}:00 ET`);
});
