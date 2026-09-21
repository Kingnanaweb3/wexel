import { NextResponse } from "next/server";

const UA = { "User-Agent": "Mozilla/5.0" };

export async function POST(req: Request) {
  const { quote, user } = await req.json();

  const res = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...UA },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: user,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }

  return NextResponse.json(await res.json());
}
