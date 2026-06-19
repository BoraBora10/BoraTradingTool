import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

// The Guarded Order Tool. The Agent Layer places every trade through here —
// never a raw broker MCP. Enforces the Trade Fence, mode, and Halt in code.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const ticker = typeof body.ticker === "string" ? body.ticker.trim() : "";
  const side = body.side;
  const quantity = Number(body.quantity);

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  if (side !== "buy" && side !== "sell") {
    return NextResponse.json({ error: "side must be 'buy' or 'sell'" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }

  const result = await placeOrder({
    ticker,
    side,
    quantity,
    orderType: body.orderType === "limit" ? "limit" : "market",
    limitPrice: body.limitPrice != null ? Number(body.limitPrice) : null,
    stopLoss: body.stopLoss != null ? Number(body.stopLoss) : null,
    thesis: typeof body.thesis === "string" ? body.thesis : undefined,
  });

  const httpStatus = result.status === "blocked" ? 422 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
