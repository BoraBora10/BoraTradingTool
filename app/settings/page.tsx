"use client";

import { useState, useEffect } from "react";
import { Key, Terminal, CheckCircle, ExternalLink, Briefcase, Circle } from "lucide-react";
import { AutonomousTradingSettings } from "@/components/settings/AutonomousTradingSettings";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/api-key").then((r) => r.json()).then((d) => setActive(d.active));
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) { setError("API key cannot be empty."); return; }
    setError("");
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setActive(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Settings</h1>

        {/* Finnhub API Key */}
        <section className="bg-panel border border-panel rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-terminal" />
              <h2 className="text-sm font-bold">Finnhub API Key</h2>
            </div>
            {active !== null && (
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${active ? "text-gain" : "text-muted-foreground"}`}>
                <Circle className={`w-2 h-2 fill-current ${active ? "text-gain" : "text-muted-foreground"}`} />
                {active ? "Active — live data" : "Not set — Mock Mode"}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Get a free API key at{" "}
            <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-terminal hover:underline inline-flex items-center gap-0.5">
              finnhub.io <ExternalLink className="w-3 h-3" />
            </a>
            . Free tier includes quotes, candles, fundamentals, earnings, insider transactions, analyst ratings, and news.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter Finnhub API key..."
              className="flex-1 px-3 py-2 bg-accent border border-border rounded text-xs focus:outline-none focus:border-terminal/50 font-mono"
            />
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-terminal text-black text-xs font-bold rounded hover:bg-terminal/90 transition-colors"
            >
              {saved ? "✓ Saved" : "Save"}
            </button>
          </div>
          {error && <p className="text-xs text-loss mt-2">{error}</p>}
          <p className="text-xs text-muted-foreground mt-3">
            Takes effect immediately. Also saved to <code className="bg-accent px-1 rounded">.env.local</code> so it persists across restarts.
          </p>
        </section>

        {/* Claude Code Setup */}
        <section className="bg-panel border border-terminal/20 rounded p-6">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-4 h-4 text-terminal" />
            <h2 className="text-sm font-bold text-terminal">Claude Code Setup</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            MarketPulse uses Claude Code (running in your terminal) as the AI layer. No API key is needed in this app.
          </p>
          <div className="space-y-3 text-xs">
            <Step n={1} label="Install Claude Code">
              <code className="bg-accent px-2 py-1 rounded text-xs block mt-1">npm install -g @anthropic-ai/claude-code</code>
            </Step>
            <Step n={2} label="Open a terminal in this repo directory">
              <code className="bg-accent px-2 py-1 rounded text-xs block mt-1">cd /path/to/marketpulse</code>
            </Step>
            <Step n={3} label="Run Claude Code">
              <code className="bg-accent px-2 py-1 rounded text-xs block mt-1">claude</code>
            </Step>
            <Step n={4} label="Analyze a stock">
              <span className="text-muted-foreground mt-1 block">Navigate to any stock page (e.g. /analyze/NVDA), then paste the generated Claude Code prompt into your terminal session.</span>
            </Step>
          </div>
          <div className="mt-4 pt-4 border-t border-panel">
            <p className="text-xs text-muted-foreground">
              Context files are written to <code className="bg-accent px-1 rounded">context/</code> automatically when you view stock pages. Claude Code reads these directly.
            </p>
          </div>
        </section>

        {/* Autonomous Trading */}
        <AutonomousTradingSettings />

        {/* Robinhood MCP */}
        <section className="bg-panel border border-panel rounded p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-bold">Robinhood Agentic Trading (Optional)</h2>
            <span className="text-xs px-1.5 py-0.5 bg-accent border border-border rounded text-muted-foreground">Requires Agentic account</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Robinhood offers a native MCP server that lets Claude Code place trades, view positions, and manage orders in your brokerage account — with confirmation at every step.
          </p>
          <div className="space-y-4 text-xs">
            <Step n={1} label="Create a Robinhood Agentic account">
              <span className="text-muted-foreground mt-1 block">
                Visit{" "}
                <a href="https://robinhood.com/agentic" target="_blank" rel="noopener noreferrer" className="text-terminal hover:underline inline-flex items-center gap-0.5">
                  robinhood.com/agentic <ExternalLink className="w-3 h-3" />
                </a>{" "}
                and sign up or link your existing Robinhood account. This is a separate agentic-access tier.
              </span>
            </Step>
            <Step n={2} label="Add the MCP server to Claude Code">
              <span className="text-muted-foreground mt-1 block">Run this once in your terminal — it registers the Robinhood MCP over HTTP:</span>
              <code className="bg-accent px-2 py-1.5 rounded text-xs block mt-1.5 select-all">
                claude mcp add robinhood-trading --transport http https://agent.robinhood.com/mcp/trading
              </code>
            </Step>
            <Step n={3} label="Open MCP panel in Claude Code">
              <span className="text-muted-foreground mt-1 block">
                Inside a Claude Code session, type <code className="bg-accent px-1 rounded">/mcp</code> and press Enter.
                You&apos;ll see a list of connected MCP servers.
              </span>
            </Step>
            <Step n={4} label="Select robinhood-trading and authenticate">
              <span className="text-muted-foreground mt-1 block">
                Select <strong className="text-foreground">robinhood-trading</strong> from the list. Claude Code will open a browser window to complete OAuth authentication with your Robinhood account.
              </span>
            </Step>
            <Step n={5} label="Start using agentic trading">
              <span className="text-muted-foreground mt-1 block">
                Once authenticated, Claude Code can view your portfolio, research stocks, and propose orders. Every trade requires your explicit approval — Claude will never execute without confirmation.
              </span>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Example prompts you can use in Claude Code:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>"What&apos;s my current portfolio performance?"</li>
                  <li>"Show my open positions and unrealized P&amp;L."</li>
                  <li>"Research NVDA and tell me if it&apos;s a good entry point."</li>
                  <li>"Buy 5 shares of AAPL if it dips below $180."</li>
                </ul>
              </div>
            </Step>
          </div>
          <div className="mt-4 pt-4 border-t border-panel space-y-2">
            <p className="text-xs text-amber font-semibold">
              ⚠️ Real money is at stake. Always read the full order summary Claude presents before typing &quot;confirm&quot;.
            </p>
            <p className="text-xs text-muted-foreground">
              MarketPulse is not affiliated with Robinhood. This integration uses Robinhood&apos;s official public MCP endpoint. Not financial advice.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-terminal/20 border border-terminal/40 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-terminal text-xs font-bold">{n}</span>
      </div>
      <div className="flex-1">
        <div className="font-semibold">{label}</div>
        {children}
      </div>
    </div>
  );
}
