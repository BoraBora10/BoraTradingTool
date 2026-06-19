import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { refreshStockContext } from "@/lib/data/research";
import { getRealPortfolio } from "@/lib/trading/robinhood-portfolio";

export const dynamic = "force-dynamic";

// The Scheduled Research System's refresh hook. The agent does its own candidate
// discovery externally (news/trends/TA) and feeds the tickers it wants logged via
// { tickers: [...] } — this endpoint then writes/refreshes their Context Files so
// the findings are recorded and readable. With no body it falls back to the
// baseline set (watchlist + current holdings) so holdings are always kept fresh.
export async function POST(req: Request) {
  let only: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.tickers)) only = body.tickers.map((t: string) => String(t).toUpperCase());
  } catch {
    // no body — refresh the default set
  }

  const db = getDb();
  const watchlist = db.select().from(schema.userWatchlist).all().map((r) => r.ticker);
  const held = (getRealPortfolio()?.positions ?? []).map((p) => p.ticker);
  const tickers = only ?? Array.from(new Set([...watchlist, ...held]));

  const results = await Promise.all(
    tickers.map(async (t) => {
      try {
        return await refreshStockContext(t);
      } catch {
        return null;
      }
    })
  );

  const refreshed = results.filter((r): r is NonNullable<typeof r> => r !== null);
  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    count: refreshed.length,
    summaries: refreshed,
    skipped: tickers.filter((t) => !refreshed.some((r) => r.ticker === t)),
  });
}
