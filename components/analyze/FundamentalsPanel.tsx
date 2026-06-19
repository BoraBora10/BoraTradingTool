import type { Fundamentals, Quote } from "@/lib/providers/types";

interface Props {
  fundamentals: Fundamentals;
  quote: Quote;
}

function fmt(val: number | null, prefix = "", suffix = "", decimals = 2) {
  if (val === null || val === undefined) return "—";
  return `${prefix}${val.toFixed(decimals)}${suffix}`;
}

function fmtLarge(val: number | null) {
  if (val === null) return "—";
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toFixed(2)}`;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-panel last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-mono font-semibold ${highlight ? "text-terminal" : ""}`}>{value}</span>
    </div>
  );
}

export function FundamentalsPanel({ fundamentals: f, quote }: Props) {
  return (
    <div className="bg-panel border border-panel rounded p-4">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Fundamentals</h2>
      <Row label="P/E Ratio" value={fmt(f.pe, "", "x")} />
      <Row label="EPS (TTM)" value={fmt(f.eps, "$")} />
      <Row label="Revenue (TTM)" value={fmtLarge(f.revenue)} />
      <Row label="Revenue Growth" value={f.revenueGrowth !== null ? `${(f.revenueGrowth * 100).toFixed(1)}%` : "—"} highlight={(f.revenueGrowth ?? 0) > 0.15} />
      <Row label="Gross Margin" value={f.grossMargin !== null ? `${(f.grossMargin * 100).toFixed(1)}%` : "—"} />
      <Row label="Net Margin" value={f.netMargin !== null ? `${(f.netMargin * 100).toFixed(1)}%` : "—"} />
      <Row label="Debt/Equity" value={fmt(f.debtToEquity)} />
      <Row label="Free Cash Flow" value={fmtLarge(f.freeCashFlow)} />
      <Row label="Book Value/Share" value={fmt(f.bookValue, "$")} />
      <Row label="Dividend Yield" value={f.dividendYield !== null ? `${(f.dividendYield * 100).toFixed(2)}%` : "N/A"} />
      <Row label="Beta" value={fmt(f.beta)} />
      <Row label="52W High" value={fmt(f.fiftyTwoWeekHigh, "$")} />
      <Row label="52W Low" value={fmt(f.fiftyTwoWeekLow, "$")} />
    </div>
  );
}
