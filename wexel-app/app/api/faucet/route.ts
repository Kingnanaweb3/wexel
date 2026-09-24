import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// Paper mode only: $1,000 of real USDC and some SOL on the local fork, via
// Surfpool's balance cheatcode. Refuses to run anywhere else.
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_MODE !== "paper") {
    return NextResponse.json({ error: "Practice funds only exist in paper mode" }, { status: 403 });
  }
  const { owner } = await req.json();
  const rpc = process.env.NEXT_PUBLIC_RPC_URL!;

  const call = async (method: string, params: any[]) => {
    const r = await fetch(rpc, { method: "POST",
      headers: { "Content-Type": "application/json", "x-wexel-admin": process.env.ADMIN_TOKEN ?? "" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    return j.result;
  };

  try {
    await call("requestAirdrop", [owner, 2_000_000_000]);
    try {
      await call("surfnet_setTokenAccount", [owner, USDC, { amount: 1_000_000_000 }, TOKEN]);
    } catch {
      await call("surfnet_setTokenAccount", [{ owner, mint: USDC, tokenProgram: TOKEN, update: { amount: 1_000_000_000 } }]);
    }
    return NextResponse.json({ ok: true, usdc: 1000, sol: 2 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Fork unreachable" }, { status: 503 });
  }
}
