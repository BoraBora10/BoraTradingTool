import type { MarketMover } from "@/lib/providers/types";
import Link from "next/link";

interface Props {
  gainers: MarketMover[];
  losers: MarketMover[];
}

function MoverRow({ mover, isGain }: { mover: MarketMover; isGain: boolean }) {
  return (
    <Link href={`/analyze/${mover.ticker}`} className="flex items-center justify-between py-1.5 hover:bg-accent px-1 rounded transition-colors">
      <div>
        <span className="text-xs font-semibold text-terminal">{mover.ticker}</span>
        <span className="text-xs text-muted-foreground ml-1.5 truncate max-w-[100px] inline-block">{mover.name}</span>
      </div>
      <div className="text-right">
        <div className="text-xs font-mono">${mover.price.toFixed(2)}</div>
        <div className={`text-xs font-semibold ${isGain ? "text-gain" : "text-loss"}`}>
          {isGain ? "+" : ""}{mover.changePct.toFixed(2)}%
        </div>
      </div>
    </Link>
  );
}

export function TopMoversPanel({ gainers, losers }: Props) {
  return (
    <div className="bg-panel border border-panel rounded p-4">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Top Movers</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold text-gain mb-2">▲ Gainers</h3>
          {gainers.map((m) => <MoverRow key={m.ticker} mover={m} isGain />)}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-loss mb-2">▼ Losers</h3>
          {losers.map((m) => <MoverRow key={m.ticker} mover={m} isGain={false} />)}
        </div>
      </div>
    </div>
  );
}
