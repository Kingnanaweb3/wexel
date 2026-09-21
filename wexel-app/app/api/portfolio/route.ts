import { NextResponse } from "next/server";

const UA = { "User-Agent": "Mozilla/5.0" };
const SOL_MINT = "So11111111111111111111111111111111111111112";

const STABLES = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

async function rpcCall(rpc: string, method: string, params: any[]) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await res.json()).result;
}

// Name, symbol and logo for a mint. Unknown mints (common on devnet) fall
// back to a shortened address rather than being dropped.
async function metadata(mint: string) {
  try {
    const res = await fetch(
      `https://lite-api.jup.ag/tokens/v2/search?query=${mint}`,
      { headers: UA }
    );
    const list = await res.json();
    const hit = Array.isArray(list) ? list.find((t: any) => t.id === mint) : null;
    if (hit) {
      return {
        symbol: hit.symbol,
        name: hit.name,
        icon: hit.icon,
        isStock: /^[A-Z0-9.]+x$/.test(hit.symbol ?? ""),
      };
    }
  } catch {}
  return {
    symbol: `${mint.slice(0, 4)}…${mint.slice(-4)}`,
    name: "Unknown token",
    icon: undefined,
    isStock: false,
  };
}

export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner");
  if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });

  const rpc = process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) return NextResponse.json({ totalUsd: 0, holdings: [] });

  const PROGRAMS = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022 (xStocks, PreStocks)
  ];

  const held: any[] = [];

  for (const programId of PROGRAMS) {
    const result = await rpcCall(rpc, "getTokenAccountsByOwner", [
      owner, { programId }, { encoding: "jsonParsed" },
    ]);
    for (const a of result?.value ?? []) {
      const info = a.account.data.parsed.info;
      const amount = Number(info.tokenAmount.uiAmount);
      // raw, decimals, account and programId are what a transfer needs.
      if (amount > 0) held.push({
        mint: info.mint, amount,
        raw: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
        account: a.pubkey,
        programId,
      });
    }
  }

  // Native SOL isn't a token account.
  const lamports = (await rpcCall(rpc, "getBalance", [owner]))?.value ?? 0;
  if (lamports > 0) held.push({
    mint: SOL_MINT, amount: lamports / 1e9,
    raw: String(lamports), decimals: 9, account: owner, programId: "native",
  });

  if (!held.length) return NextResponse.json({ totalUsd: 0, holdings: [] });

  // PreStocks: identify by mint, and take the issuer's price. Jupiter's
  // quote ignores the ScaledUiAmount multiplier and misprices them.
  const pre = new Map<string, any>();
  try {
    const r = await fetch("https://prestocks.com/api/prestocks", { headers: UA });
    for (const t of await r.json()) pre.set(t.contract_address, t);
  } catch {}

  // One price request for every mint.
  const ids = held.map(h => h.mint).join(",");
  const priceRes = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`, { headers: UA });
  const prices = priceRes.ok ? await priceRes.json() : {};

  const holdings = await Promise.all(held.map(async (h) => {
    const p = pre.get(h.mint);

    const meta = h.mint === SOL_MINT
      ? { symbol: "SOL", name: "Solana", icon: undefined, isStock: false }
      : p
        ? { symbol: p.symbol, name: p.name, icon: p.image, isStock: true }
        : await metadata(h.mint);

    const price = p
      ? Number(p.tokenPrice ?? 0)
      : Number(prices[h.mint]?.usdPrice ?? 0);
    const change = Number(prices[h.mint]?.priceChange24h ?? 0);

    return {
      ...h,
      ...meta,
      price,
      change24h: change,
      valueUsd: h.amount * price,
      isStable: STABLES.has(h.mint),
      isPre: Boolean(p),
    };
  }));

  const totalUsd = holdings.reduce((s, h) => s + h.valueUsd, 0);

  // Share of portfolio, largest first.
  const withShare = holdings
    .map(h => ({ ...h, share: totalUsd > 0 ? (h.valueUsd / totalUsd) * 100 : 0 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  return NextResponse.json({ totalUsd, holdings: withShare });
}
