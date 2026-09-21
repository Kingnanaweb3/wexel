// The xStocks catalogue is 700+ names and grows weekly, so nothing is
// hardcoded. We resolve the tradable list at runtime.

export type Stock = {
  symbol: string;      // "AAPLx"
  ticker: string;      // "AAPL" — used to find the Pyth feed
  name: string;        // "Apple xStock"
  mint: string;        // SPL / Token-2022 mint address
  decimals: number;
  icon?: string;
  tokenProgram: string;
  onChainPrice: number; // what the token trades at on Solana right now
  liquidity: number;    // how much depth exists — low means bad fills
};

const JUP_SEARCH = "https://lite-api.jup.ag/tokens/v2/search";

// Jupiter rejects requests without a browser-like User-Agent.
const JUP_HEADERS = { "User-Agent": "Mozilla/5.0" };

// Jupiter's search is the reliable path — tag queries are rejected.
export async function searchStock(query: string): Promise<Stock[]> {
  const res = await fetch(`${JUP_SEARCH}?query=${encodeURIComponent(query)}`, {
    headers: JUP_HEADERS,
  });
  if (!res.ok) throw new Error(`Jupiter search failed: ${res.status}`);

  const results = await res.json();

  return (results as any[])
    // xStocks are named "<TICKER>x" and issued by Backed.
    .filter((t) => /^[A-Z0-9.]+x$/.test(t.symbol ?? ""))
    .map(toStock);
}

function toStock(t: any): Stock {
  return {
    symbol: t.symbol,
    ticker: t.symbol.replace(/x$/, ""),
    name: t.name,
    mint: t.id,
    decimals: t.decimals,
    icon: t.icon,
    tokenProgram: t.tokenProgram,
    onChainPrice: t.usdPrice ?? 0,
    liquidity: t.liquidity ?? 0,
  };
}

// Resolves a batch of tickers into tradable stocks, skipping any with
// no real liquidity — a user should never be offered a stock they can't buy.
export async function loadStocks(
  tickers: string[],
  minLiquidity = 1000
): Promise<Stock[]> {
  const settled = await Promise.allSettled(
    tickers.map((t) => searchStock(`${t}x`))
  );

  const stocks: Stock[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const exact = r.value.find((s) => s.liquidity >= minLiquidity);
    if (exact) stocks.push(exact);
  }

  return stocks.sort((a, b) => b.liquidity - a.liquidity);
}
