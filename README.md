# MarketPulse

A Bloomberg Terminal-style stock research web app. Self-hosted. AI-powered via Claude Code in your terminal.

## What it does

- **Stock Analyzer** — full research page per ticker: live quote, candlestick chart (TradingView Lightweight Charts), technicals (RSI, MACD, Bollinger Bands, SMAs), fundamentals, analyst ratings, earnings history, insider activity, news, bull/bear signals, and a Research Report.
- **Market Dashboard** — indices, sector heatmap, top movers, market status, news feed.
- **Watchlist** — curated tech/AI positions with thesis, catalysts, and risk levels.
- **News Feed** — market news with sentiment scores.
- **Claude Code integration** — the app writes context files that Claude Code reads for AI-powered analysis and optional trading via Robinhood MCP.

## Quick start

```bash
git clone <your-repo-url>
cd marketpulse
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 — on first run you'll be prompted to enter a **free Finnhub API key**. MarketPulse uses **real market data only — there is no demo/mock mode**, so a key is required before the app loads. (Prices and charts come from Yahoo; Finnhub supplies fundamentals, ratings, earnings, insider activity, and news.)

> **Setting up fully (data, real-money trading, notifications)?** Follow [`SETUP.md`](./SETUP.md) — the operator checklist of everything required to make the system fully functional, plus the per-session checklist any Claude Code agent runs.

## API Keys

### Finnhub (required — free tier is generous)

The app will not load without a key — the first-run screen prompts for one.

1. Sign up at https://finnhub.io
2. Copy your API key
3. Paste it into the first-run setup screen (or `/settings`), which saves it to `.env.local`.
   You can also set it directly:
   ```
   FINNHUB_API_KEY=your_key_here
   ```

Free tier includes: real-time quotes, candles, company profile, financials, earnings, insider transactions, analyst ratings, news. **There is no mock/demo mode** — missing data shows as "unavailable", never fabricated.

## Claude Code (AI layer)

MarketPulse has no AI API key. Claude Code running in your terminal **is** the AI.

```bash
npm install -g @anthropic-ai/claude-code
claude
```

When you view a stock page, the app writes `context/stock-TICKER.json`. Paste the generated prompt from the stock page into your Claude Code session.

## Robinhood MCP (optional trading)

See `/settings` in the app for setup instructions. **All trading is real money** — there is no paper/simulated mode. Orders only place when the trading **mode** permits it (not `off`/`halt`), the Robinhood MCP heartbeat is live, the agent has synced your portfolio, and the order clears the Trade Fence. See [`SETUP.md`](./SETUP.md).

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Lightweight Charts (TradingView) |
| Database | SQLite + Drizzle ORM |
| Data | Yahoo (quotes/charts/targets/movers) + Finnhub (fundamentals/news; required) |
| AI | Claude Code (terminal) |

## Routes

| Route | Description |
|-------|-------------|
| `/` | → redirect to dashboard |
| `/dashboard` | Market overview |
| `/analyze/[ticker]` | Stock analyzer (anchor feature) |
| `/watchlist` | Tech watchlist |
| `/news` | News feed |
| `/portfolio` | Portfolio (requires Robinhood MCP) |
| `/settings` | API keys, Claude Code setup |

## Disclaimer

**Not financial advice.** All data is for informational purposes only. Research signals are model-generated opinions, not investment recommendations. Always consult a licensed financial advisor.

**Real-money trading is at your own risk.** MarketPulse has no paper/simulated mode — every order placed through the trading feature uses real funds in your connected Robinhood account. The authors accept no liability for losses. The optional trading feature uses Robinhood's **official Agentic Trading MCP** (`agent.robinhood.com/mcp/trading`, per Robinhood's "Connect your AI agent" docs); you're still responsible for complying with Robinhood's terms. Trading is **off by default** (`mode: off`) — you must explicitly set a mode (Confirm or Autopilot) before anything can place.

**Localhost only.** The app has no authentication. Run it locally and never expose the port to the internet; anyone who can reach it can move real money. See [`SETUP.md`](./SETUP.md) for the full security/secrets notes.
