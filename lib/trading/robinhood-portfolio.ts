import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { robinhoodPortfolio } from "@/lib/db/schema";
import { ROBINHOOD_HEARTBEAT_TTL_MS } from "./robinhood";

// One holding in the real Agentic account. price/marketValue are optional —
// the agent fills them from get_equity_quotes when available so the UI doesn't
// have to value positions itself.
export interface RealPosition {
  ticker: string;
  shares: number;
  avgCost: number;
  price?: number | null;
  marketValue?: number | null;
}

export interface RealPortfolioSnapshot {
  account: string;
  accountNumber: string | null;
  totalValue: number | null;
  cash: number | null;
  buyingPower: number | null;
  positions: RealPosition[];
  fetchedAt: string; // ISO
}

export interface SaveRealPortfolioInput {
  account: string;
  accountNumber?: string | null;
  totalValue?: number | null;
  cash?: number | null;
  buyingPower?: number | null;
  positions?: RealPosition[];
}

/** The latest snapshot the agent pushed, or null if it never has. */
export function getRealPortfolio(): RealPortfolioSnapshot | null {
  const row = getDb()
    .select()
    .from(robinhoodPortfolio)
    .where(eq(robinhoodPortfolio.id, 1))
    .get();
  if (!row) return null;
  let positions: RealPosition[] = [];
  try {
    positions = row.positions ? (JSON.parse(row.positions) as RealPosition[]) : [];
  } catch {
    positions = [];
  }
  return {
    account: row.account,
    accountNumber: row.accountNumber ?? null,
    totalValue: row.totalValue ?? null,
    cash: row.cash ?? null,
    buyingPower: row.buyingPower ?? null,
    positions,
    fetchedAt: (row.fetchedAt ?? new Date()).toISOString(),
  };
}

/** Upsert the singleton snapshot. Called by the agent after a fresh MCP read. */
export function saveRealPortfolio(input: SaveRealPortfolioInput): RealPortfolioSnapshot {
  const db = getDb();
  const now = new Date();
  const positions = input.positions ?? [];
  db.insert(robinhoodPortfolio)
    .values({
      id: 1,
      account: input.account,
      accountNumber: input.accountNumber ?? null,
      totalValue: input.totalValue ?? null,
      cash: input.cash ?? null,
      buyingPower: input.buyingPower ?? null,
      positions: JSON.stringify(positions),
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: robinhoodPortfolio.id,
      set: {
        account: input.account,
        accountNumber: input.accountNumber ?? null,
        totalValue: input.totalValue ?? null,
        cash: input.cash ?? null,
        buyingPower: input.buyingPower ?? null,
        positions: JSON.stringify(positions),
        fetchedAt: now,
      },
    })
    .run();
  return getRealPortfolio()!;
}

/** Drop the stored snapshot (e.g. on disconnect). */
export function clearRealPortfolio(): void {
  getDb().delete(robinhoodPortfolio).where(eq(robinhoodPortfolio.id, 1)).run();
}

// --- Account state for the Trade Fence ---
// Since paper trading was removed, the fence sizes orders against the real
// Robinhood account. The app can't read the broker directly, so it relies on the
// snapshot the agent pushes via the MCP. `fresh` is false when no snapshot exists
// or it's older than the heartbeat TTL — in which case the fence blocks (fail-safe).

export interface AccountPosition {
  ticker: string;
  quantity: number;
  marketValue: number;
}

export interface AccountState {
  cash: number;
  equity: number;
  positions: AccountPosition[];
  fresh: boolean;
  fetchedAt: string | null;
}

export function getAccountState(now = Date.now()): AccountState {
  const snap = getRealPortfolio();
  if (!snap) {
    return { cash: 0, equity: 0, positions: [], fresh: false, fetchedAt: null };
  }
  const positions: AccountPosition[] = snap.positions.map((p) => {
    const marketValue =
      p.marketValue ?? (p.price != null ? p.price * p.shares : p.avgCost * p.shares);
    return { ticker: p.ticker, quantity: p.shares, marketValue };
  });
  const cash = snap.cash ?? 0;
  const equity = snap.totalValue ?? cash + positions.reduce((s, p) => s + p.marketValue, 0);
  const fresh = now - new Date(snap.fetchedAt).getTime() <= ROBINHOOD_HEARTBEAT_TTL_MS;
  return { cash, equity, positions, fresh, fetchedAt: snap.fetchedAt };
}
