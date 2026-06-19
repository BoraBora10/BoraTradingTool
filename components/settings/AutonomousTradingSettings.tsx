"use client";

import { useEffect, useState } from "react";
import { Bot, ShieldAlert, ShieldCheck, Send, Save, Plus, Trash2, Power, Plug, PlugZap } from "lucide-react";

type Mode = "off" | "confirm" | "autopilot";

interface Strategy {
  id: number;
  name: string;
  prompt: string;
  riskProfile: string;
  maxPositionPct: number | null;
  isDefault: boolean;
}

interface Config {
  mode: Mode;
  halt: boolean;
  pollMinutes: number;
  maxPositionPct: number;
  watchlistOnly: boolean;
  dailyTradeCap: number;
  activeStrategyId: number | null;
  telegramChatId: string | null;
  telegramTokenSet: boolean;
  telegramConfigured: boolean;
  robinhood: {
    connected: boolean;
    connectedAt: string | null;
    account: string | null;
    ageSeconds: number | null;
    ttlSeconds: number;
  };
}

const MODE_INFO: Record<Mode, { label: string; desc: string }> = {
  off: { label: "Off", desc: "No autonomous trading. The agent only acts when you ask it directly." },
  confirm: {
    label: "Confirm",
    desc: "Agent researches on a schedule and proposes trades — but pushes each one to your phone and waits for your approval before placing.",
  },
  autopilot: {
    label: "Autopilot",
    desc: "Agent places trades on its own within the fence, then notifies you after. No approval step.",
  },
};

