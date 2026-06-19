import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const provider = getProvider();
  const quote = await provider.getQuote(ticker.toUpperCase());
  return NextResponse.json(quote);
}
