import { NextResponse } from "next/server";
import { getAgentConfig } from "@/lib/trading/config";
import { getRobinhoodStatus } from "@/lib/trading/robinhood";
import {
  getRealPortfolio,
  saveRealPortfolio,
  clearRealPortfolio,
  type RealPosition,
} from "@/lib/trading/robinhood-portfolio";

export const dynamic = "force-dynamic";

// The UI polls this: connection liveness + the latest pushed snapshot. The page
// shows "real trading not available" until robinhood.connected is true, then
// renders the snapshot once the agent has pushed one.
export async function GET() {
  const cfg = getAgentConfig();
  return NextResponse.json({
    robinhood: getRobinhoodStatus(cfg),
    snapshot: getRealPortfolio(),
  });
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// The agent pushes the Agentic account's portfolio here after reading it from
// the Robinhood MCP. Only one snapshot is kept (the active agentic account).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const account = body.account;
  if (typeof account !== "string" || !account.trim()) {
    return NextResponse.json(
      { error: "account is required (e.g. \"Agentic\")" },
      { status: 400 }
    );
  }

  let positions: RealPosition[] = [];
  if (Array.isArray(body.positions)) {
    for (const raw of body.positions) {
      if (!raw || typeof raw !== "object") continue;
      const p = raw as Record<string, unknown>;
      if (typeof p.ticker !== "string") continue;
      const shares = num(p.shares);
      const avgCost = num(p.avgCost);
      if (shares == null || avgCost == null) continue;
      positions.push({
        ticker: p.ticker.toUpperCase(),
        shares,
        avgCost,
        price: num(p.price),
        marketValue: num(p.marketValue),
      });
    }
  }

  const snapshot = saveRealPortfolio({
    account: account.trim(),
    accountNumber:
      typeof body.accountNumber === "string" ? body.accountNumber : null,
    totalValue: num(body.totalValue),
    cash: num(body.cash),
    buyingPower: num(body.buyingPower),
    positions,
  });

  return NextResponse.json({ ok: true, snapshot });
}

export async function DELETE() {
  clearRealPortfolio();
  return NextResponse.json({ ok: true });
}
