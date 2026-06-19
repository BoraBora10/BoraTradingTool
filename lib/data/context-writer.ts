import fs from "fs/promises";
import path from "path";
import type { Quote, CompanyProfile, Fundamentals, AnalystRating, PriceTarget, EarningsRecord, InsiderTransaction, NewsItem, Candle } from "@/lib/providers/types";
import type { TechnicalIndicators, Signal } from "@/lib/data/technicals";

const CONTEXT_DIR = path.join(process.cwd(), "context");

async function ensureContextDir() {
  await fs.mkdir(CONTEXT_DIR, { recursive: true });
}

export async function writeStockContext(
  ticker: string,
  data: {
    quote: Quote;
    candles: Candle[];
    profile: CompanyProfile;
    fundamentals: Fundamentals;
    analystRatings: AnalystRating[];
    priceTarget: PriceTarget;
    earnings: EarningsRecord[];
    insider: InsiderTransaction[];
    news: NewsItem[];
    tech: TechnicalIndicators;
    bullSignals: Signal[];
    bearSignals: Signal[];
    overallSignal: "buy" | "hold" | "sell";
  }
) {
  await ensureContextDir();
  const snapshot = {
    ticker,
    generatedAt: new Date().toISOString(),
    quote: data.quote,
    profile: data.profile,
    fundamentals: data.fundamentals,
    technicals: data.tech,
    analystConsensus: {
      latest: data.analystRatings[0] ?? null,
      history: data.analystRatings.slice(0, 4),
    },
    priceTarget: data.priceTarget,
    earnings: data.earnings.slice(0, 8),
    insiderActivity: {
      transactions: data.insider.slice(0, 10),
      netChange: data.insider.reduce((sum, t) => sum + t.change, 0),
    },
    recentNews: data.news.slice(0, 5).map((n) => ({
      headline: n.headline,
      source: n.source,
      sentiment: n.sentiment,
      publishedAt: n.publishedAt,
    })),
    signals: {
      bull: data.bullSignals,
      bear: data.bearSignals,
      overall: data.overallSignal,
    },
  };
  await fs.writeFile(
    path.join(CONTEXT_DIR, `stock-${ticker}.json`),
    JSON.stringify(snapshot, null, 2)
  );
}

export async function writeMarketSnapshot(data: {
  indices: Record<string, { price: number; change: number; changePct: number }>;
  topGainers: Array<{ ticker: string; changePct: number }>;
  topLosers: Array<{ ticker: string; changePct: number }>;
  sectorPerformance: Array<{ sector: string; changePct: number }>;
  marketStatus: string;
}) {
  await ensureContextDir();
  const snapshot = {
    generatedAt: new Date().toISOString(),
    marketStatus: data.marketStatus,
    indices: data.indices,
    sectorPerformance: data.sectorPerformance,
    topGainers: data.topGainers,
    topLosers: data.topLosers,
  };
  await fs.writeFile(
    path.join(CONTEXT_DIR, "market-snapshot.json"),
    JSON.stringify(snapshot, null, 2)
  );
}
