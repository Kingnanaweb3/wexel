import { NextResponse } from "next/server";
import { fetchJson, UA } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${p.get("inputMint")}` +
    `&outputMint=${p.get("outputMint")}&amount=${p.get("amount")}&slippageBps=${p.get("slippageBps")}`;
  try {
    return NextResponse.json(await fetchJson(url, { headers: UA }));
  } catch {
    return NextResponse.json({ error: "No route for this pair" }, { status: 404 });
  }
}
