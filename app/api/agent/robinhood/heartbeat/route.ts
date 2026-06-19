import { NextResponse } from "next/server";
import { getAgentConfig } from "@/lib/trading/config";
import { recordHeartbeat, clearHeartbeat, getRobinhoodStatus } from "@/lib/trading/robinhood";

export const dynamic = "force-dynamic";

// The agent calls POST after verifying the Robinhood MCP is live (e.g. it just
// ran getAccount()). This is what unlocks the real-money controls. Optional
// { account } labels the connection in the UI.
export async function POST(req: Request) {
  let account: string | null | undefined;
  try {
    const body = await req.json();
    if (typeof body?.account === "string") account = body.account;
  } catch {
    // no body — still a valid heartbeat
  }
  const cfg = recordHeartbeat(account);
  return NextResponse.json({ ok: true, robinhood: getRobinhoodStatus(cfg) });
}

export async function GET() {
  return NextResponse.json(getRobinhoodStatus(getAgentConfig()));
}

// Agent disconnecting, or user forcing the gate shut.
export async function DELETE() {
  const cfg = clearHeartbeat();
  return NextResponse.json({ ok: true, robinhood: getRobinhoodStatus(cfg) });
}
