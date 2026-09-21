import { NextResponse } from "next/server";

const UA = { "User-Agent": "Mozilla/5.0" };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const url =
    `https://lite-api.jup.ag/swap/v1/quote?` +
    `inputMint=${searchParams.get("inputMint")}` +
    `&outputMint=${searchParams.get("outputMint")}` +
    `&amount=${searchParams.get("amount")}` +
    `&slippageBps=${searchParams.get("slippageBps")}`;

  const res = await fetch(url, { headers: UA });

  if (!res.ok) {
    return NextResponse.json(
      { error: "No route found for this pair" },
      { status: 404 }
    );
  }

  return NextResponse.json(await res.json());
}
