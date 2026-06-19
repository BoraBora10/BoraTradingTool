import type {
  DataProvider,
  Quote,
  Candle,
  NewsItem,
  CompanyProfile,
  Fundamentals,
  AnalystRating,
  PriceTarget,
  EarningsRecord,
  InsiderTransaction,
  SectorPerformance,
  MarketMover,
} from "./types";

// Fallback of last resort when a real source errors. Returns genuinely EMPTY /
// neutral data — never fabricated numbers — so the UI degrades to "unavailable"
// (—, empty panels) instead of showing fake values. This replaces the old
// MockProvider: the product requires a real data source and shows no demo data.
export class EmptyProvider implements DataProvider {
  async getQuote(ticker: string): Promise<Quote> {
    // price 0 + mock flag → callers treat it as "unavailable" (not-found / blocked),
    // never as a real price. Used only if both Yahoo and Finnhub fail for a symbol.
    return {
      ticker: ticker.toUpperCase(),
      price: 0,
      open: 0,
      high: 0,
      low: 0,
      prevClose: 0,
      change: 0,
      changePct: 0,
      volume: 0,
      avgVolume: 0,
      fetchedAt: new Date(),
      mock: true,
    };
  }
  async getCandles(): Promise<Candle[]> {
    return [];
  }
  async getNews(): Promise<NewsItem[]> {
    return [];
  }
  async getCompanyProfile(ticker: string): Promise<CompanyProfile> {
    return { ticker: ticker.toUpperCase(), name: ticker.toUpperCase(), exchange: "", sector: "", industry: "", marketCap: 0 };
  }
  async getFundamentals(): Promise<Fundamentals> {
    return {
      pe: null, eps: null, revenue: null, revenueGrowth: null, grossMargin: null,
      netMargin: null, debtToEquity: null, freeCashFlow: null, bookValue: null,
      dividendYield: null, beta: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
    };
  }
  async getAnalystRatings(): Promise<AnalystRating[]> {
    return [];
  }
  async getPriceTarget(): Promise<PriceTarget> {
    return { high: 0, low: 0, mean: 0, median: 0 };
  }
  async getEarnings(): Promise<EarningsRecord[]> {
    return [];
  }
  async getInsiderTransactions(): Promise<InsiderTransaction[]> {
    return [];
  }
  async getSectorPerformance(): Promise<SectorPerformance[]> {
    return [];
  }
  async getTopMovers(): Promise<{ gainers: MarketMover[]; losers: MarketMover[] }> {
    return { gainers: [], losers: [] };
  }
}
