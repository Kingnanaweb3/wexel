import {
  BaseSignerWalletAdapter, WalletName, WalletReadyState, WalletNotConnectedError,
  type TransactionOrVersionedTransaction,
} from "@solana/wallet-adapter-base";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";

export const PaperWalletName = "Wexel Practice Wallet" as WalletName<"Wexel Practice Wallet">;
const KEY = "wexel-paper-key";

// A wallet that lives in the browser, for paper trading only. It keeps the
// same key across reloads so practice balances don't vanish mid-demo.
// Never used outside paper mode: the key is stored in plain localStorage.
export class PaperWalletAdapter extends BaseSignerWalletAdapter {
  name = PaperWalletName;
  url = "https://github.com/Kingnanaweb3/wexel";
  icon = "data:image/svg+xml;base64," + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#5468F5"/>' +
    '<text x="16" y="22" font-size="16" text-anchor="middle" fill="white" font-family="sans-serif">P</text></svg>');
  supportedTransactionVersions = new Set(["legacy", 0] as const);

  private _kp: Keypair | null = null;
  private _connecting = false;

  get publicKey(): PublicKey | null { return this._kp?.publicKey ?? null; }
  get connecting() { return this._connecting; }
  get readyState() { return WalletReadyState.Loadable; }

  async connect() {
    this._connecting = true;
    try {
      const saved = localStorage.getItem(KEY);
      this._kp = saved ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved))) : Keypair.generate();
      localStorage.setItem(KEY, JSON.stringify(Array.from(this._kp.secretKey)));
      this.emit("connect", this._kp.publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect() {
    this._kp = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends TransactionOrVersionedTransaction<this["supportedTransactionVersions"]>>(tx: T): Promise<T> {
    if (!this._kp) throw new WalletNotConnectedError();
    if (tx instanceof VersionedTransaction) tx.sign([this._kp]);
    else (tx as any).partialSign(this._kp);
    return tx;
  }
}
