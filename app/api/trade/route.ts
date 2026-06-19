import { NextResponse } from "next/server";
import { listOrders } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

// Order log + Pending Trade queue. ?status=pending for the approval screen.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
  return NextResponse.json(listOrders({ status, limit }));
}
