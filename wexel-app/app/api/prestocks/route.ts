import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  const res = await fetch("https://prestocks.com/api/prestocks", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "PreStocks unavailable" }, { status: 502 });
  }

  const data = await res.json();

  const tokens = (data as any[]).map((t) => {
    const tokenPrice = Number(t.tokenPrice ?? 0);
    const markPrice = Number(t.markPrice ?? 0);
    return {
      symbol: t.symbol,
      name: t.name,
      description: t.description,
      image: t.image,
      mint: t.contract_address,
      tokenPrice,
      markPrice,
      // How far the market has drifted from the issuer's fair value.
      premiumPct: markPrice > 0 ? ((tokenPrice - markPrice) / markPrice) * 100 : 0,
      supply: t.supply,
      valuation: t.impliedValuation,
    };
  });

  return NextResponse.json(tokens);
}
