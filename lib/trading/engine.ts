import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders, userWatchlist } from "@/lib/db/schema";
import type { Order } from "@/lib/db/schema";
import { getAgentConfig, getActiveStrategy } from "./config";
import { getLatestQuote } from "./prices";
import { getAccountState } from "./robinhood-portfolio";
import { evaluateFence, type OrderIntent } from "./fence";
import {
  sendTelegram,
  approveRejectButtons,
  drainTelegramDecisions,
  telegramConfigured,
} from "./telegram";
import { isRobinhoodLive } from "./robinhood";

const APP_URL = process.env.APP_URL?.trim() || "http://localhost:3000";

export interface PlaceOrderInput {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  orderType?: "market" | "limit";
  limitPrice?: number | null;
  stopLoss?: number | null;
  thesis?: string;
}

export interface PlaceOrderResult {
  // authorized → fence cleared; the agent must now place via the Robinhood MCP
  //              and report the fill back to /api/trade/:id/fill.
  // pending    → Confirm Mode: awaiting human approval before authorizing.
  // blocked    → the Trade Fence rejected it; nothing was placed.
  status: "authorized" | "pending" | "blocked";
  order: Order;
  reason?: string;
  fence: Record<string, { ok: boolean; detail: string }>;
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function countTradesToday(): number {
  const rows = getDb()
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        gte(orders.proposedAt, new Date(startOfTodayMs())),
        inArray(orders.status, ["pending", "approved", "filled"])
      )
    )
    .all();
  return rows.length;
}

function isInWatchlist(ticker: string): boolean {
  return !!getDb().select().from(userWatchlist).where(eq(userWatchlist.ticker, ticker)).get();
}

/**
 * The Guarded Order Tool. Every order — from the agent or the UI — passes
 * through here. It values the order against live prices, runs the Trade Fence
 * (hard limits), then branches on the active Trading Mode:
 *   - blocked    → fence rejected it; recorded, nothing sent to the broker.
 *   - authorized → Autopilot: the agent now places it via the Robinhood MCP.
 *   - pending    → Confirm: a Pending Trade, proposal pushed for approval.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const db = getDb();
  const cfg = getAgentConfig();
  const strategy = getActiveStrategy();
  const ticker = input.ticker.toUpperCase();

  const liveQuote = await getLatestQuote(ticker);
  const isLimit = input.orderType === "limit" && !!input.limitPrice;
  const price = isLimit ? input.limitPrice! : liveQuote?.price ?? 0;
  // The price is "live" if it's a user-set limit, or a real (non-mock) quote.
  const priceLive = isLimit || (!!liveQuote && !liveQuote.mock);
  const account = getAccountState();

  const intent: OrderIntent = { ticker, side: input.side, quantity: input.quantity, price };
  const fence = evaluateFence(intent, {
    config: cfg,
    strategy,
    account,
    inWatchlist: isInWatchlist(ticker),
    tradesToday: countTradesToday(),
    robinhoodLive: isRobinhoodLive(cfg),
    priceLive,
  });

  const estCost = price * input.quantity;
  const now = new Date();

  // Record the order regardless of outcome (audit trail). Every order is real money.
  const baseRow = {
    ticker,
    side: input.side,
    quantity: input.quantity,
    orderType: input.orderType ?? "market",
    limitPrice: input.limitPrice ?? null,
    stopLoss: input.stopLoss ?? null,
    mode: cfg.mode,
    broker: "real",
    thesis: input.thesis ?? null,
    estPrice: price,
    estCost,
    fenceCheck: JSON.stringify(fence.checks),
    proposedAt: now,
  };

  if (!fence.ok) {
    const info = db
      .insert(orders)
      .values({ ...baseRow, status: "blocked", rejectionReason: fence.reason, decidedAt: now })
      .run();
    const order = db.select().from(orders).where(eq(orders.id, Number(info.lastInsertRowid))).get()!;
    return { status: "blocked", order, reason: fence.reason, fence: fence.checks };
  }

  if (cfg.mode === "autopilot") {
    const info = db.insert(orders).values({ ...baseRow, status: "approved" }).run();
    const id = Number(info.lastInsertRowid);
    const settled = await settleOrder(id);
    // Real money: the agent places via the Robinhood MCP next and reports the
    // fill (which sends the receipt push).
    await sendTelegram(
      cfg,
      `🤖 *Autopilot trade authorized* (placing via Robinhood)\n${formatOrderLine(settled.order)}\n_${input.thesis ?? "no thesis"}_`
    );
    return { status: settled.status, order: settled.order, fence: fence.checks };
  }

  // Confirm Mode → Pending Trade awaiting approval.
  const info = db.insert(orders).values({ ...baseRow, status: "pending" }).run();
  const id = Number(info.lastInsertRowid);
  const order = db.select().from(orders).where(eq(orders.id, id)).get()!;
  await sendTelegram(
    cfg,
    `📈 *Trade proposal* (confirm to place)\n${formatOrderLine(order)}\n_${
      input.thesis ?? "no thesis"
    }_\n\nApprove below, or open ${APP_URL}/trades`,
    approveRejectButtons(id)
  );
  return { status: "pending", order, fence: fence.checks };
}

function formatOrderLine(o: Order): string {
  const verb = o.side === "buy" ? "BUY" : "SELL";
  const stop = o.stopLoss ? ` · stop $${o.stopLoss}` : "";
  return `*${verb} ${o.quantity} ${o.ticker}* @ ~$${(o.estPrice ?? 0).toFixed(2)} ($${(
    o.estCost ?? 0
  ).toFixed(2)})${stop}`;
}

/**
 * Settle a fence-cleared order. The app cannot reach the agent's Robinhood MCP,
 * so it only marks the order "authorized" — the agent then places it via the MCP
 * and calls reportFill() with the real fill price.
 */
