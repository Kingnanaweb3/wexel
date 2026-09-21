import { NextResponse } from "next/server";

// Jupiter blocks requests without a browser-like User-Agent, and calling it
// from the browser would hit CORS. So we proxy it here.
const UA = { "User-Agent": "Mozilla/5.0" };

// The stocks we surface first. Users can search beyond this list.
const FEATURED = [
  "AAPL", "NVDA", "TSLA", "MSFT", "GOOGL",
  "AMZN", "META", "SPY", "QQQ", "COIN",
];

export const revalidate = 30; // cache for 30s so we don't hammer Jupiter

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  const tickers = query ? [query.toUpperCase()] : FEATURED;

  const results = await Promise.allSettled(
    tickers.map(async (t) => {
      const res = await fetch(
        `https://lite-api.jup.ag/tokens/v2/search?query=${t}x`,
        { headers: UA }
      );
      if (!res.ok) return null;
      const list = await res.json();
      return list.find((x: any) => x.symbol === `${t}x`) ?? null;
    })
  );

  const stocks = results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r: any) => r.value)
    .map((t: any) => ({
      symbol: t.symbol,
      ticker: t.symbol.replace(/x$/, ""),
      name: t.name,
      mint: t.id,
      decimals: t.decimals,
      icon: t.icon,
      price: t.usdPrice ?? 0,
      liquidity: t.liquidity ?? 0,
      change24h: t.stats24h?.priceChange ?? 0,
    }))
    // Never offer something the user can't actually trade.
    .filter((s: any) => s.liquidity > 1000);

  return NextResponse.json(stocks);
}
