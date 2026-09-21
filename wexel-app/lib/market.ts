// Pyth's feed catalogue is still public and free — we no longer use it for
// prices (equity feeds are a paid tier), but it tells us when the
// traditional market is open, which is the whole point of trading on-chain.

const HERMES = "https://hermes.pyth.network";

export type MarketInfo = {
  ticker: string;
  isOpen: boolean;
  nextOpen: number | null;
  nextClose: number | null;
};

let cache: Map<string, MarketInfo> | null = null;

export async function loadMarketHours(): Promise<Map<string, MarketInfo>> {
  if (cache) return cache;

  const res = await fetch(`${HERMES}/v2/price_feeds?asset_type=equity`);
  if (!res.ok) throw new Error(`Market hours fetch failed: ${res.status}`);

  const feeds = await res.json();
  const map = new Map<string, MarketInfo>();

  for (const f of feeds as any[]) {
    const m = (f.attributes?.symbol ?? "").match(/^Equity\.US\.([A-Z0-9.]+)\/USD$/);
    if (!m) continue;

    map.set(m[1], {
      ticker: m[1],
      isOpen: f.market_hours?.is_open ?? false,
      nextOpen: f.market_hours?.next_open ?? null,
      nextClose: f.market_hours?.next_close ?? null,
    });
  }

  cache = map;
  return map;
}

export async function isMarketOpen(ticker: string): Promise<boolean> {
  const hours = await loadMarketHours();
  return hours.get(ticker.toUpperCase())?.isOpen ?? false;
}