async function settleOrder(orderId: number): Promise<{ status: "authorized"; order: Order }> {
  const db = getDb();
  // Real money → hand off to the agent's Robinhood MCP.
  db.update(orders)
    .set({ status: "authorized", decidedAt: new Date() })
    .where(eq(orders.id, orderId))
    .run();
  return { status: "authorized", order: db.select().from(orders).where(eq(orders.id, orderId)).get()! };
}

/**
 * The agent reports back the fill from the Robinhood MCP for a real-money order
 * that the app previously authorized. Records the real fill price and pushes the
 * receipt. Only valid for orders the app already cleared (status "authorized").
 */
export type ReportFillResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not_found" | "not_authorized"; order: Order | null };

export async function reportFill(orderId: number, fillPrice: number): Promise<ReportFillResult> {
  const db = getDb();
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return { ok: false, reason: "not_found", order: null };
  if (order.status !== "authorized") return { ok: false, reason: "not_authorized", order };
  db.update(orders)
    .set({ status: "filled", fillPrice, filledAt: new Date() })
    .where(eq(orders.id, orderId))
    .run();
  const filled = db.select().from(orders).where(eq(orders.id, orderId)).get()!;
  await sendTelegram(
    getAgentConfig(),
    `🤖 *Robinhood trade filled*\n${formatOrderLine(filled)} → filled @ $${fillPrice.toFixed(2)}`
  );
  return { ok: true, order: filled };
}

/**
 * Approve a Pending Trade (from the UI or Telegram). Returns an "authorized"
 * order the agent then places via the Robinhood MCP and reports back.
 */
export async function approveOrder(orderId: number): Promise<Order | null> {
  const db = getDb();
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order || order.status !== "pending") return order ?? null;
  const settled = await settleOrder(orderId);
  return settled.order;
}

/** Reject a Pending Trade. */
export function rejectOrder(orderId: number, reason = "Rejected by user"): Order | null {
  const db = getDb();
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order || order.status !== "pending") return order ?? null;
  db.update(orders)
    .set({ status: "rejected", rejectionReason: reason, decidedAt: new Date() })
    .where(eq(orders.id, orderId))
    .run();
  return db.select().from(orders).where(eq(orders.id, orderId)).get()!;
}

/**
 * Pull approve/reject replies from Telegram and apply them. Called by the
 * agent's wake/wait loop so a phone tap resolves a Pending Trade without the
 * app being open. Returns the orders that changed.
 */
export async function applyTelegramDecisions(): Promise<Order[]> {
  const cfg = getAgentConfig();
  if (!telegramConfigured(cfg)) return [];
  const decisions = await drainTelegramDecisions(cfg);
  const changed: Order[] = [];
  for (const d of decisions) {
    const result = d.action === "approve" ? await approveOrder(d.orderId) : rejectOrder(d.orderId);
    if (result) changed.push(result);
  }
  return changed;
}

export function listOrders(opts?: { status?: string; limit?: number }): Order[] {
  const db = getDb();
  const q = db.select().from(orders);
  const rows = opts?.status
    ? q.where(eq(orders.status, opts.status)).all()
    : q.all();
  rows.sort((a, b) => b.proposedAt.getTime() - a.proposedAt.getTime());
  return opts?.limit ? rows.slice(0, opts.limit) : rows;
}
