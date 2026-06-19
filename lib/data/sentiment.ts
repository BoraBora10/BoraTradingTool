// Lightweight lexical sentiment for financial news headlines.
//
// Finnhub's /news and /company-news endpoints return NO per-article sentiment
// field, so the app used to default every article to 0 (neutral). This derives a
// coarse score from the text instead — a finance-tuned word list, matched on whole
// words. It's not a deep NLP model, but it's deterministic, dependency-free, and far
// better than marking everything neutral. (For nuanced scoring, an AI pass is the
// upgrade — see the AI-analyst layer.)

const POSITIVE = new Set([
  "surge", "surges", "surged", "soar", "soars", "soared", "jump", "jumps", "jumped",
  "rally", "rallies", "rallied", "gain", "gains", "gained", "rise", "rises", "rose",
  "beat", "beats", "tops", "topped", "record", "high", "highs", "upgrade", "upgraded",
  "upgrades", "outperform", "bullish", "strong", "stronger", "growth", "grow", "grows",
  "profit", "profits", "raises", "raised", "boost", "boosts", "boosted", "win", "wins",
  "approval", "approved", "breakthrough", "optimistic", "rebound", "rebounds", "recovery",
  "expands", "expansion", "buyback", "dividend", "soaring", "jumping", "climbs", "climbed",
  "rallying", "momentum", "milestone", "exceeds", "exceeded", "accelerates", "wins",
]);

const NEGATIVE = new Set([
  "plunge", "plunges", "plunged", "plummet", "plummets", "fall", "falls", "fell",
  "drop", "drops", "dropped", "slump", "slumps", "slide", "slides", "sink", "sinks",
  "sank", "miss", "misses", "missed", "downgrade", "downgraded", "downgrades",
  "underperform", "bearish", "weak", "weaker", "loss", "losses", "cut", "cuts",
  "warning", "warn", "warns", "lawsuit", "probe", "investigation", "fraud", "bankruptcy",
  "layoffs", "recall", "halts", "halt", "slashes", "slashed", "fears", "concerns",
  "selloff", "crash", "crashes", "tumble", "tumbles", "sinking", "falling", "plunging",
  "risk", "risks", "decline", "declines", "declined", "scrapped", "delays", "delayed",
]);

/**
 * Score a headline (+ optional summary) from -1 (very negative) to +1 (very
 * positive). Returns 0 only when no sentiment words are found — i.e. genuinely
 * neutral, not a default.
 */
export function scoreSentiment(headline: string, summary = ""): number {
  const text = `${headline} ${summary}`.toLowerCase();
  const words = text.split(/[^a-z]+/);
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    if (POSITIVE.has(w)) pos++;
    else if (NEGATIVE.has(w)) neg++;
  }
  if (pos === 0 && neg === 0) return 0;
  // Normalize to [-1, 1] by net polarity over total hits.
  return +((pos - neg) / (pos + neg)).toFixed(2);
}
