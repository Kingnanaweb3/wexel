import { NextResponse } from "next/server";
import { cached, fetchJson, UA } from "@/lib/upstream";

export const dynamic = "force-dynamic";

// GeckoTerminal: free, no API key. Price history comes from the stock's
// deepest pool — the most liquid market gives the most reliable price.
const GT = "https://api.geckoterminal.com/api/v2/networks/solana";

// Candle size and count per range, plus how long to cache it.
// The free tier allows ~30 requests a minute, so longer ranges cache longer.
const RANGES: Record<string, { tf: string; agg: number; limit: number; ttl: number }> = {
  "1D": { tf: "minute", agg: 15, limit: 96,  ttl: 60_000 },
  "1W": { tf: "hour",   agg: 1,  limit: 168, ttl: 5 * 60_000 },
  "1M": { tf: "hour",   agg: 4,  limit: 180, ttl: 15 * 60_000 },
  "1Y": { tf: "day",    agg: 1,  limit: 365, ttl: 60 * 60_000 },
};

async function deepestPool(mint: string): Promise<string | null> {
  const { data } = await cached(`pool:${mint}`, 60 * 60_000, async () => {
    const res = await fetchJson(`${GT}/tokens/${mint}/pools?page=1`, { headers: UA });
    const pools = (res.data ?? [])
      .map((p: any) => ({ address: p.attributes.address, usd: Number(p.attributes.reserve_in_usd ?? 0) }))
      .sort((a: any, b: any) => b.usd - a.usd);
    return pools[0]?.address ?? null;
  });
  return data;
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const mint = p.get("mint");
  const range = RANGES[p.get("range") ?? "1D"] ? (p.get("range") ?? "1D") : "1D";
  if (!mint) return NextResponse.json({ error: "mint required" }, { status: 400 });

  try {
    const pool = await deepestPool(mint);
    if (!pool) return NextResponse.json({ items: [], reason: "no market" });

    const cfg = RANGES[range];
    const { data: items, stale } = await cached(`ohlcv5:${pool}:${range}`, cfg.ttl, async () => {
      // token=<mint> prices the stock itself, whichever side of the pair it's on.
      const res = await fetchJson(
        `${GT}/pools/${pool}/ohlcv/${cfg.tf}?aggregate=${cfg.agg}&limit=${Math.min(1000, cfg.limit * 5)}&currency=usd&token=${mint}`,
        { headers: UA });
      // Rows are [time, open, high, low, close, volume], newest first.
      return (res.data?.attributes?.ohlcv_list ?? [])
        .map((r: number[]) => ({ t: r[0], c: r[4] }))
        .filter((r: any) => r.c > 0)
        .reverse();
    });

    return NextResponse.json({ items, stale, window: cfg.limit });
  } catch {
    return NextResponse.json({ items: [], reason: "unavailable" }, { status: 503 });
  }
}
