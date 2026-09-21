// PreStocks are tokenized pre-IPO companies (OpenAI, SpaceX, Anthropic...).
//
// IMPORTANT: these are Token-2022 mints using the ScaledUiAmount extension.
// Jupiter reports raw units, so a token with a 5x multiplier looks 400% too
// expensive unless the multiplier is applied. We read it from the issuer API
// rather than trusting the raw quote.

const PRESTOCKS_API = "https://prestocks.com/api/prestocks";
const UA = { "User-Agent": "Mozilla/5.0" };

export type PreStock = {
  symbol: string;      // "OPENAI"
  name: string;
  mint: string;
  tokenPrice: number;  // what it trades at on-chain
  markPrice: number;   // the issuer's reference valuation
  premiumPct: number;  // how far the market has drifted from the mark
  multiplier: number;  // ScaledUiAmount factor
};

export async function fetchPreStocks(): Promise<PreStock[]> {
  const res = await fetch(PRESTOCKS_API, { headers: UA });
  if (!res.ok) throw new Error(`PreStocks API failed: ${res.status}`);

  const data = await res.json();
  const list = Array.isArray(data) ? data : [];

  return list.map((t: any) => {
    const tokenPrice = Number(t.tokenPrice ?? 0);
    const markPrice = Number(t.markPrice ?? 0);

    return {
      symbol: t.symbol,
      name: t.name ?? t.symbol,
      mint: t.contract_address,
      tokenPrice,
      markPrice,
      premiumPct: markPrice > 0 ? ((tokenPrice - markPrice) / markPrice) * 100 : 0,
      multiplier: Number(t.multiplier ?? 1),
    };
  });
}

// Pre-IPO prices move on single trades, so we let users BUY these but never
// let a rule trigger on them. Stated plainly in the UI rather than hidden.
export const PREIPO_AUTOMATION_ALLOWED = false;
