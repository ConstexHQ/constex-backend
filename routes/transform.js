import { WATCHLIST } from '../config.js';

const WL_MAP = Object.fromEntries(WATCHLIST.map(w => [w.ticker, w]));

export function transformMarket(m) {
  if (!m) return {};
  return {
    price:               m.price,
    change_pct:          m.changePct,
    sparkline:           m.sparkline ?? [],
    market_cap:          m.marketCap,
    volume:              m.volume,
    avg_volume:          m.avgVolume,
    '52w_high':          m.high52w,
    '52w_low':           m.low52w,
    perf_52w:            m.perf52w,
    pe_ratio:            m.peRatio,
    forward_pe:          m.forwardPE,
    peg_ratio:           m.pegRatio,
    ev_ebitda:           m.evEbitda,
    ev_revenue:          m.evRevenue,
    price_to_sales:      m.priceToSales,
    price_to_book:       m.priceToBook,
    beta:                m.beta,
    dividend_yield:      m.dividendYield,
    short_percent_float: m.shortPctFloat,
    short_ratio:         m.shortRatio,
    revenue_ttm:         m.revenueTTM,
    ebitda:              m.ebitda,
    free_cashflow:       m.freeCashflow,
    gross_margin:        m.grossMargin,
    op_margin:           m.opMargin,
    net_margin:          m.netMargin,
    roe:                 m.roe,
    roa:                 m.roa,
    total_cash:          m.totalCash,
    total_debt:          m.totalDebt,
    current_ratio:       m.currentRatio,
    debt_to_equity:      m.debtToEquity,
    eps_ttm:             m.epsTTM,
    eps_forward:         m.epsForward,
    analyst_target_low:  m.analystTargetLow,
    analyst_target_mean: m.analystTargetMean,
    analyst_target_high: m.analystTargetHigh,
    analyst_count:       m.analystCount,
    recommendation:      m.recommendation,
    put_call_ratio:      m.putCallRatio,
    options_max_pain:    m.maxPain,
    earnings_date:       m.earningsDate,
    sector:              m.sector,
    industry:            m.industry,
    description:         m.description,
    exchange:            m.exchange,
    currency:            m.currency,
    name:                m.name,
    news:                m.news ?? [],
  };
}

export function transformAV(av) {
  if (!av) return { available: false };
  return {
    available:          av.available,
    cached:             av.cached,
    rsi:                av.rsi,
    rsi_signal:         av.rsiSignal,
    macd:               av.macd,
    macd_signal_line:   av.macdSignalLine,
    macd_hist:          av.macdHist,
    macd_interpretation: av.macdInterpretation,
    bb_upper:           av.bbUpper,
    bb_middle:          av.bbMiddle,
    bb_lower:           av.bbLower,
    sma_50:             av.sma50,
    sma_200:            av.sma200,
  };
}

export function transformFinviz(fv) {
  if (!fv) return {};
  return {
    rsi:           fv.rsi,
    sma_20:        fv.sma20,
    sma_50:        fv.sma50,
    sma_200:       fv.sma200,
    perf_week:     fv.perfWeek,
    perf_month:    fv.perfMonth,
    perf_ytd:      fv.perfYtd,
    perf_year:     fv.perfYear,
    short_float:   fv.shortFloat,
    short_ratio:   fv.shortRatio,
    analyst_rating: fv.analystRating,
    rel_volume:    fv.relVolume,
    atr:           fv.atr,
    volatility:    fv.volatility,
  };
}

export function transformStockTwits(st) {
  if (!st) return { available: false };
  return {
    available:     st.available,
    bullish_pct:   st.bullishPct,
    bearish_pct:   st.bearishPct,
    label:         st.label,
    message_count: st.messageCount,
  };
}

export function transformNewsApi(n) {
  if (!n) return { available: false };
  return {
    available:        n.available,
    article_count:    n.articleCount,
    overall_sentiment: n.overallSentiment,
    sentiment_score:  n.sentimentScore,
    positive_count:   n.positiveCount,
    negative_count:   n.negativeCount,
    neutral_count:    n.neutralCount,
    articles:         (n.articles || []).map(a => ({
      title:           a.title,
      source:          a.source,
      url:             a.url,
      published_at:    a.publishedAt,
      description:     a.description,
      sentiment_score: a.sentimentScore,
      sentiment_label: a.sentimentLabel,
    })),
  };
}

export function transformAgg(agg) {
  return {
    ticker:    agg.ticker,
    is_crypto: agg.isCrypto,
    fetched_at: agg.fetchedAt,
    market:       transformMarket(agg.market),
    alpha_vantage: transformAV(agg.alphavantage),
    finviz:        transformFinviz(agg.finviz),
    stocktwits:    transformStockTwits(agg.stocktwits),
    news_api:      transformNewsApi(agg.newsApi),
    reddit:        { available: false },
    sec_filings:   [],
    insider_trades_openinsider: [],
    institutional_holders: [],
  };
}

export function transformPosition(ticker, m, news) {
  const meta = WL_MAP[ticker] || { ticker, display: ticker, name: ticker, type: 'stock' };
  return {
    ticker:               meta.ticker,
    display:              meta.display,
    name:                 m.name || meta.name,
    type:                 meta.type,
    price:                m.price,
    change_pct:           m.changePct,
    market_cap:           m.marketCap,
    volume:               m.volume,
    '52w_high':           m.high52w,
    '52w_low':            m.low52w,
    perf_52w:             m.perf52w,
    pe_ratio:             m.peRatio,
    analyst_target_mean:  m.analystTargetMean,
    recommendation:       m.recommendation,
    news_headline:        news?.articles?.[0]?.title ?? null,
    news_sentiment:       news?.overallSentiment ?? null,
    news_count:           news?.articleCount ?? 0,
  };
}

export function transformTickerPrice(ticker, m) {
  const meta = WL_MAP[ticker] || { ticker, display: ticker };
  return {
    ticker:     meta.ticker,
    display:    meta.display,
    price:      m.price,
    change_pct: m.changePct,
  };
}
