import { NextResponse } from "next/server";
import { cached, fetchJson, UA } from "@/lib/upstream";
import catalog from "@/lib/xstocks.json";

export const dynamic = "force-dynamic";

// Below this, fills get ugly — the app lists these but won't automate them.
const THIN = 10_000;

type Entry = { ticker: string; mint: string; name: string };
const ENTRIES = catalog as Entry[];

function shape(e: Entry, t: any) {
  const liquidity = t?.liquidity ?? 0;
  return {
    symbol: `${e.ticker}x`, ticker: e.ticker, name: t?.name ?? e.name, mint: e.mint,
    decimals: t?.decimals ?? 8, icon: t?.icon, price: t?.usdPrice ?? 0,
    liquidity, change24h: t?.stats24h?.priceChange ?? 0, thin: liquidity < THIN,
  };
}

// Every price in as few requests as possible (Jupiter takes up to 100 mints each).
async function resolve(entries: Entry[]) {
  const byMint = new Map<string, any>();
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const key = chunk.map((e) => e.mint).join(",");
    const { data } = await cached(`batch:${key}`, 30_000, () =>
      fetchJson(`https://lite-api.jup.ag/tokens/v2/search?query=${key}`, { headers: UA }, 8000));
    for (const t of data as any[]) byMint.set(t.id, t);
  }
  return entries.map((e) => shape(e, byMint.get(e.mint))).filter((s) => s.price > 0);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().toUpperCase();

  try {
    if (!q) return NextResponse.json(await resolve(ENTRIES));

    // Known xStocks first: exact ticker, then name or ticker prefix.
    const matches = ENTRIES.filter((e) =>
      e.ticker === q || e.ticker.startsWith(q) || e.name.toUpperCase().includes(q)).slice(0, 25);
    if (matches.length) return NextResponse.json(await resolve(matches));

    // Not in the catalog yet (a brand-new listing): ask Jupiter directly.
    const list = await fetchJson(`https://lite-api.jup.ag/tokens/v2/search?query=${q}x`, { headers: UA });
    const hit = (list as any[]).find((t) => t.symbol === `${q}x` && String(t.id).startsWith("Xs"));
    return NextResponse.json(hit ? [shape({ ticker: q, mint: hit.id, name: hit.name }, hit)] : []);
  } catch {
    return NextResponse.json({ error: "Market data unavailable" }, { status: 503 });
  }
}
