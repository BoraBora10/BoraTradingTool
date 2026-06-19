// Process-wide TTL cache with single-flight and stale-on-error. This decouples
// how often clients poll from how often we hit the upstream data providers:
// however many browser tabs refresh, each cache key is fetched from Yahoo/Finnhub
// at most once per TTL window. Single-flight collapses concurrent misses into one
// request (no stampede), and on an upstream error we serve the last good value if
// we have one (so a transient 429 doesn't blank the UI).

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  // Coalesce concurrent misses for the same key into a single upstream call.
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = (async () => {
    try {
      const value = await fn();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } catch (err) {
      // Serve stale on error (e.g. provider rate-limited us) rather than blank.
      if (hit) return hit.value;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

// Bucket a unix-seconds timestamp to a TTL window so time-based args (e.g. candle
// from/to computed from Date.now() each render) produce a STABLE cache key within
// the window — otherwise the key changes every render and never hits.
export function timeBucket(unixSeconds: number, ttlMs: number): number {
  const w = Math.max(1, Math.floor(ttlMs / 1000));
  return Math.floor(unixSeconds / w);
}
