import { getProvider } from "@/lib/providers";

export interface LatestQuote {
  price: number;
  /** true when the price is simulated demo data, not a live quote. */
  mock: boolean;
}

/** Latest quote (price + liveness) for a ticker via the data provider. */
export async function getLatestQuote(ticker: string): Promise<LatestQuote | null> {
  try {
    const q = await getProvider().getQuote(ticker);
    if (!q || !q.price) return null;
    return { price: q.price, mock: q.mock === true };
  } catch {
    return null;
  }
}

/** Latest price only. Returns null if unavailable. */
export async function getLatestPrice(ticker: string): Promise<number | null> {
  return (await getLatestQuote(ticker))?.price ?? null;
}
