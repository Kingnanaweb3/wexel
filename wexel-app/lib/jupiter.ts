// Jupiter routes a swap between any two tokens that have liquidity.
// That's what lets a user buy a stock with whatever they already hold.

const JUP_API = "https://quote-api.jup.ag/v6";

// Jupiter rejects requests without a browser-like User-Agent.
const JUP_HEADERS = { "User-Agent": "Mozilla/5.0" };

export type Quote = {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
  [k: string]: any;
};

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<Quote> {
  const url =
    `${JUP_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amount}&slippageBps=${slippageBps}`;

  const res = await fetch(url, { headers: JUP_HEADERS });
  if (!res.ok) {
    // Common cause: the input token has no liquid route to this stock.
    throw new Error(`No route found (${res.status})`);
  }
  return res.json();
}

// Turns a quote into a transaction the user's wallet can sign.
export async function getSwapTransaction(
  quote: Quote,
  userPublicKey: string
): Promise<string> {
  const res = await fetch(`${JUP_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...JUP_HEADERS },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });

  if (!res.ok) throw new Error(`Swap build failed: ${res.status}`);

  const { swapTransaction } = await res.json();
  return swapTransaction;
}