export function AutonomousTradingSettings() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [token, setToken] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const [c, s] = await Promise.all([
      fetch("/api/agent/config").then((r) => r.json()),
      fetch("/api/agent/strategies").then((r) => r.json()),
    ]);
    setCfg(c);
    setStrategies(s);
  }
  useEffect(() => {
    load();
    // Poll so the MCP connection status reflects the agent's heartbeats live.
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function patch(body: Record<string, unknown>) {
    setErr("");
    const res = await fetch("/api/agent/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setErr(await res.text()); return; }
    await load();
    flash("Saved");
  }
  function flash(m: string) { setSavedMsg(m); setTimeout(() => setSavedMsg(""), 2500); }

  if (!cfg) return null;
  const active = strategies.find((s) => s.id === cfg.activeStrategyId) ?? strategies[0] ?? null;

  return (
    <section className="bg-panel border border-terminal/20 rounded p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-terminal" />
          <h2 className="text-sm font-bold text-terminal">Autonomous Trading</h2>
        </div>
        {savedMsg && <span className="text-xs text-gain font-semibold">✓ {savedMsg}</span>}
      </div>

      {/* Halt / kill switch */}
      <div className={`flex items-center justify-between rounded border p-3 ${cfg.halt ? "border-loss/50 bg-loss/10" : "border-panel bg-accent/40"}`}>
        <div className="flex items-center gap-2">
          <Power className={`w-4 h-4 ${cfg.halt ? "text-loss" : "text-muted-foreground"}`} />
          <div>
            <div className="text-xs font-bold">{cfg.halt ? "HALTED — all placement frozen" : "Live"}</div>
            <div className="text-xs text-muted-foreground">Kill switch. Blocks every order regardless of mode.</div>
          </div>
        </div>
        <button
          onClick={() => patch({ halt: !cfg.halt })}
          className={`px-3 py-1.5 text-xs font-bold rounded ${cfg.halt ? "bg-gain text-black" : "bg-loss text-white"}`}
        >
          {cfg.halt ? "Resume" : "HALT"}
        </button>
      </div>

      {/* Mode */}
      <div>
        <Label>Trading Mode</Label>
        <div className="flex gap-2 mt-2">
          {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => patch({ mode: m })}
              className={`flex-1 px-3 py-2 text-xs font-bold rounded border transition-colors ${
                cfg.mode === m
                  ? m === "autopilot" ? "bg-amber/20 border-amber text-amber" : "bg-terminal/20 border-terminal text-terminal"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {MODE_INFO[m].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{MODE_INFO[cfg.mode].desc}</p>
        {cfg.mode === "autopilot" && (
          <p className="text-xs text-amber font-semibold mt-1 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Trades place without your confirmation. The fence is your only brake.
          </p>
        )}
      </div>

      {/* Robinhood MCP connection — gates real money */}
      <RobinhoodStatus rh={cfg.robinhood} />

      {/* Wake interval. All trading is real money; placement is gated by Mode +
          Halt + a live Robinhood MCP — there is no separate "arm real money" step. */}
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Wake interval (min)" value={cfg.pollMinutes} min={1} max={1440}
          onCommit={(v) => patch({ pollMinutes: v })} />
        <p className="text-xs text-muted-foreground flex items-end gap-1 pb-2">
          <ShieldAlert className="w-3 h-3 text-amber shrink-0 mb-0.5" />
          All orders are real money — gated by Mode, Halt &amp; a live MCP connection.
        </p>
      </div>

      {/* Fence */}
      <div>
        <Label>Trade Fence (hard limits)</Label>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <NumberField label="Max % per position" value={cfg.maxPositionPct} min={0.1} max={100} step={0.5}
            onCommit={(v) => patch({ maxPositionPct: v })} />
          <NumberField label="Max trades / day" value={cfg.dailyTradeCap} min={0} max={1000}
            onCommit={(v) => patch({ dailyTradeCap: v })} />
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer">
          <input type="checkbox" checked={cfg.watchlistOnly} onChange={(e) => patch({ watchlistOnly: e.target.checked })} />
          <span>Only open positions in tickers on my watchlist</span>
        </label>
      </div>

      {/* Strategy */}
      {active && (
        <StrategyEditor
          strategies={strategies}
          active={active}
          activeId={cfg.activeStrategyId}
          onSelect={(id) => patch({ activeStrategyId: id })}
          onReload={load}
          onFlash={flash}
          onError={setErr}
        />
      )}

      {/* Telegram */}
      <div>
        <Label>Notification Channel — Telegram</Label>
        <div className="flex items-center gap-1.5 text-xs mt-1 mb-2">
          {cfg.telegramConfigured ? <ShieldCheck className="w-3 h-3 text-gain" /> : <ShieldAlert className="w-3 h-3 text-amber" />}
          <span className={cfg.telegramConfigured ? "text-gain" : "text-amber"}>
            {cfg.telegramConfigured ? "Configured — proposals & approvals will reach your phone" : "Not configured — Confirm Mode can't reach you"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Create a bot with @BotFather, then message it once and put your chat ID below. The bot both sends proposals and reads your Approve/Reject taps.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={cfg.telegramTokenSet ? "Bot token (set — leave blank to keep)" : "Bot token"}
            className="px-3 py-2 bg-accent border border-border rounded text-xs font-mono focus:outline-none focus:border-terminal/50"
          />
          <input
            type="text"
            defaultValue={cfg.telegramChatId ?? ""}
            onBlur={(e) => { if (e.target.value !== (cfg.telegramChatId ?? "")) patch({ telegramChatId: e.target.value }); }}
            placeholder="Chat ID"
            className="px-3 py-2 bg-accent border border-border rounded text-xs font-mono focus:outline-none focus:border-terminal/50"
          />
        </div>
        <button
          onClick={() => { if (token.trim()) { patch({ telegramBotToken: token.trim() }); setToken(""); } }}
          className="mt-2 px-3 py-1.5 bg-terminal text-black text-xs font-bold rounded hover:bg-terminal/90 inline-flex items-center gap-1"
        >
          <Send className="w-3 h-3" /> Save token
        </button>
      </div>

      {err && <p className="text-xs text-loss">{err}</p>}

      <div className="pt-3 border-t border-panel text-xs text-muted-foreground space-y-1">
        <p><strong className="text-foreground">How it runs:</strong> tell Claude Code in your terminal to start the trading loop. It wakes every {cfg.pollMinutes} min, refreshes research, and trades through the guarded endpoint — never a raw broker tool.</p>
        <p className="text-amber">Every order is real money. Nothing trades until you pick a mode, the Robinhood MCP is live, and the agent has synced your portfolio.</p>
      </div>
    </section>
  );
}

function StrategyEditor({
  strategies, active, activeId, onSelect, onReload, onFlash, onError,
}: {
  strategies: Strategy[];
  active: Strategy;
  activeId: number | null;
  onSelect: (id: number) => void;
  onReload: () => Promise<void>;
  onFlash: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [prompt, setPrompt] = useState(active.prompt);
  const [risk, setRisk] = useState(active.riskProfile);
  useEffect(() => { setPrompt(active.prompt); setRisk(active.riskProfile); }, [active.id, active.prompt, active.riskProfile]);

  async function save() {
    onError("");
    const res = await fetch(`/api/agent/strategies/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, riskProfile: risk }),
    });
    if (!res.ok) { onError(await res.text()); return; }
    await onReload(); onFlash("Strategy saved");
  }
  async function addNew() {
    const res = await fetch("/api/agent/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Strategy ${strategies.length + 1}`, prompt: active.prompt, riskProfile: "medium" }),
    });
    if (res.ok) { const s = await res.json(); await onReload(); onSelect(s.id); onFlash("Strategy added"); }
  }
  async function del() {
    const res = await fetch(`/api/agent/strategies/${active.id}`, { method: "DELETE" });
    if (!res.ok) { onError(await res.text()); return; }
    await onReload(); onFlash("Strategy deleted");
  }

  return (
    <div>
      <Label>Strategy</Label>
      <div className="flex gap-2 mt-2 items-center">
        <select
          value={activeId ?? active.id}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="flex-1 px-3 py-1.5 bg-accent border border-border rounded text-xs focus:outline-none focus:border-terminal/50"
        >
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (default)" : ""}</option>
          ))}
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)}
          className="px-3 py-1.5 bg-accent border border-border rounded text-xs focus:outline-none focus:border-terminal/50">
          <option value="low">Low risk</option>
          <option value="medium">Medium risk</option>
          <option value="high">High risk</option>
        </select>
        <button onClick={addNew} title="Add strategy" className="px-2 py-1.5 border border-border rounded text-xs hover:bg-accent"><Plus className="w-3.5 h-3.5" /></button>
        {!active.isDefault && (
          <button onClick={del} title="Delete strategy" className="px-2 py-1.5 border border-border rounded text-xs text-loss hover:bg-accent"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={7}
        className="w-full mt-2 px-3 py-2 bg-accent border border-border rounded text-xs font-mono leading-relaxed focus:outline-none focus:border-terminal/50"
      />
      <button onClick={save} className="mt-2 px-3 py-1.5 bg-terminal text-black text-xs font-bold rounded hover:bg-terminal/90 inline-flex items-center gap-1">
        <Save className="w-3 h-3" /> Save strategy
      </button>
    </div>
  );
}

