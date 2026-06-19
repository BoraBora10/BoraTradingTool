import { NextResponse } from "next/server";
import { applyTelegramDecisions } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

// Drain approve/reject replies from Telegram and apply them to Pending Trades.
// The agent's wake/wait loop calls this so a phone tap resolves a proposal
// without the app being open.
export async function POST() {
  const changed = await applyTelegramDecisions();
  return NextResponse.json({ changed });
}
