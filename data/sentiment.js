import * as cheerio from 'cheerio';

export async function fetchStockTwits(ticker) {
  const clean = ticker.replace('-USD', '.X').replace('-', '.');
  const sym = ticker === 'ETH-USD' ? 'ETH.X' : clean;
  try {
    const r = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${sym}.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!r.ok) return { available: false };
    const data = await r.json();
    const msgs = data.messages || [];
    let bull = 0, bear = 0;
    for (const m of msgs.slice(0, 30)) {
      const s = m.entities?.sentiment?.basic;
      if (s === 'Bullish') bull++;
      else if (s === 'Bearish') bear++;
    }
    const total = bull + bear;
    const bullPct = total > 0 ? Math.round((bull / total) * 100) : 50;
    return {
      available: true,
      bullishPct: bullPct,
      bearishPct: 100 - bullPct,
      label: bullPct > 55 ? 'BULLISH' : (100 - bullPct) > 55 ? 'BEARISH' : 'NEUTRAL',
      messageCount: msgs.length,
    };
  } catch { return { available: false }; }
}

export async function fetchFinviz(ticker) {
  try {
    const r = await fetch(`https://finviz.com/quote.ashx?t=${ticker}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!r.ok) return {};
    const html = await r.text();
    const $ = cheerio.load(html);
    const data = {};
    $('table.snapshot-table2 td').each((i, el) => {
      if (i % 2 === 0) data._key = $(el).text().trim();
      else if (data._key) { data[data._key] = $(el).text().trim(); delete data._key; }
    });
    return {
      rsi:          data['RSI (14)'] || '',
      sma20:        data['SMA20']    || '',
      sma50:        data['SMA50']    || '',
      sma200:       data['SMA200']   || '',
      perfWeek:     data['Perf Week']  || '',
      perfMonth:    data['Perf Month'] || '',
      perfYtd:      data['Perf YTD']   || '',
      perfYear:     data['Perf Year']  || '',
      shortFloat:   data['Short Float']|| '',
      shortRatio:   data['Short Ratio']|| '',
      analystRating:data['Recom']      || '',
      relVolume:    data['Rel Volume'] || '',
      atr:          data['ATR (14)']   || '',
      volatility:   data['Volatility'] || '',
    };
  } catch { return {}; }
}
