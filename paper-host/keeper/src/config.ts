import * as dotenv from "dotenv";
import * as fs from "fs";
import { Keypair } from "@solana/web3.js";
dotenv.config();

export const CONFIG = {
  rpcUrl: process.env.RPC_URL || "https://api.devnet.solana.com",
  programId: process.env.PROGRAM_ID || "8kUZWkfcVpwv55LrjrnSAm5q67zV2dnn3xGqJrfqEnz5",
  pollSeconds: Number(process.env.POLL_INTERVAL || 30),
};

// Locally we read the keypair file. On Railway there is no file, so the
// secret comes from an env var instead — a JSON array, as in id.json.
export function loadKeypair(): Keypair {
  if (process.env.KEEPER_SECRET_KEY) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.KEEPER_SECRET_KEY)));
  }
  const path = process.env.KEYPAIR_PATH || `${process.env.HOME}/.config/solana/id.json`;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf-8"))));
}
