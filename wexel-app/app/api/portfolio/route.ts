import { NextResponse } from "next/server";
import { cached, fetchJson, UA } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const STABLES = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

async function rpc(url: string, method: string, params: any[]) {
  const j = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, 8000);
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

async function metadata(mint: string) {
  try {
    const { data } = await cached(`meta:${mint}`, 86_400_000, async () => {
      const list = await fetchJson(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`, { headers: UA });
      return (list as any[]).find((t) => t.id === mint) ?? null;
    });
    if (data) return { symbol: data.symbol, name: data.name, icon: data.icon, isStock: /^[A-Z0-9.]+x$/.test(data.symbol ?? "") };
  } catch {}
  return { symbol: `${mint.slice(0, 4)}…${mint.slice(-4)}`, name: "Unknown token", icon: undefined, isStock: false };
}

export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner");
  if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_RPC_URL;
  if (!url) return NextResponse.json({ error: "RPC not configured" }, { status: 500 });

  // Balances are the one thing we can't fake or guess — if the chain is
  // unreachable, report it instead of returning an empty wallet.
  const held: any[] = [];
  try {
    for (const programId of ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]) {
      const result = await rpc(url, "getTokenAccountsByOwner", [owner, { programId }, { encoding: "jsonParsed" }]);
      for (const a of result?.value ?? []) {
        const info = a.account.data.parsed.info;
        const amount = Number(info.tokenAmount.uiAmount);
        if (amount > 0) held.push({ mint: info.mint, amount, raw: info.tokenAmount.amount,
          decimals: info.tokenAmount.decimals, account: a.pubkey, programId });
      }
    }
    const lamports = (await rpc(url, "getBalance", [owner]))?.value ?? 0;
    if (lamports > 0) held.push({ mint: SOL_MINT, amount: lamports / 1e9, raw: String(lamports),
      decimals: 9, account: owner, programId: "native" });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Solana" }, { status: 503 });
  }

  if (!held.length) return NextResponse.json({ totalUsd: 0, holdings: [] });

  // Prices and PreStocks are enrichment: if they fail we still return the
  // balances, flagged as partial so the UI can say so.
  let partial = false;

  let prices: any = {};
  try {
    const ids = held.map((h) => h.mint).sort().join(",");
    prices = (await cached(`prices:${ids}`, 20_000, () =>
      fetchJson(`https://lite-api.jup.ag/price/v3?ids=${ids}`, { headers: UA }))).data;
  } catch { partial = true; }

  const pre = new Map<string, any>();
  try {
    const { data } = await cached("prestocks", 60_000, () =>
      fetchJson("https://prestocks.com/api/prestocks", { headers: UA }));
    for (const t of data as any[]) pre.set(t.contract_address, t);
  } catch {}

  const holdings = await Promise.all(held.map(async (h) => {
    const p = pre.get(h.mint);
    const meta = h.mint === SOL_MINT
      ? { symbol: "SOL", name: "Solana", icon: undefined, isStock: false }
      : p ? { symbol: p.symbol, name: p.name, icon: p.image, isStock: true }
          : await metadata(h.mint);
    // PreStocks use the issuer's price — Jupiter ignores their balance multiplier.
    const price = p ? Number(p.tokenPrice ?? 0) : Number(prices[h.mint]?.usdPrice ?? 0);
    return { ...h, ...meta, price, change24h: Number(prices[h.mint]?.priceChange24h ?? 0),
             valueUsd: h.amount * price, isStable: STABLES.has(h.mint), isPre: Boolean(p) };
  }));

  const totalUsd = holdings.reduce((s, h) => s + h.valueUsd, 0);
  const withShare = holdings
    .map((h) => ({ ...h, share: totalUsd > 0 ? (h.valueUsd / totalUsd) * 100 : 0 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  return NextResponse.json({ totalUsd, holdings: withShare, partial });
}
