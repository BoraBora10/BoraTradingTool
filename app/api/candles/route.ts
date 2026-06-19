import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import type { CandleResolution } from "@/lib/providers/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const resolution = (searchParams.get("resolution") ?? "D") as CandleResolution;
  const from = Number(searchParams.get("from") ?? 0);
  const to = Number(searchParams.get("to") ?? Math.floor(Date.now() / 1000));

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const provider = getProvider();
    const candles = await provider.getCandles(ticker, resolution, from, to);
    return NextResponse.json({ candles });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
