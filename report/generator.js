import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_KEY } from '../config.js';
import { REPORT_PROMPT, CRYPTO_NOTE } from './prompts.js';

const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

function pct(v) { return v != null ? (v * 100).toFixed(1) + '%' : 'N/A'; }
function bil(v) { return v != null ? '$' + (v / 1e9).toFixed(2) + 'B' : 'N/A'; }
function fmt(v) { return v != null ? v : 'N/A'; }

function analystBreakdown(recTrend) {
  if (!recTrend?.length) return 'N/A';
  const latest = recTrend[0];
  return `Strong Buy: ${latest.strong_buy ?? 0}, Buy: ${latest.buy ?? 0}, Hold: ${latest.hold ?? 0}, Sell: ${latest.sell ?? 0}, Strong Sell: ${latest.strong_sell ?? 0}`;
}

function formatData(agg) {
  const { market: m, newsApi, alphavantage: av, stocktwits, finviz } = agg;
  const sections = [];

  if (m.price != null) {
    sections.push(`MARKET DATA:
Price: $${m.price}
Change: ${fmt(m.changePct)}%
52W High: $${fmt(m.high52w)}  52W Low: $${fmt(m.low52w)}
YTD Perf: ${fmt(m.perf52w)}%
Market Cap: ${bil(m.marketCap)}
Volume: ${m.volume?.toLocaleString() ?? 'N/A'}  Avg Volume: ${m.avgVolume?.toLocaleString() ?? 'N/A'}
P/E (TTM): ${fmt(m.peRatio)}  Forward P/E: ${fmt(m.forwardPE)}  PEG: ${fmt(m.pegRatio)}
EV/EBITDA: ${fmt(m.evEbitda)}  EV/Revenue: ${fmt(m.evRevenue)}
P/S: ${fmt(m.priceToSales)}  P/B: ${fmt(m.priceToBook)}
EPS (TTM): ${fmt(m.epsTTM)}  EPS Forward: ${fmt(m.epsForward)}
Beta: ${fmt(m.beta)}
Dividend Yield: ${m.dividendYield != null ? (m.dividendYield * 100).toFixed(2) + '%' : 'N/A'}
Revenue (TTM): ${bil(m.revenueTTM)}
Gross Margin: ${pct(m.grossMargin)}
Operating Margin: ${pct(m.opMargin)}
Net Margin: ${pct(m.netMargin)}
Free Cash Flow: ${bil(m.freeCashflow)}
Total Cash: ${bil(m.totalCash)}
Total Debt: ${bil(m.totalDebt)}
Return on Equity: ${pct(m.roe)}
Return on Assets: ${pct(m.roa)}
Revenue Growth (YoY): ${pct(m.revenueGrowth)}
Earnings Growth (YoY): ${pct(m.earningsGrowth)}
Sector: ${fmt(m.sector)}  Industry: ${fmt(m.industry)}`);
  }

  if (m.currentRatio || m.debtToEquity) {
    sections.push(`BALANCE SHEET:
Current Ratio: ${fmt(m.currentRatio)}
Debt/Equity: ${fmt(m.debtToEquity)}
Enterprise Value: ${bil(m.enterpriseValue)}`);
  }

  if (m.analystTargetMean || m.recommendation) {
    sections.push(`ANALYST CONSENSUS:
Rating: ${fmt(m.recommendation)}
Target (Mean): $${fmt(m.analystTargetMean)}
Target (Low): $${fmt(m.analystTargetLow)}
Target (High): $${fmt(m.analystTargetHigh)}
Number of Analysts: ${fmt(m.analystCount)}
Rating Distribution: ${analystBreakdown(m.recTrend)}`);
  }

  if (m.insiders?.length) {
    const ins = m.insiders.slice(0, 5).map(i =>
      `  ${i.date} | ${i.insider} (${i.relation}) | ${i.transaction} | ${i.shares?.toLocaleString() ?? 'N/A'} shares`
    ).join('\n');
    sections.push(`INSIDER TRANSACTIONS (recent 5):\n${ins}`);
  }

  if (m.putCallRatio != null || m.maxPain != null) {
    sections.push(`OPTIONS & SHORT INTEREST:
Put/Call Ratio: ${fmt(m.putCallRatio)}
Max Pain: $${fmt(m.maxPain)}
Short % Float: ${finviz?.shortFloat || fmt(m.shortPctFloat)}
Short Ratio (Days to Cover): ${finviz?.shortRatio || fmt(m.shortRatio)}`);
  }

  if (av?.available) {
    sections.push(`TECHNICAL INDICATORS (Alpha Vantage):
RSI(14): ${av.rsi} — ${av.rsiSignal}
MACD: ${av.macd} | Signal: ${av.macdSignalLine} | Hist: ${av.macdHist} — ${av.macdInterpretation}
Bollinger Bands: Upper $${av.bbUpper} | Mid $${av.bbMiddle} | Lower $${av.bbLower}
SMA(50): $${av.sma50}
SMA(200): $${av.sma200}`);
  }

  if (finviz?.rsi || finviz?.perfYtd) {
    sections.push(`FINVIZ DATA:
RSI: ${finviz.rsi || 'N/A'}
SMA20: ${finviz.sma20 || 'N/A'}  SMA50: ${finviz.sma50 || 'N/A'}  SMA200: ${finviz.sma200 || 'N/A'}
Perf Week: ${finviz.perfWeek || 'N/A'}  Month: ${finviz.perfMonth || 'N/A'}  YTD: ${finviz.perfYtd || 'N/A'}  Year: ${finviz.perfYear || 'N/A'}
Analyst Rating: ${finviz.analystRating || 'N/A'}
ATR(14): ${finviz.atr || 'N/A'}  Volatility: ${finviz.volatility || 'N/A'}
Relative Volume: ${finviz.relVolume || 'N/A'}`);
  }

  if (stocktwits?.available) {
    sections.push(`SOCIAL SENTIMENT (StockTwits):
Signal: ${stocktwits.label}
Bullish: ${stocktwits.bullishPct}%  Bearish: ${stocktwits.bearishPct}%
Messages Analyzed: ${stocktwits.messageCount}`);
  }

  if (newsApi?.available && newsApi.articles?.length) {
    const top = newsApi.articles.slice(0, 8).map(a =>
      `  [${a.sentimentLabel}] ${a.title} (${a.source}, ${a.publishedAt?.slice(0, 10)})`
    ).join('\n');
    sections.push(`NEWS (last 7 days — ${newsApi.articleCount} articles):
Overall Sentiment: ${newsApi.overallSentiment} (score: ${newsApi.sentimentScore})
Positive: ${newsApi.positiveCount}  Neutral: ${newsApi.neutralCount}  Negative: ${newsApi.negativeCount}
Top Articles:
${top}`);
  }

  if (m.earningsDate) {
    sections.push(`UPCOMING CATALYSTS:\nNext Earnings: ${m.earningsDate}`);
  }

  if (m.description) {
    sections.push(`COMPANY DESCRIPTION:\n${m.description.slice(0, 600)}`);
  }

  return sections.join('\n\n');
}

