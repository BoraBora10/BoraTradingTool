import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { getYahooMostActives } from "@/lib/providers/yahoo";
import { getDb, schema } from "@/lib/db";
import { getRealPortfolio } from "@/lib/trading/robinhood-portfolio";
import { computeTechnicals } from "@/lib/data/technicals";
import type { Candle } from "@/lib/providers/types";

// In-memory cache so the scan doesn't re-run on every dashboard load / poll.
let _cache: { picks: PickResult[]; at: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

// Build the scan universe dynamically each day: today's most actively traded
// liquid US stocks (market-wide, recomputed daily) plus the user's watchlist and
// current holdings. No hardcoded list — the candidates change with the market.
async function buildScanUniverse(): Promise<string[]> {
  const db = getDb();
  const watchlist = db.select().from(schema.userWatchlist).all().map((r) => r.ticker);
  const held = (getRealPortfolio()?.positions ?? []).map((p) => p.ticker);
  let actives: string[] = [];
  try {
    actives = await getYahooMostActives(40);
  } catch {
    // screener unavailable — fall back to just watchlist + holdings
  }
  return Array.from(new Set([...actives, ...watchlist, ...held].map((t) => t.toUpperCase())));
}

export interface PickResult {
  ticker: string;
  price: number;
  changePct: number;
  score: number;
  tags: string[];
  headline: string;
  rsi: number | null;
  sma50: number | null;
  sma200: number | null;
  support: number | null;
  pullbackPct: number | null;
  trend: "bullish" | "bearish" | "neutral";
}

// Swing-low support detection — much better than simple min
function findNearestSupport(candles: Candle[], currentPrice: number): number | null {
  if (candles.length < 15) return null;
  const window = candles.slice(-90);
  const lows = window.map((c) => c.low);
  const swingLows: number[] = [];

  for (let i = 2; i < lows.length - 2; i++) {
    if (
      lows[i] <= lows[i - 1] && lows[i] <= lows[i - 2] &&
      lows[i] <= lows[i + 1] && lows[i] <= lows[i + 2]
    ) {
      swingLows.push(lows[i]);
    }
  }

  if (swingLows.length === 0) {
    // Fall back to 20-day low
    return +Math.min(...lows.slice(-20)).toFixed(2);
  }

  // Cluster nearby levels (within 1.5%)
  const clusters: number[][] = [];
  for (const low of swingLows) {
    const match = clusters.find((c) => Math.abs(c[0] - low) / c[0] < 0.015);
    if (match) match.push(low);
    else clusters.push([low]);
  }

  // Most-tested support levels, filtered to below/near current price
  const supports = clusters
    .sort((a, b) => b.length - a.length)
    .map((c) => c.reduce((a, b) => a + b) / c.length)
    .filter((s) => s < currentPrice * 1.04);

  return supports.length ? +supports[0].toFixed(2) : null;
}

function scoreSetup(
  ticker: string,
  price: number,
  changePct: number,
  candles: Candle[]
): PickResult {
  const tech = computeTechnicals(candles);
  const { rsi, sma50, sma200, macdHist, trend } = tech;

  let score = 0;
  const tags: string[] = [];

  // ── 1. RSI recovery zone (0–30 pts) ──────────────────────────────────
  // Sweet spot: oversold but not in free-fall. RSI 28-45 = stock is beaten
  // down but finding footing. Below 28 = may keep falling.
  if (rsi !== null) {
    if (rsi >= 28 && rsi <= 45)       { score += 30; tags.push(`RSI ${rsi} Recovery`); }
    else if (rsi > 45 && rsi <= 52)   { score += 14; }
    else if (rsi >= 20 && rsi < 28)   { score += 12; tags.push(`RSI ${rsi} Oversold`); }
    else if (rsi < 20)                 { score += 4; }
    else if (rsi <= 60)                { score += 6; }
    // rsi > 60: overbought, no bonus
  }

  // ── 2. Support proximity (0–30 pts) ───────────────────────────────────
  const support = findNearestSupport(candles, price);
  let distFromSupport: number | null = null;
  if (support) {
    distFromSupport = +((price - support) / support * 100).toFixed(1);
    if (distFromSupport >= 0 && distFromSupport <= 1.5)  { score += 30; tags.push("At Support"); }
    else if (distFromSupport <= 3)                        { score += 22; tags.push("Near Support"); }
    else if (distFromSupport <= 5)                        { score += 14; tags.push("Near Support"); }
    else if (distFromSupport <= 8)                        { score += 6; }
  }

  // ── 3. Key moving average bounce (0–20 pts) ───────────────────────────
  if (sma50) {
    const distSma50 = Math.abs(price - sma50) / sma50 * 100;
    if (distSma50 <= 2 && price > sma50 * 0.98) {
      score += 12;
      if (!tags.some((t) => t.includes("Support"))) tags.push("50-Day MA Bounce");
    } else if (distSma50 <= 4) {
      score += 6;
    }
  }
  if (sma200 && price > sma200) {
    score += 8; // long-term uptrend intact — key backdrop condition
  }

  // ── 4. MACD posture (0–15 pts) ────────────────────────────────────────
  if (macdHist !== null) {
    if (macdHist > 0)                     { score += 15; tags.push("MACD ✓"); }
    else if (macdHist > -0.3 * price / 100) { score += 7; } // approaching positive, relative to price
  }

  // ── 5. Healthy dip from 90-day high (0–15 pts) ────────────────────────
  // The classic "buy the dip" setup: pulled back meaningfully but trend up
  const recentCloses = candles.slice(-90).map((c) => c.close);
  const ninetyDayHigh = recentCloses.length ? Math.max(...recentCloses) : price;
  const pullbackPct = +((ninetyDayHigh - price) / ninetyDayHigh * 100).toFixed(1);

  if (pullbackPct >= 5 && pullbackPct <= 25) {
    score += 15;
    if (!tags.some((t) => t.includes("Support") || t.includes("MA"))) {
      tags.push(`${pullbackPct.toFixed(0)}% Off High`);
    }
  } else if (pullbackPct >= 2 && pullbackPct < 5) {
    score += 6;
  }
  // >30% dip: trend may be broken, no bonus

  // ── Deductions ────────────────────────────────────────────────────────
  if (trend === "bearish") score -= 20; // all SMAs pointing down
  if (rsi !== null && rsi > 70) score -= 15; // already overbought

  // ── Headline generation ───────────────────────────────────────────────
  const parts: string[] = [];

  if (support && distFromSupport !== null && distFromSupport <= 3) {
    parts.push(`testing support at $${support.toFixed(2)}`);
  } else if (sma50 && Math.abs(price - sma50) / sma50 <= 0.03) {
    parts.push(`bouncing off 50-day MA ($${sma50.toFixed(2)})`);
  } else if (pullbackPct >= 5) {
    parts.push(`${pullbackPct.toFixed(0)}% dip from 90-day high`);
  }

  if (rsi !== null && rsi <= 45) {
    parts.push(`RSI ${rsi} recovering`);
  }
  if (macdHist !== null && macdHist > 0) {
    parts.push(`MACD momentum positive`);
  } else if (sma200 && price > sma200 && parts.length < 2) {
    parts.push(`above 200-day MA`);
  }
  if (parts.length === 0) parts.push("setup forming — check analyze page for entry levels");

  const headline = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) +
    (parts[1] ? ` · ${parts[1]}` : "") +
    (parts[2] ? ` · ${parts[2]}` : "");

  return {
    ticker,
    price: +price.toFixed(2),
    changePct: +changePct.toFixed(2),
    score: Math.max(0, Math.min(100, score)),
    tags: [...new Set(tags)].slice(0, 3),
    headline,
    rsi: tech.rsi,
    sma50: tech.sma50,
    sma200: tech.sma200,
    support,
    pullbackPct,
    trend,
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.has("bust");

  // Serve cache if fresh (unless force-refresh)
  if (!force && _cache && Date.now() - _cache.at < CACHE_TTL) {
    return NextResponse.json(_cache.picks);
  }

  const provider = getProvider();
  const universe = await buildScanUniverse();
  const to = Math.floor(Date.now() / 1000);
  const from = to - 400 * 24 * 3600; // ~400 days for SMA200

  const results = await Promise.allSettled(
    universe.map(async (ticker) => {
      const [quote, candles] = await Promise.all([
        provider.getQuote(ticker),
        provider.getCandles(ticker, "D", from, to),
      ]);
      if (!quote || quote.price === 0 || candles.length < 30) return null;
      return scoreSetup(ticker, quote.price, quote.changePct, candles);
    })
  );

  const picks: PickResult[] = results
    .filter((r): r is PromiseFulfilledResult<PickResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is PickResult => v !== null && v.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  _cache = { picks, at: Date.now() };
  return NextResponse.json(picks);
}
