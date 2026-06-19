"use client";

import { useState } from "react";
import { TrendingUp, KeyRound, ExternalLink, Loader2 } from "lucide-react";

// Shown when no Finnhub API key is configured. The product requires a real data
// source — there is no mock/demo mode — so this blocks the app until a key is set.
export function SetupGate() {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmed }),
      });
      if (!res.ok) {
        setErr((await res.json().catch(() => ({})))?.error ?? "Failed to save key");
        return;
      }
      // Key is live in the running process now — reload to enter the app.
      window.location.reload();
    } catch {
      setErr("Network error saving key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-panel border border-terminal/20 rounded-lg p-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-terminal" />
          <span className="text-terminal font-bold text-lg tracking-wider">MARKETPULSE</span>
        </div>

        <h1 className="text-sm font-bold mb-2 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-terminal" /> Connect a data source to begin
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
          MarketPulse uses real market data — there is no demo mode. Enter a free
          Finnhub API key to unlock fundamentals, analyst ratings, earnings, insider
          activity, and news. (Prices and charts come from Yahoo.)
        </p>

        <a
          href="https://finnhub.io/register"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-terminal hover:underline inline-flex items-center gap-1 mb-3"
        >
          Get a free key at finnhub.io <ExternalLink className="w-3 h-3" />
        </a>

        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="Paste your Finnhub API key…"
          className="w-full px-3 py-2 bg-accent border border-border rounded text-xs font-mono focus:outline-none focus:border-terminal/50"
          autoFocus
        />

        {err && <p className="text-xs text-loss mt-2">{err}</p>}

        <button
          onClick={save}
          disabled={saving || !key.trim()}
          className="w-full mt-4 px-3 py-2 bg-terminal text-black text-xs font-bold rounded hover:bg-terminal/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
        >
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : "Save key & continue"}
        </button>

        <p className="text-[11px] text-muted-foreground mt-4">
          Stored locally in <code className="bg-accent px-1 rounded">.env.local</code>. Free tier
          covers everything the app needs.
        </p>
      </div>
    </div>
  );
}
