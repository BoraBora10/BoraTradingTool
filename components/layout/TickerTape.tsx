import { getProvider } from "@/lib/providers";

const TAPE_TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "AMD", "SPY", "QQQ"];

async function getTapeData() {
  const provider = getProvider();
  const quotes = await Promise.allSettled(TAPE_TICKERS.map((t) => provider.getQuote(t)));
  return quotes
    .map((r, i) => {
      if (r.status !== "fulfilled") return null;
      const { ticker: _t, ...rest } = r.value;
      return { ticker: TAPE_TICKERS[i], ...rest };
    })
    .filter(Boolean);
}

function fmt(n: number) {
  return n.toFixed(2);
}

export async function TickerTape() {
  const items = await getTapeData();

  return (
    <div className="bg-[#0d0d0d] border-b border-panel overflow-hidden h-7 flex items-center">
      <div className="flex items-center gap-6 animate-ticker whitespace-nowrap px-4">
        {[...items, ...items].map((item, i) => {
          if (!item) return null;
          const isGain = (item.changePct ?? 0) >= 0;
          return (
            <span key={`${item.ticker}-${i}`} className="flex items-center gap-1.5 text-xs shrink-0">
              <a href={`/analyze/${item.ticker}`} className="text-foreground hover:text-terminal font-semibold">
                {item.ticker}
              </a>
              <span className="text-foreground">{fmt(item.price)}</span>
              <span className={isGain ? "text-gain" : "text-loss"}>
                {isGain ? "▲" : "▼"} {Math.abs(item.changePct ?? 0).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
