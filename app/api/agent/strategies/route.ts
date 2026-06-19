import { NextResponse } from "next/server";
import { listStrategies, createStrategy } from "@/lib/trading/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listStrategies());
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!name || !prompt) {
    return NextResponse.json({ error: "name and prompt required" }, { status: 400 });
  }
  const strategy = createStrategy({
    name,
    prompt,
    riskProfile: typeof body.riskProfile === "string" ? body.riskProfile : "medium",
    maxPositionPct: body.maxPositionPct != null ? Number(body.maxPositionPct) : null,
  });
  return NextResponse.json(strategy, { status: 201 });
}
