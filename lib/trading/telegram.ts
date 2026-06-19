import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentConfig } from "@/lib/db/schema";
import type { AgentConfig } from "@/lib/db/schema";

const API = "https://api.telegram.org";

export function telegramConfigured(cfg: AgentConfig): boolean {
  return !!(cfg.telegramBotToken?.trim() && cfg.telegramChatId?.trim());
}

interface InlineButton {
  text: string;
  callback_data: string;
}

/** Send a message; optionally with inline approve/reject buttons. Returns ok. */
export async function sendTelegram(
  cfg: AgentConfig,
  text: string,
  buttons?: InlineButton[][]
): Promise<boolean> {
  if (!telegramConfigured(cfg)) return false;
  try {
    const res = await fetch(`${API}/bot${cfg.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.telegramChatId,
        text,
        parse_mode: "Markdown",
        ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function approveRejectButtons(orderId: number): InlineButton[][] {
  return [
    [
      { text: "✅ Approve", callback_data: `approve:${orderId}` },
      { text: "❌ Reject", callback_data: `reject:${orderId}` },
    ],
  ];
}

export interface TelegramDecision {
  orderId: number;
  action: "approve" | "reject";
}

/**
 * Drain pending Telegram updates and return any approve/reject decisions.
 * Advances the stored offset so each update is processed once. Also handles
 * plain text replies like "approve 12" / "reject 12" / "yes" / "no".
 */
export async function drainTelegramDecisions(cfg: AgentConfig): Promise<TelegramDecision[]> {
  if (!telegramConfigured(cfg)) return [];
  const decisions: TelegramDecision[] = [];
  let offset = cfg.telegramLastOffset;
  try {
    const url = `${API}/bot${cfg.telegramBotToken}/getUpdates?timeout=0${
      offset ? `&offset=${offset}` : ""
    }`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
    if (!data.ok) return [];

    for (const upd of data.result) {
      offset = Math.max(offset, upd.update_id + 1);
      const d = parseUpdate(upd);
      if (d) decisions.push(d);
      // Acknowledge button taps so the spinner clears in the client.
      if (upd.callback_query) {
        await fetch(`${API}/bot${cfg.telegramBotToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: upd.callback_query.id }),
        }).catch(() => {});
      }
    }

    if (offset !== cfg.telegramLastOffset) {
      getDb()
        .update(agentConfig)
        .set({ telegramLastOffset: offset })
        .where(eq(agentConfig.id, 1))
        .run();
    }
  } catch {
    return decisions;
  }
  return decisions;
}

interface TelegramUpdate {
  update_id: number;
  message?: { text?: string };
  callback_query?: { id: string; data?: string };
}

function parseUpdate(upd: TelegramUpdate): TelegramDecision | null {
  const raw = upd.callback_query?.data ?? upd.message?.text ?? "";
  const text = raw.trim().toLowerCase();
  // Structured callback / explicit text: "approve:12", "reject 12", "approve 12"
  const m = text.match(/^(approve|reject|yes|no)[:\s]+(\d+)$/);
  if (m) {
    const action = m[1] === "yes" ? "approve" : m[1] === "no" ? "reject" : (m[1] as "approve" | "reject");
    return { orderId: Number(m[2]), action };
  }
  return null;
}