function buildPrompt(agg) {
  const { ticker, isCrypto, market: m } = agg;
  const assetType = isCrypto ? 'Cryptocurrency' : (m.sector ? `${m.sector} Equity` : 'Equity');
  const date = new Date().toISOString().slice(0, 10);
  const data = formatData(agg);
  let prompt = REPORT_PROMPT
    .replace('{ticker}', ticker)
    .replace('{assetType}', assetType)
    .replace('{date}', date)
    .replace('{data}', data);
  if (isCrypto) prompt += CRYPTO_NOTE;
  return prompt;
}

export async function generateReport(agg) {
  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    messages: [{ role: 'user', content: buildPrompt(agg) }],
  });
  return msg.content[0].text;
}

export async function generateReportStream(agg, onSection) {
  const stream = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    messages: [{ role: 'user', content: buildPrompt(agg) }],
    stream: true,
  });

  let buffer = '';
  let currentTitle = null;
  let currentContent = '';
  let fullText = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const text = event.delta.text;
      fullText += text;
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('## ')) {
          if (currentTitle !== null) {
            onSection({ title: currentTitle, content: currentContent.trim() });
          }
          currentTitle = line.slice(3).trim();
          currentContent = '';
        } else {
          currentContent += line + '\n';
        }
      }
    }
  }

  if (buffer) currentContent += buffer;
  if (currentTitle !== null) {
    onSection({ title: currentTitle, content: currentContent.trim() });
  }

  return fullText;
}
