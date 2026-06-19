"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Plug, PlugZap, RefreshCw } from "lucide-react";

interface RealPosition {
  ticker: string;
  shares: number;
  avgCost: number;
  price?: number | null;
  marketValue?: number | null;
}

interface Snapshot {
  account: string;
  accountNumber: string | null;
  totalValue: number | null;
  cash: number | null;
  buyingPower: number | null;
  positions: RealPosition[];
  fetchedAt: string;
}

interface PortfolioResponse {
  robinhood: {
    connected: boolean;
    account: string | null;
    ageSeconds: number | null;
    ttlSeconds: number;
  };
  snapshot: Snapshot | null;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}
function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  async function load() {
    setChecking(true);
    try {
      const r = await fetch("/api/agent/robinhood/portfolio", { cache: "no-store" });
      setData(await r.json());
      setCheckedAt(new Date());
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }
  // One read on mount; after that the user re-checks on demand (no polling).
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Portfolio</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live Robinhood data — real money via the MCP
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={load}
              disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs font-bold text-muted-foreground hover:border-terminal/30 hover:text-terminal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking…" : "Check connection"}
            </button>
            {checkedAt && !checking && (
              <span className="text-[11px] text-muted-foreground">
                Checked {checkedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {loading && !data ? (
          <Centered>
            <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
            <p className="text-xs text-muted-foreground mt-3">Loading…</p>
          </Centered>
        ) : !data?.robinhood.connected ? (
          <NotConnected />
        ) : !data.snapshot ? (
          <AwaitingSync account={data.robinhood.account} />
        ) : (
          <RealPortfolio snap={data.snapshot} />
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-panel border border-panel rounded p-12 flex flex-col items-center justify-center text-center min-h-[50vh]">
      {children}
    </div>
  );
}

function NotConnected() {
  return (
    <Centered>
      <Plug className="w-8 h-8 text-amber" />
      <h2 className="text-sm font-bold mt-4">Robinhood MCP not connected</h2>
      <p className="text-xs text-muted-foreground mt-2 max-w-md">
        Connect the Robinhood MCP to Claude Code to see your portfolio. Real-money
        trading and live holdings are unavailable until then.
      </p>
      <Link
        href="/settings"
        className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-terminal text-black text-xs font-bold rounded hover:bg-terminal/90"
      >
        <PlugZap className="w-3.5 h-3.5" /> Connection instructions
      </Link>
    </Centered>
  );
}

function AwaitingSync({ account }: { account: string | null }) {
  return (
    <Centered>
      <PlugZap className="w-8 h-8 text-gain" />
      <h2 className="text-sm font-bold mt-4">
        Connected{account ? ` · ${account}` : ""}
      </h2>
      <p className="text-xs text-muted-foreground mt-2 max-w-md">
        The MCP is live but no portfolio has been synced yet. Ask Claude Code to
        sync your portfolio and it will appear here.
      </p>
    </Centered>
  );
}

function RealPortfolio({ snap }: { snap: Snapshot }) {
  const positions = snap.positions.map((p) => {
    const price = p.price ?? null;
    const marketValue = p.marketValue ?? (price != null ? price * p.shares : p.avgCost * p.shares);
    const costBasis = p.avgCost * p.shares;
    const unrealizedPnl = marketValue - costBasis;
    const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
    return { ...p, price, marketValue, costBasis, unrealizedPnl, unrealizedPct };
  });

  const positionsValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const costBasisTotal = positions.reduce((s, p) => s + p.costBasis, 0);
  const totalPnl = positionsValue - costBasisTotal;
  const totalPnlPct = costBasisTotal > 0 ? (totalPnl / costBasisTotal) * 100 : 0;
  const totalValue = snap.totalValue ?? positionsValue + (snap.cash ?? 0);
  const ageSec = Math.max(0, Math.floor((Date.now() - new Date(snap.fetchedAt).getTime()) / 1000));

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-gain">
        <PlugZap className="w-3.5 h-3.5" />
        <span className="font-semibold">{snap.account}</span>
        {snap.accountNumber && <span className="text-muted-foreground font-mono">{snap.accountNumber}</span>}
        <span className="text-muted-foreground">· synced {ageSec < 90 ? "just now" : `${Math.floor(ageSec / 60)}m ago`}</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Account Value" value={fmt(totalValue)} />
        <Stat label="Cash" value={snap.cash != null ? fmt(snap.cash) : "—"} />
        <Stat label="Buying Power" value={snap.buyingPower != null ? fmt(snap.buyingPower) : "—"} />
        <div className="bg-panel border border-panel rounded p-3">
          <div className="text-xs text-muted-foreground mb-1">Unrealized P&amp;L</div>
          <div className={`text-lg font-bold font-mono ${totalPnl >= 0 ? "text-gain" : "text-loss"}`}>
            {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)}
          </div>
          <div className={`text-xs font-semibold ${totalPnl >= 0 ? "text-gain" : "text-loss"}`}>
            {fmtPct(totalPnlPct)}
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-panel border border-panel rounded overflow-hidden">
        <div className="px-4 py-2.5 border-b border-panel">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Positions ({positions.length})
          </h2>
        </div>
        {positions.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            No open positions. {snap.cash != null ? `${fmt(snap.cash)} in cash.` : ""}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-panel text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Ticker</th>
                  <th className="text-right px-4 py-2 font-medium">Shares</th>
                  <th className="text-right px-4 py-2 font-medium">Avg Cost</th>
                  <th className="text-right px-4 py-2 font-medium">Price</th>
                  <th className="text-right px-4 py-2 font-medium">Mkt Value</th>
                  <th className="text-right px-4 py-2 font-medium">Unrl. P&amp;L</th>
                  <th className="text-right px-4 py-2 font-medium">Return</th>
                  <th className="text-right px-4 py-2 font-medium">Alloc %</th>
                </tr>
              </thead>
              <tbody>
                {positions
                  .sort((a, b) => b.marketValue - a.marketValue)
                  .map((p) => (
                    <tr key={p.ticker} className="border-b border-panel/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/analyze/${p.ticker}`} className="text-terminal font-bold hover:underline font-mono">
                          {p.ticker}
                        </Link>
                      </td>
                      <td className="text-right px-4 py-2.5 font-mono">{p.shares}</td>
                      <td className="text-right px-4 py-2.5 font-mono">{fmt(p.avgCost)}</td>
                      <td className="text-right px-4 py-2.5 font-mono">{p.price != null ? fmt(p.price) : "—"}</td>
                      <td className="text-right px-4 py-2.5 font-mono font-semibold">{fmt(p.marketValue)}</td>
                      <td className={`text-right px-4 py-2.5 font-mono font-semibold ${p.unrealizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                        {p.unrealizedPnl >= 0 ? "+" : ""}{fmt(p.unrealizedPnl)}
                      </td>
                      <td className={`text-right px-4 py-2.5 font-semibold ${p.unrealizedPct >= 0 ? "text-gain" : "text-loss"}`}>
                        <div className="flex items-center justify-end gap-1">
                          {p.unrealizedPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fmtPct(p.unrealizedPct)}
                        </div>
                      </td>
                      <td className="text-right px-4 py-2.5 text-muted-foreground">
                        {positionsValue > 0 ? ((p.marketValue / positionsValue) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel border border-panel rounded p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold font-mono">{value}</div>
    </div>
  );
}
