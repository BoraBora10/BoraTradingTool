"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Loader2, RefreshCw, Target } from "lucide-react";
import type { PickResult } from "@/app/api/top-picks/route";

const TAG_COLORS: Record<string, string> = {
  "At Support":         "text-gain border-gain/40 bg-green/10",
  "Near Support":       "text-gain border-gain/40 bg-green/10",
  "50-Day MA Bounce":   "text-terminal border-terminal/40 bg-orange/10",
  "MACD ✓":            "text-sky-400 border-sky-400/40 bg-sky-400/10",
};

function tagStyle(tag: string) {
  for (const [key, cls] of Object.entries(TAG_COLORS)) {
    if (tag.startsWith(key)) return cls;
  }
  if (tag.startsWith("RSI")) return "text-amber border-amber/40 bg-amber/10";
  if (tag.includes("Off High") || tag.includes("Dip")) return "text-purple-400 border-purple-400/40 bg-purple-400/10";
  return "text-muted-foreground border-border bg-accent";
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-gain" : score >= 45 ? "bg-terminal" : "bg-amber";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-accent rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold w-6 text-right ${score >= 70 ? "text-gain" : score >= 45 ? "text-terminal" : "text-amber"}`}>
        {score}
      </span>
    </div>
  );
}

export function TopPicksPanel() {
  const [picks, setPicks] = useState<PickResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const url = force ? "/api/top-picks?bust=" + Date.now() : "/api/top-picks";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load picks");
      const data = await res.json();
      setPicks(data);
      setLastUpdated(new Date());
    } catch {
      setError("Could not load picks — check connection");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount, then poll so picks track the day's market without a manual
  // reload. The route caches the scan (10 min), so frequent polls are cheap and
  // just surface fresh results when that cache rolls over. Pause when tab hidden.
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-panel border border-panel rounded overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-terminal" />
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Today&apos;s Top Setups
          </h2>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-accent border border-border rounded">
            5 picks
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && !loading && (
            <span className="text-xs text-muted-foreground/60">
              {lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="p-1 text-muted-foreground hover:text-terminal transition-colors disabled:opacity-40"
            title="Refresh picks"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && picks.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Scanning {/* invisible */}30 stocks…</span>
        </div>
      ) : error ? (
        <div className="py-8 text-center text-xs text-loss">{error}</div>
      ) : (
        <div className="divide-y divide-panel">
          {picks.map((pick, i) => {
            const isUp = pick.changePct >= 0;
            return (
              <div key={pick.ticker} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Rank */}
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 bg-terminal/10 text-terminal text-xs font-bold">
                    {i + 1}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/analyze/${pick.ticker}`}
                        className="text-terminal font-bold text-sm hover:underline font-mono"
                      >
                        {pick.ticker}
                      </Link>
                      <span className="font-mono text-sm font-semibold">${pick.price.toFixed(2)}</span>
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? "text-gain" : "text-loss"}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? "+" : ""}{pick.changePct.toFixed(2)}%
                      </span>
                    </div>

                    {/* Score bar */}
                    <div className="mb-2">
                      <ScoreBar score={pick.score} />
                    </div>

                    {/* Headline */}
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                      {pick.headline}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {pick.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs px-1.5 py-0.5 border rounded ${tagStyle(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {pick.trend === "bullish" && (
                        <span className="text-xs px-1.5 py-0.5 border rounded text-gain border-gain/30 bg-green/10">
                          Uptrend ↑
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Analyze link */}
                  <Link
                    href={`/analyze/${pick.ticker}`}
                    className="shrink-0 text-xs text-terminal hover:underline mt-1"
                  >
                    Analyze →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      {!loading && picks.length > 0 && (
        <div className="px-4 py-2 border-t border-panel text-xs text-muted-foreground/50">
          Ranked by setup score: RSI recovery zone · support proximity · SMA bounce · MACD · dip depth · Not financial advice.
        </div>
      )}
    </div>
  );
}
