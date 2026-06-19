import { NextResponse } from "next/server";
import { updateStrategy, deleteStrategy } from "@/lib/trading/config";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const patch: { name?: string; prompt?: string; riskProfile?: string; maxPositionPct?: number | null } = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.prompt === "string") patch.prompt = body.prompt.trim();
  if (typeof body.riskProfile === "string") patch.riskProfile = body.riskProfile;
  if (body.maxPositionPct !== undefined) {
    patch.maxPositionPct = body.maxPositionPct === null ? null : Number(body.maxPositionPct);
  }
  const updated = updateStrategy(Number(id), patch);
  if (!updated) return NextResponse.json({ error: "strategy not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteStrategy(Number(id));
  if (!ok) {
    return NextResponse.json(
      { error: "cannot delete (default strategy or not found)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
