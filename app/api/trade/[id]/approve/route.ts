import { NextResponse } from "next/server";
import { approveOrder } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

// Approve a Pending Trade (in-app button / push deep-link target).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await approveOrder(Number(id));
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
  // Approval authorizes the order; the agent then places it via the Robinhood MCP.
  if (order.status !== "authorized") {
    return NextResponse.json(
      { error: `order is ${order.status}, not pending`, order },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, order });
}
