import { NextResponse } from "next/server";
import { getAgentConfig, updateAgentConfig, getActiveStrategy, type AgentConfigPatch } from "@/lib/trading/config";
import { telegramConfigured } from "@/lib/trading/telegram";
import { getRobinhoodStatus } from "@/lib/trading/robinhood";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getAgentConfig();
  // Never leak the bot token to the client; report only whether it's set.
  const { telegramBotToken, ...safe } = config;
  return NextResponse.json({
    ...safe,
    telegramTokenSet: !!telegramBotToken?.trim(),
    telegramConfigured: telegramConfigured(config),
    activeStrategy: getActiveStrategy(),
    robinhood: getRobinhoodStatus(config),
  });
}

const MODES = ["off", "confirm", "autopilot"];

export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const patch: AgentConfigPatch = {};

  if (typeof body.mode === "string") {
    if (!MODES.includes(body.mode)) return bad("mode");
    patch.mode = body.mode;
  }
  if (typeof body.halt === "boolean") patch.halt = body.halt;
  if (typeof body.watchlistOnly === "boolean") patch.watchlistOnly = body.watchlistOnly;
  if (body.pollMinutes != null) patch.pollMinutes = clamp(Number(body.pollMinutes), 1, 1440);
  if (body.maxPositionPct != null) patch.maxPositionPct = clamp(Number(body.maxPositionPct), 0.1, 100);
  if (body.dailyTradeCap != null) patch.dailyTradeCap = clamp(Math.round(Number(body.dailyTradeCap)), 0, 1000);
  if (body.activeStrategyId != null) patch.activeStrategyId = Number(body.activeStrategyId);
  if (typeof body.telegramBotToken === "string") patch.telegramBotToken = body.telegramBotToken.trim() || null as unknown as string;
  if (typeof body.telegramChatId === "string") patch.telegramChatId = body.telegramChatId.trim() || null as unknown as string;

  const updated = updateAgentConfig(patch);
  const { telegramBotToken, ...safe } = updated;
  return NextResponse.json({
    ...safe,
    telegramTokenSet: !!telegramBotToken?.trim(),
    robinhood: getRobinhoodStatus(updated),
  });
}

function bad(field: string) {
  return NextResponse.json({ error: `invalid ${field}` }, { status: 400 });
}
function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
