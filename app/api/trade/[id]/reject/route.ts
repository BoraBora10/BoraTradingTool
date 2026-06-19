import { NextResponse } from "next/server";
import { rejectOrder } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

// Reject a Pending Trade (in-app button / push deep-link target).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = rejectOrder(Number(id));
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
  return NextResponse.json({ ok: true, order });
}
