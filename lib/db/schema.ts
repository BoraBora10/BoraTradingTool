import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const stocks = sqliteTable("stocks", {
  ticker: text("ticker").primaryKey(),
  name: text("name").notNull(),
  exchange: text("exchange"),
  sector: text("sector"),
  industry: text("industry"),
  marketCap: real("market_cap"),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const quoteSnapshots = sqliteTable("quote_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  price: real("price").notNull(),
  open: real("open"),
  high: real("high"),
  low: real("low"),
  prevClose: real("prev_close"),
  change: real("change"),
  changePct: real("change_pct"),
  volume: integer("volume"),
  avgVolume: integer("avg_volume"),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export const priceCandles = sqliteTable("price_candles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  resolution: text("resolution").notNull(), // 1, 5, 15, 30, 60, D, W, M
  time: integer("time").notNull(), // unix timestamp
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: integer("volume"),
});

export const newsArticles = sqliteTable("news_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker"), // null = general market news
  headline: text("headline").notNull(),
  summary: text("summary"),
  source: text("source"),
  url: text("url"),
  sentiment: real("sentiment"), // -1 to 1
  publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export const marketBriefings = sqliteTable("market_briefings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  spxClose: real("spx_close"),
  spxChange: real("spx_change"),
  spxChangePct: real("spx_change_pct"),
  ndxClose: real("ndx_close"),
  ndxChange: real("ndx_change"),
  ndxChangePct: real("ndx_change_pct"),
  djiClose: real("dji_close"),
  djiChange: real("dji_change"),
  djiChangePct: real("dji_change_pct"),
  marketStatus: text("market_status"), // open, closed, pre-market, after-hours
  sectorData: text("sector_data"), // JSON
  topMovers: text("top_movers"), // JSON
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export const watchlistSuggestions = sqliteTable("watchlist_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  catalysts: text("catalysts"), // JSON array of strings
  riskLevel: text("risk_level"), // low, medium, high
  thesis: text("thesis"),
  addedAt: integer("added_at", { mode: "timestamp" }).notNull(),
});

export const stockAnalysisReports = sqliteTable("stock_analysis_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  // Fundamentals
  pe: real("pe"),
  eps: real("eps"),
  revenue: real("revenue"),
  revenueGrowth: real("revenue_growth"),
  grossMargin: real("gross_margin"),
  netMargin: real("net_margin"),
  debtToEquity: real("debt_to_equity"),
  freeCashFlow: real("free_cash_flow"),
  // Technicals
  rsi: real("rsi"),
  macdLine: real("macd_line"),
  macdSignal: real("macd_signal"),
  macdHist: real("macd_hist"),
  sma20: real("sma20"),
  sma50: real("sma50"),
  sma200: real("sma200"),
  bbUpper: real("bb_upper"),
  bbLower: real("bb_lower"),
  support: real("support"),
  resistance: real("resistance"),
  trend: text("trend"), // bullish, bearish, neutral
  // Analyst consensus
  analystBuy: integer("analyst_buy"),
  analystHold: integer("analyst_hold"),
  analystSell: integer("analyst_sell"),
  priceTarget: real("price_target"),
  priceTargetHigh: real("price_target_high"),
  priceTargetLow: real("price_target_low"),
  // Signals
  bullSignals: text("bull_signals"), // JSON
  bearSignals: text("bear_signals"), // JSON
  overallSignal: text("overall_signal"), // buy, hold, sell
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
});

// User's persistent watchlist
export const userWatchlist = sqliteTable("user_watchlist", {
  ticker: text("ticker").primaryKey(),
  addedAt: integer("added_at", { mode: "timestamp" }).notNull(),
});

// --- Autonomous Trading ---

// Singleton (id = 1): how the Agent Layer is allowed to trade.
export const agentConfig = sqliteTable("agent_config", {
  id: integer("id").primaryKey(), // always 1
  mode: text("mode").notNull().default("off"), // off | confirm | autopilot
  broker: text("broker").notNull().default("real"), // always "real" (paper trading removed)
  halt: integer("halt", { mode: "boolean" }).notNull().default(false),
  pollMinutes: integer("poll_minutes").notNull().default(30),
  // Trade Fence
  maxPositionPct: real("max_position_pct").notNull().default(15), // % of account per position
  watchlistOnly: integer("watchlist_only", { mode: "boolean" }).notNull().default(true),
  dailyTradeCap: integer("daily_trade_cap").notNull().default(5),
  activeStrategyId: integer("active_strategy_id"),
  // Notification Channel (Telegram)
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  telegramLastOffset: integer("telegram_last_offset").notNull().default(0),
  // Robinhood MCP liveness — the agent heartbeats here after verifying the MCP.
  // Real-money controls are gated on this being fresh (see lib/trading/robinhood.ts).
  robinhoodConnectedAt: integer("robinhood_connected_at", { mode: "timestamp" }),
  robinhoodAccount: text("robinhood_account"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Editable trading mandates (prompt + its mechanical limits).
export const strategies = sqliteTable("strategies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  riskProfile: text("risk_profile").notNull().default("medium"), // low | medium | high
  maxPositionPct: real("max_position_pct"), // optional per-strategy override of the fence
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Every order the Guarded Order Tool sees — audit trail + Pending Trade queue.
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  side: text("side").notNull(), // buy | sell
  quantity: real("quantity").notNull(),
  orderType: text("order_type").notNull().default("market"), // market | limit
  limitPrice: real("limit_price"),
  stopLoss: real("stop_loss"),
  // pending | approved | rejected | filled | blocked | canceled
  status: text("status").notNull(),
  mode: text("mode").notNull(), // mode at time of proposal
  broker: text("broker").notNull(), // always "real" (paper trading removed)
  thesis: text("thesis"),
  estPrice: real("est_price"), // quote at proposal time
  estCost: real("est_cost"),
  fillPrice: real("fill_price"),
  fenceCheck: text("fence_check"), // JSON: which limits were evaluated
  rejectionReason: text("rejection_reason"),
  proposedAt: integer("proposed_at", { mode: "timestamp" }).notNull(),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
  filledAt: integer("filled_at", { mode: "timestamp" }),
});

// Real broker (Robinhood) portfolio snapshot — the agent can't be reached by the
// app, so it pushes the Agentic account's portfolio here via the MCP after a
// heartbeat. Singleton (id = 1); the UI reads this for the real-money view.
export const robinhoodPortfolio = sqliteTable("robinhood_portfolio", {
  id: integer("id").primaryKey(), // always 1
  account: text("account").notNull(), // label, e.g. "Agentic"
  accountNumber: text("account_number"), // masked, e.g. "••••5267"
  totalValue: real("total_value"),
  cash: real("cash"),
  buyingPower: real("buying_power"),
  positions: text("positions"), // JSON array of { ticker, shares, avgCost, price?, marketValue? }
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export type Stock = typeof stocks.$inferSelect;
export type QuoteSnapshot = typeof quoteSnapshots.$inferSelect;
export type PriceCandle = typeof priceCandles.$inferSelect;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type MarketBriefing = typeof marketBriefings.$inferSelect;
export type WatchlistSuggestion = typeof watchlistSuggestions.$inferSelect;
export type StockAnalysisReport = typeof stockAnalysisReports.$inferSelect;
export type UserWatchlistEntry = typeof userWatchlist.$inferSelect;
export type AgentConfig = typeof agentConfig.$inferSelect;
export type Strategy = typeof strategies.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type RobinhoodPortfolioRow = typeof robinhoodPortfolio.$inferSelect;
