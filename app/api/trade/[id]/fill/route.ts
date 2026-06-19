import { NextResponse } from "next/server";
import { reportFill } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

// The agent reports a real-money fill from the Robinhood MCP for an order the
// app previously authorized. Records the real fill price + pushes the receipt.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const fillPrice = Number(body.fillPrice);
  if (!Number.isFinite(fillPrice) || fillPrice <= 0) {
    return NextResponse.json({ error: "fillPrice must be a positive number" }, { status: 400 });
  }
  const result = await reportFill(Number(id), fillPrice);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: `order is ${result.order?.status}, not awaiting a fill report`, order: result.order },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, order: result.order });
}
