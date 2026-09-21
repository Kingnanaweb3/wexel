import { NextResponse } from "next/server";

// Jupiter only reports the current price, so history comes from Birdeye.
// Without a key this returns empty and the chart says so honestly.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint");
  const range = searchParams.get("range") ?? "1D";

  const key = process.env.BIRDEYE_API_KEY;
  if (!key || !mint) return NextResponse.json({ items: [] });

  // Candle size and lookback per range.
  const CONFIG: Record<string, { type: string; seconds: number }> = {
    "1D": { type: "15m", seconds: 86400 },
    "1W": { type: "1H",  seconds: 604800 },
    "1M": { type: "4H",  seconds: 2592000 },
    "1Y": { type: "1D",  seconds: 31536000 },
  };

  const cfg = CONFIG[range] ?? CONFIG["1D"];
  const now = Math.floor(Date.now() / 1000);

  const url =
    `https://public-api.birdeye.so/defi/ohlcv` +
    `?address=${mint}&type=${cfg.type}` +
    `&time_from=${now - cfg.seconds}&time_to=${now}`;

  try {
    const res = await fetch(url, {
      headers: { "X-API-KEY": key, "x-chain": "solana" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ items: [] });

    const json = await res.json();
    const items = (json.data?.items ?? []).map((c: any) => ({
      t: c.unixTime, c: c.c,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
