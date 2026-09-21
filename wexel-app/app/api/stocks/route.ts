import { NextResponse } from "next/server";
import { cached, fetchJson, UA } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const FEATURED = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "SPY", "QQQ", "COIN"];

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q");
  const tickers = q ? [q.toUpperCase()] : FEATURED;

  const results = await Promise.allSettled(tickers.map((t) =>
    cached(`stock:${t}`, 30_000, async () => {
      const list = await fetchJson(`https://lite-api.jup.ag/tokens/v2/search?query=${t}x`, { headers: UA });
      return (list as any[]).find((x) => x.symbol === `${t}x`) ?? null;
    })));

  // Every lookup failed with nothing cached: say so, don't pretend it's empty.
  if (results.every((r) => r.status === "rejected")) {
    return NextResponse.json({ error: "Market data unavailable" }, { status: 503 });
  }

  const stocks = results
    .flatMap((r) => (r.status === "fulfilled" && r.value.data ? [r.value.data] : []))
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
    .filter((s) => s.liquidity > 1000);

  return NextResponse.json(stocks);
}
