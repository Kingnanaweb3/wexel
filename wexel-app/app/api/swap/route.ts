import { NextResponse } from "next/server";
import { fetchJson, UA } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { quote, user } = await req.json();
  try {
    const r = await fetchJson("https://lite-api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA },
      body: JSON.stringify({
        quoteResponse: quote, userPublicKey: user,
        wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
      }),
    }, 10000);
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "Could not build the trade" }, { status: 502 });
  }
}
