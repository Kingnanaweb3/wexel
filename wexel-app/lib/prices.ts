export type Quote = { price: number; icon?: string };

// Current price and logo for each ticker, fetched once in parallel.
export async function livePrices(tickers: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  await Promise.all([...new Set(tickers)].map(async (t) => {
    try {
      const list = await (await fetch(`/api/stocks?q=${encodeURIComponent(t)}`)).json();
      const hit = Array.isArray(list) ? list.find((s: any) => s.ticker === t) : null;
      if (hit?.price) out.set(t, { price: hit.price, icon: hit.icon });
    } catch {}
  }));
  return out;
}
