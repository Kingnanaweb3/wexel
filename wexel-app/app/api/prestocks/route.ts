import { NextResponse } from "next/server";
import { cached, fetchJson, UA } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data } = await cached("prestocks", 60_000, () =>
      fetchJson("https://prestocks.com/api/prestocks", { headers: UA }));

    return NextResponse.json((data as any[]).map((t) => {
      const tokenPrice = Number(t.tokenPrice ?? 0);
      const markPrice = Number(t.markPrice ?? 0);
      return {
        symbol: t.symbol, name: t.name, description: t.description, image: t.image,
        mint: t.contract_address, tokenPrice, markPrice,
        premiumPct: markPrice > 0 ? ((tokenPrice - markPrice) / markPrice) * 100 : 0,
        supply: t.supply, valuation: t.impliedValuation,
      };
    }));
  } catch {
    return NextResponse.json({ error: "PreStocks unavailable" }, { status: 503 });
  }
}
