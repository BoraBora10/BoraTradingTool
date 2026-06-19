import type { Quote } from "@/lib/providers/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

interface Props {
  ticker: string;
  label: string;
  quote: Quote;
}

export function IndexCard({ ticker, label, quote }: Props) {
  const isGain = quote.changePct >= 0;
  return (
    <Link href={`/analyze/${ticker}`} className="block bg-panel border border-panel rounded p-3 hover:border-terminal/30 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xs text-muted-foreground font-mono">{ticker}</div>
        </div>
        {isGain ? <TrendingUp className="w-4 h-4 text-gain" /> : <TrendingDown className="w-4 h-4 text-loss" />}
      </div>
      <div className="mt-2">
        <div className="text-xl font-bold font-mono">${quote.price.toFixed(2)}</div>
        <div className={`flex items-center gap-1 text-xs font-semibold mt-0.5 ${isGain ? "text-gain" : "text-loss"}`}>
          <span>{isGain ? "+" : ""}{quote.change.toFixed(2)}</span>
          <span>({isGain ? "+" : ""}{quote.changePct.toFixed(2)}%)</span>
        </div>
      </div>
    </Link>
  );
}
