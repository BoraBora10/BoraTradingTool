"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-runs the current server component on an interval via router.refresh(), so
// live data (quotes, movers, news) keeps ticking without a manual reload. The
// pages are force-dynamic, so each refresh re-fetches fresh data. Pauses while
// the browser tab is hidden to avoid pointless fetches / provider rate-limit
// pressure, and refreshes once immediately on becoming visible again.
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
