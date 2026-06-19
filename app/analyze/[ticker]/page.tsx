import { getProvider } from "@/lib/providers";
import { computeTechnicals, computeSignals } from "@/lib/data/technicals";
import { writeStockContext } from "@/lib/data/context-writer";
import { QuoteHeader } from "@/components/analyze/QuoteHeader";
import { CandlestickChart } from "@/components/chart/CandlestickChart";
import { TechnicalsPanel } from "@/components/analyze/TechnicalsPanel";
import { FundamentalsPanel } from "@/components/analyze/FundamentalsPanel";
import { AnalystPanel } from "@/components/analyze/AnalystPanel";
import { EarningsPanel } from "@/components/analyze/EarningsPanel";
import { InsiderPanel } from "@/components/analyze/InsiderPanel";
import { NewsPanel } from "@/components/analyze/NewsPanel";
import { ResearchReport } from "@/components/analyze/ResearchReport";
import { ClaudePromptBlock } from "@/components/analyze/ClaudePromptBlock";
import { TickerNotFound } from "@/components/analyze/TickerNotFound";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function AnalyzePage({ params }: Props) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const provider = getProvider();

  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 365 * 86400; // 1 year of daily candles

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

    // Finnhub returns price=0, change=null for unknown tickers
    if (!quote.price || quote.price === 0) {
      return <TickerNotFound ticker={ticker} />;
    }

    // Normalize nulls that Finnhub returns for tickers with no trade data
    quote.change = quote.change ?? 0;
    quote.changePct = quote.changePct ?? 0;

    const tech = computeTechnicals(candles);
    const latestRating = analystRatings[0] ?? { buy: 0, hold: 0, sell: 0, strongBuy: 0, strongSell: 0, period: "" };
    const { bullSignals, bearSignals, overallSignal } = computeSignals(
      quote.price,
      tech,
      fundamentals,
      latestRating.buy + latestRating.strongBuy,
      latestRating.sell + latestRating.strongSell
    );

    // Write context file for Claude Code (fire-and-forget)
    writeStockContext(ticker, { quote, candles, profile, fundamentals, analystRatings, priceTarget, earnings, insider, news, tech, bullSignals, bearSignals, overallSignal }).catch(() => {});

    return (
      <div className="min-h-screen bg-background">
        <AutoRefresh intervalMs={30_000} />

        <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4">
          {/* Quote header */}
          <QuoteHeader quote={quote} profile={profile} overallSignal={overallSignal} ticker={ticker} />

          {/* Chart + technicals */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            <CandlestickChart
              ticker={ticker}
              initialCandles={candles}
              quotePrice={quote.price}
              sma20={tech.sma20}
              sma50={tech.sma50}
              sma200={tech.sma200}
            />
            <TechnicalsPanel tech={tech} price={quote.price} />
          </div>

          {/* Middle row: fundamentals, analyst, earnings */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <FundamentalsPanel fundamentals={fundamentals} quote={quote} />
            <AnalystPanel ratings={analystRatings} priceTarget={priceTarget} currentPrice={quote.price} />
            <EarningsPanel earnings={earnings} />
          </div>

          {/* Insider + News */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
            <InsiderPanel transactions={insider} />
            <NewsPanel news={news} />
          </div>

          {/* Research Report */}
          <ResearchReport
            ticker={ticker}
            quote={quote}
            tech={tech}
            fundamentals={fundamentals}
            bullSignals={bullSignals}
            bearSignals={bearSignals}
            overallSignal={overallSignal}
            priceTarget={priceTarget}
          />

          {/* Claude Code deep analysis prompt */}
          <ClaudePromptBlock ticker={ticker} price={quote.price} signal={overallSignal} />

          <p className="text-xs text-muted-foreground text-center pb-4">
            ⚠️ Not financial advice. All data is for informational purposes only. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    );
  } catch (err) {
    console.error("analyze page error", err);
    return <TickerNotFound ticker={rawTicker?.toUpperCase() ?? "?"} />;
  }
}
