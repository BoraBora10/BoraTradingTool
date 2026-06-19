# MarketPulse — Setup & Operator Checklist

> Read this before using the system. It lists everything required to make MarketPulse
> **fully functional**, split into what a **human operator** sets up once and what a
> **Claude Code agent** must do every session. Companion docs: `CLAUDE.md` (agent
> operating manual), `CONTEXT.md` (glossary), `docs/adr/0001-autonomous-trading.md`
> (why it's built this way).

MarketPulse is **self-hosted and single-user** — each person runs their own copy with
their own keys and their own Claude Code session. There is no shared server and no
multi-tenant accounts. "Other people using this" means other people running their own
clone, each going through this checklist.

---

## What "fully functional" means

The system has three capabilities, each with its own prerequisites. You can run with only
the ones you need — the rest stay locked and the UI tells you so. **All trading is real money
— there is no paper/simulated mode.**

| Capability | Needs | Without it |
|---|---|---|
| **Research data** (quotes, charts, signals) | Finnhub API key (**required**) | App won't load — a setup screen prompts for the key. No mock/demo mode. |
| **Real-money trading** | Robinhood MCP + restart + heartbeat + arm + a synced portfolio snapshot | Blocked; UI shows "not connected" |
| **Off-terminal approvals/alerts** | Telegram bot token + chat ID | Confirm-Mode proposals appear only at `/trades` |

---

## Part A — Human operator checklist (one-time)

### 1. Run the app
- [ ] `npm install`
- [ ] `cp .env.example .env.local`
- [ ] `npm run dev` → open http://localhost:3000
- [ ] The SQLite DB (`marketpulse.db`) auto-creates on first request. No migration step.

### 2. Market data — Finnhub key (required)
- [ ] Get a free Finnhub key at https://finnhub.io
- [ ] On first load the app shows a **setup screen** — paste the key there (it saves to `.env.local`). You can also set `FINNHUB_API_KEY=` directly.
- [ ] The app does not run without a key — there is **no mock/demo mode**. Any data a source can't supply shows as "unavailable" (—), never fabricated.

### 3. Configure trading (Settings → Autonomous Trading)
- [ ] **Populate your watchlist** (`/watchlist`). The fence defaults to **watchlist-only**, so with an empty watchlist the agent can open *nothing*.
- [ ] Pick / edit the active **Strategy** prompt (default: medium-risk swing).
- [ ] Set the **Trade Fence**: max % per position (default 15%), max trades/day (default 5), watchlist-only on/off.
- [ ] Choose a **Trading Mode**: `off`, `confirm` (default, proposes & waits), or `autopilot` (places within the fence, notifies after).

### 4. Notifications — Telegram (required for Confirm Mode to reach your phone)
- [ ] Create a bot with @BotFather → get the **bot token**.
- [ ] Message the bot once, then put the **chat ID** + token in Settings.
- [ ] Without this, Confirm-Mode proposals still appear at `/trades`, but nothing reaches you off-terminal.

### 5. Real money (required to trade at all — there is no paper fallback)
- [ ] Create a **Robinhood Agentic account** at [robinhood.com/agentic](https://robinhood.com/agentic) (a separate agentic-access tier; link your existing Robinhood account).
- [ ] Register the MCP once — this is Robinhood's official endpoint (see their "Connect your AI agent" docs):
      `claude mcp add robinhood-trading --transport http https://agent.robinhood.com/mcp/trading`
- [ ] Run `/mcp`, select **robinhood-trading**, finish the browser OAuth.
- [ ] **Restart Claude Code** (`/exit` → `claude`). MCP tools load only at session start — a mid-session `claude mcp add` is not usable until restart.
- [ ] In Settings → Autonomous Trading, pick a **Mode** (Confirm or Autopilot). All trading is real money — there is no arm step and no broker selector; placement is gated by Mode + Halt + a live MCP.
- [ ] Have the agent run the loop so it heartbeats — the badge turns green and stays green only while a session is actively heartbeating.

---

## Part B — Claude Code agent checklist (every session)

Any agent picking up this repo runs this before trading. (See `CLAUDE.md` for the full
wake-loop spec.)

### Pre-flight
- [ ] Read `CLAUDE.md`, `CONTEXT.md`, `docs/adr/0001-autonomous-trading.md`.
- [ ] Confirm the `robinhood-trading` MCP tools are loaded. If absent, the user must finish Part A.5 and **restart** so they load this session.
- [ ] Call `get_accounts` / `getAccount()` to verify the live connection.
- [ ] Identify the **`agentic_allowed: true`** account — that is the *only* account permitted to trade agentically (and the only one whose portfolio the UI shows). Use **that account number** for every real call.
- [ ] `GET /api/agent/config` — note `mode`, `halt`, `broker`, `watchlistOnly`, `maxPositionPct`, `dailyTradeCap`, `pollMinutes`. **If `mode: off` or `halt: true`, do not trade.**

### Connection & portfolio (real broker)
- [ ] `POST /api/agent/robinhood/heartbeat { "account": "<label>" }` after verifying the MCP. **Re-post every wake** — the heartbeat has a **10-minute TTL**; stale = real-money gate auto-closes.
- [ ] Sync the portfolio for display: call `get_portfolio` + `get_equity_positions` for the **agentic account only**, then `POST /api/agent/robinhood/portfolio { account, accountNumber, totalValue, cash, buyingPower, positions }`. The `/portfolio` page reads this; the user clicks **Check connection** to pull it in.

### Research (you are the engine, not the repo)
- [ ] **Discover candidates yourself from the outside world** — `WebSearch` for catalysts / news /
  sector rotation, then real TA via the Robinhood MCP (`get_equity_quotes`, `get_equity_historicals`).
  You are **not** limited to the watchlist; it is only a baseline. Cross-check news against TA — never
  buy a catalyst on a broken chart. Log what you evaluate via `POST /api/research/refresh { tickers:[...] }`.
  Full method: see **"How you find and pick trades — research methodology"** in `CLAUDE.md`.

### The trading rule (never violate)
- [ ] Authorize every order through `POST /api/trade/place` **first**. Act on the status:
  - `authorized` → fence-cleared → **now** place via the Robinhood MCP, then `POST /api/trade/{id}/fill`.
  - `pending` → Confirm Mode, left for the user — do not place.
  - `blocked` → read `reason`/`fence`, adjust or surface it.
- [ ] **Never call the Robinhood `place_equity_order` MCP before the app returns `authorized`.** That ordering is the entire safety model.

---

## Gotchas (the non-obvious stuff)

- **The app cannot see your `/mcp` panel.** Connection status is driven solely by the agent's heartbeat. Reconnecting in `/mcp` updates nothing until the agent heartbeats again.
- **Green badge ≠ "configured"; it means "a live agent session is here right now."** It only stays green while the wake loop runs (re-heartbeats inside the 10-min window). No loop → it goes stale and reads disconnected. That is the intended fail-safe.
- **MCP tools load at session start only.** Adding the server mid-session requires a restart.
- **All trading is real money — no paper mode, no arm step.** An order requires: a mode that permits it (not off/halt), a fresh MCP heartbeat, a fresh synced account snapshot, and passing the fence. With no fresh snapshot the fence blocks every buy/sell (fail-safe), so sync the portfolio each wake.
- **Empty watchlist + watchlist-only fence = no trades.** Populate the watchlist or relax the fence.
- **No mock/demo data.** A Finnhub key is required to load the app; missing data shows as "unavailable", never fabricated. As defense-in-depth, the fence still **blocks any order not priced off a live quote** (`priceData` check).
- **Quotes include pre/post-market via Yahoo** (`includePrePost`), with Finnhub as fallback. Extended-hours change is measured vs the prior regular close. If Yahoo is unreachable, quotes fall back to Finnhub, which freezes at the regular-session close (no after-hours).
- **Wake interval vs heartbeat TTL.** The MCP heartbeat is live for 10 min. If you run an autonomous loop with `pollMinutes` > 10, the heartbeat goes stale *between* wakes and real orders block until the next wake re-pings. For autonomous **real** trading keep `pollMinutes ≤ 10` (or have the agent re-heartbeat between wakes). 30 min is fine for research-only.

## Security & secrets

- **This is a localhost, single-user tool with no authentication.** Every API route is open, including the real-money trade endpoints. **Do not expose the port** (no `0.0.0.0` bind, no tunnel/reverse-proxy to the internet). Anyone who can reach the port can move real money.
- **Secrets live in two places, both gitignored — keep them that way:**
  - `.env.local` — the Finnhub API key.
  - `marketpulse.db` — the Telegram **bot token** and **chat id** (stored in plaintext), plus runtime state. `marketpulse.db*` and `/context/` are in `.gitignore`; never commit them or share the DB file.
- **No API keys belong in source.** The app has no AI key (Claude Code is the AI); never hardcode the Finnhub key or Telegram token.

## Tests

`npm test` runs the Vitest suite. The Trade Fence (the money-path safety logic) is unit-tested in `lib/trading/fence.test.ts` — run it after any change to `fence.ts`.

---

## Quick verification

```bash
# Is the app up?            → http://localhost:3000
curl -s localhost:3000/api/agent/config        # mode, halt, broker, fence
curl -s localhost:3000/api/agent/robinhood/heartbeat   # connected? age vs 10-min TTL
curl -s localhost:3000/api/agent/robinhood/portfolio   # connection + last real snapshot
```
