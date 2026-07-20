const IDS = {
  'BTC-USD':   'bitcoin',
  'ETH-USD':   'ethereum',
  'SOL-USD':   'solana',
  'DOGE-USD':  'dogecoin',
  'ADA-USD':   'cardano',
  'XRP-USD':   'ripple',
  'AVAX-USD':  'avalanche-2',
  'LTC-USD':   'litecoin',
  'MATIC-USD': 'matic-network',
  'LINK-USD':  'chainlink',
  'DOT-USD':   'polkadot',
  'UNI-USD':   'uniswap',
  'SHIB-USD':  'shiba-inu',
};

export function cgId(ticker) { return IDS[ticker] ?? null; }

export async function fetchCryptoPrices(tickers) {
  const valid = tickers.filter(t => cgId(t));
  if (valid.length === 0) return {};
  try {
    const ids = valid.map(cgId).join(',');
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return {};
    const d = await r.json();
    const out = {};
    for (const t of valid) {
      const item = d[cgId(t)];
      if (item) out[t] = { price: item.usd, changePct: item.usd_24h_change != null ? +item.usd_24h_change.toFixed(2) : null };
    }
    return out;
  } catch { return {}; }
}

export async function fetchCryptoPrice(ticker) {
  const res = await fetchCryptoPrices([ticker]);
  return res[ticker] ?? null;
}
