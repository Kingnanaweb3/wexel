const UA = { "User-Agent": "Mozilla/5.0" };

// One price per ticker per tick. xStocks are named "<TICKER>x".
export async function fetchPrices(tickers: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  await Promise.all([...new Set(tickers)].map(async (t) => {
    try {
      const res = await fetch(
        `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(t)}x`,
        { headers: UA }
      );
      if (!res.ok) return;
      const list = await res.json();
      const hit = list.find((x: any) => x.symbol === `${t}x`);
      if (hit?.usdPrice > 0) out.set(t, hit.usdPrice);
    } catch {
      // A missing price skips that rule this tick; it never fires on a guess.
    }
  }));

  return out;
}
