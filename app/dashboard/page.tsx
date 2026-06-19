import { getProvider } from "@/lib/providers";
import { getMarketStatus, MARKET_STATUS_STYLES } from "@/lib/data/market-status";
import { writeMarketSnapshot } from "@/lib/data/context-writer";
import { IndexCard } from "@/components/dashboard/IndexCard";
import { SectorHeatmap } from "@/components/dashboard/SectorHeatmap";
import { TopMoversPanel } from "@/components/dashboard/TopMoversPanel";
import { MarketNewsFeed } from "@/components/dashboard/MarketNewsFeed";
import { TopPicksPanel } from "@/components/dashboard/TopPicksPanel";
import { AutoRefresh } from "@/components/auto-refresh";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INDICES = ["SPY", "QQQ", "DIA", "IWM"];
const INDEX_LABELS: Record<string, string> = { SPY: "S&P 500", QQQ: "NASDAQ", DIA: "DOW JONES", IWM: "RUSSELL 2000" };

export default async function DashboardPage() {
  const provider = getProvider();
  const status = getMarketStatus();
  const statusStyle = MARKET_STATUS_STYLES[status];

  const [indexQuotes, sectorPerf, topMovers, news] = await Promise.all([
    Promise.allSettled(INDICES.map((t) => provider.getQuote(t))),
    provider.getSectorPerformance(),
    provider.getTopMovers(),
    provider.getNews(undefined, 15),
  ]);

  const indices = indexQuotes.reduce<Record<string, { price: number; change: number; changePct: number }>>((acc, r, i) => {
    if (r.status === "fulfilled") {
      acc[INDICES[i]] = { price: r.value.price, change: r.value.change, changePct: r.value.changePct };
    }
    return acc;
  }, {});

  // Write market context (fire-and-forget)
  writeMarketSnapshot({
    indices,
    topGainers: topMovers.gainers.map((m) => ({ ticker: m.ticker, changePct: m.changePct })),
    topLosers: topMovers.losers.map((m) => ({ ticker: m.ticker, changePct: m.changePct })),
    sectorPerformance: sectorPerf,
    marketStatus: status,
  }).catch(() => {});

  return (
    <div className="min-h-screen bg-background">
      <AutoRefresh intervalMs={30_000} />
      <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Market Overview</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
            <span className={`text-xs font-semibold ${statusStyle.cls}`}>{statusStyle.label}</span>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </div>
        </div>

        {/* Index cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {INDICES.map((ticker, i) => {
            const q = indexQuotes[i];
            if (q.status !== "fulfilled") return null;
            return (
              <IndexCard
                key={ticker}
                ticker={ticker}
                label={INDEX_LABELS[ticker]}
                quote={q.value}
              />
            );
          })}
        </div>

        {/* Sector + movers */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <SectorHeatmap sectors={sectorPerf} />
          <TopMoversPanel gainers={topMovers.gainers} losers={topMovers.losers} />
        </div>

        {/* Top picks — loads async, doesn't block dashboard */}
        <TopPicksPanel />

        {/* News feed */}
        <MarketNewsFeed news={news} />

        {/* Quick links */}
        <div className="border-t border-panel pt-4 flex flex-wrap gap-3">
          <span className="text-xs text-muted-foreground">Quick analyze:</span>
          {["AAPL", "MSFT", "NVDA", "GOOGL", "META", "TSLA", "AMD"].map((t) => (
            <Link key={t} href={`/analyze/${t}`} className="text-xs text-terminal hover:underline font-mono">
              {t} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
