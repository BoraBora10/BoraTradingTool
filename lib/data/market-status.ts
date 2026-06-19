export type MarketStatus = "open" | "closed" | "pre-market" | "after-hours";

export function getMarketStatus(): MarketStatus {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = nyTime.getDay(); // 0=Sun, 6=Sat
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const time = hours * 60 + minutes;

  if (day === 0 || day === 6) return "closed";

  const preMarketStart = 4 * 60;    // 4:00 AM
  const marketOpen = 9 * 60 + 30;   // 9:30 AM
  const marketClose = 16 * 60;      // 4:00 PM
  const afterHoursEnd = 20 * 60;    // 8:00 PM

  if (time < preMarketStart || time >= afterHoursEnd) return "closed";
  if (time < marketOpen) return "pre-market";
  if (time >= marketClose) return "after-hours";
  return "open";
}

export const MARKET_STATUS_STYLES: Record<MarketStatus, { label: string; cls: string; dot: string }> = {
  open: { label: "MARKET OPEN", cls: "text-gain", dot: "bg-gain animate-pulse" },
  closed: { label: "MARKET CLOSED", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
  "pre-market": { label: "PRE-MARKET", cls: "text-amber", dot: "bg-amber" },
  "after-hours": { label: "AFTER HOURS", cls: "text-amber", dot: "bg-amber" },
};
