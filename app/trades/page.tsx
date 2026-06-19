"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, X, Clock, CircleSlash } from "lucide-react";

interface Order {
  id: number;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  status: string;
  mode: string;
  broker: string;
  thesis: string | null;
  estPrice: number | null;
  estCost: number | null;
  fillPrice: number | null;
  rejectionReason: string | null;
  proposedAt: string;
}

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TradesPage() {
  const [pending, setPending] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    // Drain any Telegram approvals first so the two channels stay in sync.
    await fetch("/api/telegram/poll", { method: "POST" }).catch(() => {});
    const [p, h] = await Promise.all([
      fetch("/api/trade?status=pending").then((r) => r.json()),
      fetch("/api/trade?limit=30").then((r) => r.json()),
    ]);
    setPending(p);
    setHistory(h.filter((o: Order) => o.status !== "pending"));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(id: number, action: "approve" | "reject") {
    setBusy(id);
    await fetch(`/api/trade/${id}/${action}`, { method: "POST" }).catch(() => {});
    await load();
    setBusy(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-terminal" />
          <h1 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Agent Trades</h1>
        </div>

        {/* Pending Trades — the approval queue */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending approval ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-panel border border-panel rounded p-4">
              No trades awaiting approval. In Confirm Mode, proposals appear here and on your phone.
            </p>
          ) : (
            <div className="space-y-2">
              {pending.map((o) => (
                <div key={o.id} className="bg-panel border border-terminal/30 rounded p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold">
                      <span className={o.side === "buy" ? "text-gain" : "text-loss"}>{o.side.toUpperCase()}</span>{" "}
                      {o.quantity} {o.ticker}{" "}
                      <span className="text-muted-foreground font-normal">@ ~{money(o.estPrice ?? 0)} ({money(o.estCost ?? 0)})</span>
                    </div>
                    {o.thesis && <p className="text-xs text-muted-foreground mt-1">{o.thesis}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button disabled={busy === o.id} onClick={() => decide(o.id, "approve")}
                      className="px-3 py-1.5 bg-gain text-black text-xs font-bold rounded hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button disabled={busy === o.id} onClick={() => decide(o.id, "reject")}
                      className="px-3 py-1.5 bg-loss text-white text-xs font-bold rounded hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-50">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Order log</h2>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-panel border border-panel rounded p-4">No orders yet.</p>
          ) : (
            <div className="bg-panel border border-panel rounded divide-y divide-panel">
              {history.map((o) => (
                <div key={o.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon status={o.status} />
                    <span className="font-bold">{o.side.toUpperCase()} {o.quantity} {o.ticker}</span>
                    <span className="text-muted-foreground truncate">
                      {o.status === "filled" ? `@ ${money(o.fillPrice ?? 0)}` : o.status === "blocked" || o.status === "rejected" ? (o.rejectionReason ?? o.status) : o.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                    <span className="uppercase">{o.broker}</span>
                    <span>{new Date(o.proposedAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "filled") return <Check className="w-3.5 h-3.5 text-gain shrink-0" />;
  if (status === "rejected") return <X className="w-3.5 h-3.5 text-loss shrink-0" />;
  if (status === "blocked") return <CircleSlash className="w-3.5 h-3.5 text-amber shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}
