# MarketPulse — Domain Glossary

> This file is a glossary only. No implementation details, no specs, no architecture decisions.

## Core Concepts

**Data Layer**
The web application (Next.js). Responsible for fetching market data from external APIs, storing it locally, and rendering it as UI. Does not contain AI logic.

**Agent Layer**
Claude Code (or Codex CLI) running in the repository terminal. Responsible for AI reasoning, market interpretation, and trading actions. Users bring their own Claude Code session — no AI API key is required in the app.

**Context Files**
Structured JSON files written by the Data Layer to the `context/` directory. The Agent Layer reads these files to understand the current state of the market and individual stocks before reasoning or acting.

**Research Report**
A structured section on the Stock Analyzer page that displays all available data about a single stock — technicals, fundamentals, earnings, news, analyst ratings, insider activity, and bull/bear signals. Primarily populated by aggregating data from multiple financial APIs. Rule-based signals fill gaps where APIs don't provide interpretation. Not LLM-generated text.

**API Aggregation**
The practice of pulling different data types from whichever API provides them best (e.g. analyst ratings from Finnhub, fundamentals from FMP, technicals from Twelve Data), then combining them into a single unified view.

**Rule-based Signals**
Algorithmically derived buy/sell/hold indicators calculated from raw price and fundamental data when no API-provided interpretation is available. Examples: price vs. SMA crossovers, RSI overbought/oversold thresholds, P/E vs. sector average.

**Stock Analyzer**
The anchor feature of the app. A dedicated page per ticker that shows quote, chart, technicals, fundamentals, earnings, news, and the Research Report section.

**Setup Gate**
The app requires a real data provider — there is no mock/demo mode. Until a Finnhub API key is configured, the app shows a setup screen and nothing else. Once a key is set, the product runs on live data only; any datum a source can't supply is shown as "unavailable" (—), never fabricated.

**Local Database**
SQLite managed by Drizzle ORM. A single file (`marketpulse.db`) stored in the repo. Zero server setup required. Stores cached API responses, candles, quotes, news, analysis snapshots, and context data. Also serves as the source the Agent Layer reads when Claude Code needs structured market state.

**Primary Data Provider**
Finnhub. The single financial data API implemented in the MVP. Covers quotes, candles, fundamentals, analyst ratings, price targets, earnings, insider transactions, and news with sentiment — all under one free-tier API key.

**Chart Engine**
Lightweight Charts (TradingView's open-source library). Used for all financial time series visualization — candlestick charts, volume bars, SMA/EMA overlays. Fed directly from Finnhub candle data. Not an iframe embed; fully controlled by the app.

**Data Provider Adapter**
An abstraction layer that wraps a financial data API. All adapters implement the same interface so providers can be swapped or added without changing the UI or agent logic.

## Autonomous Trading

**Trading Mode**
The single setting that governs how much human gating sits between the Agent Layer deciding on a trade and that trade reaching the broker. Exactly one mode is active at a time — the modes are mutually exclusive, never run in parallel.

**Confirm Mode**
The default Trading Mode. The Agent Layer does all the research and forms a complete order, but before anything reaches the broker it notifies the human and waits for explicit approval. This is the documented "never place a real order without confirmation" rule expressed as the default.

**Autopilot Mode**
The opt-in Trading Mode. The Agent Layer places trades on its own with no human action required, then notifies the human after the fact. A human flips a single switch to enter it.

**Scheduled Research System**
The shared cadence both Trading Modes ride on. The Agent Layer, running in the terminal, wakes itself on a fixed interval (default every 30 minutes during market hours), refreshes Context Files, evaluates the active Strategy against current conditions, and decides whether to act. Both Confirm Mode and Autopilot Mode use the same wake loop; the mode only changes what happens once a trade is decided.

**Guarded Order Tool**
The authorization-and-record endpoint every order must pass through before placement. The Data Layer runs the Trade Fence, the active Trading Mode, and the Halt flag, and records the order. It cannot place the trade itself — all trades are real money and execute via the Robinhood MCP in the Agent Layer's own session — so it returns an **authorized** order that the Agent Layer then places via the MCP and reports back. The rule that keeps the fence meaningful: the Agent Layer never places via the MCP without first receiving an `authorized` from this tool.

**Robinhood MCP**
The brokerage integration that actually executes real-money trades. It runs inside the Agent Layer's Claude Code session (not the app), so the Data Layer cannot place real orders directly — it can only authorize them and record the fills the Agent Layer reports.

**MCP Heartbeat**
The Agent Layer's proof to the Data Layer that the Robinhood MCP is connected and live. Because the app cannot inspect the agent's MCP session, the agent verifies the MCP (e.g. by calling a read tool) and posts a timestamped heartbeat. The connection counts as live only while a recent heartbeat exists (a fixed freshness window). Real-money controls — arming trading and placing orders — are gated on a live heartbeat; if it goes stale, the gate closes and trades are blocked.

**Trade Fence**
The configurable, code-enforced limits the Guarded Order Tool applies to every order: maximum percent of account per position (default 15%), watchlist-only restriction, daily trade cap, real-money arming, a live MCP heartbeat, and a fresh account snapshot. Account size for the percent and buying-power checks comes from the Robinhood snapshot the Agent Layer syncs via the MCP; with no fresh snapshot, orders are blocked (fail-safe). Enforced hard (rejected in code) and also stated to the Agent Layer as guidance (soft). Every limit is editable, including removing it.

**Strategy**
The trading mandate, expressed as an editable prompt plus its mechanical limits. The Default Strategy is medium-risk with a 15%-per-position cap. Users can edit the default prompt or add their own Strategy prompts and select which is active.

**Pending Trade**
In Confirm Mode, a trade the Agent Layer has proposed and is holding while it waits for human approval. Surfaced both as a push proposal (Telegram) and an in-app approve/reject screen; approving authorizes it through the Guarded Order Tool for the Agent Layer to place via the MCP.

**Halt**
A hard stop the Guarded Order Tool checks immediately before every placement. Independent of the Trading Mode toggle, it lets the human freeze all order placement at once.

**Notification Channel**
How the Agent Layer reaches the human off-terminal — a Telegram bot (free, self-hosted, two-way: it sends proposals/receipts and reads approve/reject replies). Confirm Mode uses it to ask; Autopilot Mode uses it to report.

## Distribution

**Self-hosted**
Users clone the GitHub repository and run the app locally. Each user configures their own API keys. No shared deployment, no multi-tenancy, no user accounts required.
