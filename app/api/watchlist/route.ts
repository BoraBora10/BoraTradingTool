import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const rows = db.select().from(schema.userWatchlist).all();
  return NextResponse.json(rows.map((r) => r.ticker));
}

export async function POST(req: Request) {
  const { ticker } = await req.json();
  if (!ticker || typeof ticker !== "string") {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }
  const normalized = ticker.trim().toUpperCase();
  if (!normalized || normalized.length > 10) {
    return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
  }
  const db = getDb();
  db.insert(schema.userWatchlist)
    .values({ ticker: normalized, addedAt: new Date() })
    .onConflictDoNothing()
    .run();
  return NextResponse.json({ ok: true, ticker: normalized });
}

export async function DELETE(req: Request) {
  const { ticker } = await req.json();
  if (!ticker || typeof ticker !== "string") {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }
  const db = getDb();
  db.delete(schema.userWatchlist).where(eq(schema.userWatchlist.ticker, ticker.toUpperCase())).run();
  return NextResponse.json({ ok: true });
}
