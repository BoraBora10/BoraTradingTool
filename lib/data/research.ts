import { getProvider } from "@/lib/providers";
import { computeTechnicals, computeSignals } from "@/lib/data/technicals";
import { writeStockContext } from "@/lib/data/context-writer";

export interface ResearchSummary {
  ticker: string;
  price: number;
  overallSignal: "buy" | "hold" | "sell";
  bullCount: number;
  bearCount: number;
}

/**
 * Fetch the full data set for a ticker, compute technicals/signals, and write
 * its Context File. Shared by the Stock Analyzer page and the Scheduled Research
 * System's refresh endpoint so the agent always reads consistent context.
 * Returns a one-line summary, or null if the ticker has no trade data.
 */
export async function refreshStockContext(rawTicker: string): Promise<ResearchSummary | null> {
  const ticker = rawTicker.toUpperCase();
  const provider = getProvider();
  const to = Math.floor(Date.now() / 1000);
  const from = to - 365 * 86400;

  const [quote, candles, profile, fundamentals, analystRatings, priceTarget, earnings, insider, news] =
    await Promise.all([
      provider.getQuote(ticker),
      provider.getCandles(ticker, "D", from, to),
      provider.getCompanyProfile(ticker),
      provider.getFundamentals(ticker),
      provider.getAnalystRatings(ticker),
      provider.getPriceTarget(ticker),
      provider.getEarnings(ticker),
      provider.getInsiderTransactions(ticker),
      provider.getNews(ticker, 10),
    ]);

  if (!quote.price || quote.price === 0) return null;
  quote.change = quote.change ?? 0;
  quote.changePct = quote.changePct ?? 0;

  const tech = computeTechnicals(candles);
  const latestRating =
    analystRatings[0] ?? { buy: 0, hold: 0, sell: 0, strongBuy: 0, strongSell: 0, period: "" };
  const { bullSignals, bearSignals, overallSignal } = computeSignals(
    quote.price,
    tech,
    fundamentals,
    latestRating.buy + latestRating.strongBuy,
    latestRating.sell + latestRating.strongSell
  );

  await writeStockContext(ticker, {
    quote,
    candles,
    profile,
    fundamentals,
    analystRatings,
    priceTarget,
    earnings,
    insider,
    news,
    tech,
    bullSignals,
    bearSignals,
    overallSignal,
  });

  return {
    ticker,
    price: quote.price,
    overallSignal,
    bullCount: bullSignals.length,
    bearCount: bearSignals.length,
  };
}
