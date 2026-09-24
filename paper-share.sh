#!/bin/bash
# Paper trading with a public link. Laptop must stay awake and online.
# Usage:  read -s "HKEY?Helius key: "; UPSTREAM="https://mainnet.helius-rpc.com/?api-key=$HKEY" ./paper-share.sh
cd ~/wexel || exit 1
export PATH="$HOME/.local/bin:$PATH"
UPSTREAM="${UPSTREAM:-https://api.mainnet-beta.solana.com}"
FORK=http://127.0.0.1:8899
PIDS=()

cleanup() { echo; echo "stopping…"; kill "${PIDS[@]}" 2>/dev/null; pkill -f "cloudflared tunnel --url" 2>/dev/null; exit 0; }
trap cleanup INT TERM

lsof -ti tcp:3000,3001,8899,8900,18488 | xargs kill -9 2>/dev/null
pkill -f "cloudflared tunnel --url" 2>/dev/null
sleep 1

echo "1/6 starting mainnet fork…"
(cd fork && surfpool start -u "$UPSTREAM" --no-tui > /tmp/wexel-surfpool.log 2>&1) & PIDS+=($!)
for i in $(seq 1 60); do
  curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' $FORK | grep -q ok && break
  sleep 1
done

echo "2/6 deploying Wexel onto the fork…"
sleep 3
solana airdrop 10 --url $FORK > /dev/null
for attempt in 1 2 3; do
  solana program deploy wexel_program/target/deploy/wexel_program.so \
    --program-id wexel_program/target/deploy/wexel_program-keypair.json --url $FORK \
    --max-sign-attempts 30 > /tmp/wexel-deploy.log 2>&1 && break
  [ $attempt = 3 ] && { echo "deploy failed — see /tmp/wexel-deploy.log"; cleanup; }
  echo "   retrying deploy…"; sleep 3
done

echo "3/6 starting keeper…"
(cd wexel-keeper && RPC_URL=$FORK EXECUTOR=jupiter npm run keeper > /tmp/wexel-keeper.log 2>&1) & PIDS+=($!)

echo "4/6 opening public tunnels…"
tunnel() {  # port, logfile -> prints the public https URL
  cloudflared tunnel --url "http://localhost:$1" --no-autoupdate > "$2" 2>&1 & PIDS+=($!)
  for i in $(seq 1 40); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$2" | head -1)
    [ -n "$url" ] && { echo "$url"; return; }
    sleep 1
  done
}
RPC_URL=$(tunnel 8899 /tmp/cf-rpc.log)
WS_HTTPS=$(tunnel 8900 /tmp/cf-ws.log)
APP_URL=$(tunnel 3000 /tmp/cf-app.log)
[ -z "$RPC_URL" ] || [ -z "$WS_HTTPS" ] || [ -z "$APP_URL" ] && { echo "a tunnel didn't open — see /tmp/cf-*.log"; cleanup; }
WS_URL="wss://${WS_HTTPS#https://}"

PAPER_ENV=(NEXT_PUBLIC_MODE=paper NEXT_PUBLIC_RPC_URL=$RPC_URL NEXT_PUBLIC_WS_URL=$WS_URL
           NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v NEXT_PUBLIC_TEST_STOCK_MINT=)

echo "5/6 building the app with the public addresses (~1 min)…"
(cd wexel-app && env "${PAPER_ENV[@]}" npx next build > /tmp/wexel-build.log 2>&1) \
  || { echo "build failed — see /tmp/wexel-build.log"; cleanup; }

echo "6/6 starting…"
(cd wexel-app && env "${PAPER_ENV[@]}" npx next start -p 3000 > /tmp/wexel-app.log 2>&1) & PIDS+=($!)
sleep 4

echo
echo "  ================================================"
echo "   SHARE THIS:  $APP_URL"
echo "  ================================================"
echo "   Testers: connect 'Wexel Practice Wallet', then tap 'Get \$1,000'."
echo "   Keep this window open and your laptop awake. Ctrl+C stops everything."
echo "   Restart every 1–2 hours for fresh prices (the link will change)."
echo
tail -f /tmp/wexel-keeper.log