function RobinhoodStatus({ rh }: { rh: Config["robinhood"] }) {
  const connected = rh.connected;
  return (
    <div className={`rounded border p-3 ${connected ? "border-gain/40 bg-gain/5" : "border-amber/40 bg-amber/5"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connected ? <PlugZap className="w-4 h-4 text-gain" /> : <Plug className="w-4 h-4 text-amber" />}
          <div>
            <div className="text-xs font-bold">
              Robinhood MCP — {connected ? "Connected" : "Not connected"}
            </div>
            <div className="text-xs text-muted-foreground">
              {connected
                ? `${rh.account ? rh.account + " · " : ""}heartbeat ${rh.ageSeconds ?? 0}s ago (live within ${Math.floor(rh.ttlSeconds / 60)}m)`
                : "Required before any trading — every order places through the MCP."}
            </div>
          </div>
        </div>
      </div>
      {!connected && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Connect in your Claude Code terminal:</p>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
            <li>
              Register the Robinhood MCP server (one time):
              <CopyCommand cmd="claude mcp add robinhood-trading --transport http https://agent.robinhood.com/mcp/trading" />
              <span className="block text-[11px] opacity-70 mt-0.5">Skip this if the repo ships a <code className="bg-accent px-1 rounded">.mcp.json</code> — it&apos;s already registered.</span>
            </li>
            <li>
              Authenticate: run <code className="bg-accent px-1 rounded">/mcp</code>, select <strong className="text-foreground">robinhood-trading</strong>, finish the browser OAuth.
            </li>
            <li>
              Start trading — tell the agent &ldquo;start the trading loop.&rdquo; It heartbeats here and this badge turns green, unlocking real money.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

function CopyCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-1 mt-1">
      <code className="flex-1 bg-accent px-2 py-1.5 rounded text-[11px] font-mono break-all select-all">{cmd}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="px-2 rounded border border-border text-[11px] hover:bg-accent shrink-0"
        title="Copy"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</span>;
}

function NumberField({ label, value, min, max, step, onCommit }: {
  label: string; value: number; min?: number; max?: number; step?: number; onCommit: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number" value={v} min={min} max={max} step={step ?? 1}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n !== value) onCommit(n); }}
        className="w-full mt-2 px-3 py-1.5 bg-accent border border-border rounded text-xs font-mono focus:outline-none focus:border-terminal/50"
      />
    </div>
  );
}
