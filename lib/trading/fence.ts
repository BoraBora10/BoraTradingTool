import type { AgentConfig, Strategy } from "@/lib/db/schema";
import type { AccountState } from "./robinhood-portfolio";

export interface OrderIntent {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number; // estimated fill price
}

export interface FenceContext {
  config: AgentConfig;
  strategy: Strategy | null;
  account: AccountState; // real account, derived from the synced Robinhood snapshot
  inWatchlist: boolean;
  tradesToday: number; // filled + pending today
  robinhoodLive: boolean; // is the agent's Robinhood MCP heartbeat fresh?
  priceLive: boolean; // is the order priced off a live quote (not simulated/mock data)?
}

export interface FenceResult {
  ok: boolean;
  reason?: string;
  checks: Record<string, { ok: boolean; detail: string }>;
}

/**
 * The Trade Fence. Pure, deterministic evaluation of an order against the
 * configured hard limits. The Guarded Order Tool runs this before any order
 * reaches the broker — soft guidance to the agent never substitutes for it.
 */
export function evaluateFence(intent: OrderIntent, ctx: FenceContext): FenceResult {
  const { config, strategy, account } = ctx;
  const checks: FenceResult["checks"] = {};
  const cost = intent.price * intent.quantity;
  const maxPct = strategy?.maxPositionPct ?? config.maxPositionPct;

  const fail = (key: string, detail: string) => {
    checks[key] = { ok: false, detail };
  };
  const pass = (key: string, detail: string) => {
    checks[key] = { ok: true, detail };
  };

  // 1. Mode must permit trading at all.
  if (config.mode === "off") fail("mode", "Trading is off");
  else pass("mode", `Mode is ${config.mode}`);

  // 2. Halt overrides everything.
  if (config.halt) fail("halt", "Halt is engaged — all placement frozen");
  else pass("halt", "Not halted");

  // 3. The agent executes every order through the Robinhood MCP, so a live
  // heartbeat is always required.
  if (!ctx.robinhoodLive) {
    fail("robinhood", "Robinhood MCP is not connected (no fresh heartbeat)");
  } else {
    pass("robinhood", "Robinhood MCP live");
  }

  // 3c. The fence sizes against the synced Robinhood snapshot. No fresh snapshot
  // means we don't know the real cash/positions — block (fail-safe).
  if (!account.fresh) {
    fail("account", "No fresh account snapshot — sync the portfolio via the MCP");
  } else {
    pass("account", `Account synced — equity $${account.equity.toFixed(2)}`);
  }

  // 3d. Never trade real money on simulated/unavailable prices. If the quote is
  // mock (e.g. all live data sources failed, or Mock Mode), block.
  if (!ctx.priceLive) {
    fail("priceData", "Quote is simulated or unavailable — refusing to trade on non-live prices");
  } else {
    pass("priceData", "Priced off a live quote");
  }

  // 4. Watchlist restriction applies to opening/adding (buys), never to exits.
  if (intent.side === "buy" && config.watchlistOnly && !ctx.inWatchlist) {
    fail("watchlist", `${intent.ticker} is not on the watchlist (watchlist-only is on)`);
  } else {
    pass("watchlist", config.watchlistOnly ? "On watchlist or exiting" : "Watchlist-only off");
  }

  // 5. Daily trade cap.
  if (ctx.tradesToday >= config.dailyTradeCap) {
    fail("dailyCap", `Daily trade cap reached (${ctx.tradesToday}/${config.dailyTradeCap})`);
  } else {
    pass("dailyCap", `${ctx.tradesToday}/${config.dailyTradeCap} trades today`);
  }

  // Sizing/holdings checks only apply when the account snapshot is fresh; otherwise
  // the account check above has already failed the order.
  if (account.fresh) {
    if (intent.side === "buy") {
      // 6. Buying power.
      if (cost > account.cash + 1e-6) {
        fail("buyingPower", `Cost $${cost.toFixed(2)} exceeds cash $${account.cash.toFixed(2)}`);
      } else {
        pass("buyingPower", `Cash $${account.cash.toFixed(2)} covers $${cost.toFixed(2)}`);
      }

      // 7. Max position size as % of account equity (resulting position).
      const held = account.positions.find((p) => p.ticker === intent.ticker);
      const resultingValue = (held?.marketValue ?? 0) + cost;
      const resultingPct = account.equity > 0 ? (resultingValue / account.equity) * 100 : 100;
      if (resultingPct > maxPct + 1e-6) {
        fail(
          "maxPosition",
          `Position would be ${resultingPct.toFixed(1)}% of account, over the ${maxPct}% cap`
        );
      } else {
        pass("maxPosition", `Position ${resultingPct.toFixed(1)}% ≤ ${maxPct}% cap`);
      }
    } else {
      // 8. Cannot sell more than held.
      const held = account.positions.find((p) => p.ticker === intent.ticker);
      if (!held || intent.quantity > held.quantity + 1e-6) {
        fail(
          "holdings",
          `Cannot sell ${intent.quantity} ${intent.ticker} — hold ${held?.quantity ?? 0}`
        );
      } else {
        pass("holdings", `Holding ${held.quantity} ${intent.ticker}`);
      }
    }
  }

  const failed = Object.entries(checks).find(([, v]) => !v.ok);
  return {
    ok: !failed,
    reason: failed ? failed[1].detail : undefined,
    checks,
  };
}
