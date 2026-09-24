#!/bin/bash
# Starts paper trading: mainnet fork -> Wexel program -> keeper -> app.
# Stop everything with Ctrl+C. Restart before each recording for fresh pools.
cd ~/wexel || exit 1
UPSTREAM="${UPSTREAM:-https://api.mainnet-beta.solana.com}"
FORK=http://127.0.0.1:8899

cleanup() { echo; echo "stopping…"; kill $SURF $KEEP 2>/dev/null; exit 0; }
trap cleanup INT TERM

# Clear anything left from a previous run.
lsof -ti tcp:3000,3001,8899,8900,18488 | xargs kill -9 2>/dev/null
sleep 1

echo "1/4 starting mainnet fork…"
(cd fork && surfpool start -u "$UPSTREAM" --no-tui > /tmp/wexel-surfpool.log 2>&1) &
SURF=$!
for i in $(seq 1 60); do
  curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' $FORK | grep -q ok && break
  sleep 1
done
curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' $FORK | grep -q ok \
  || { echo "fork didn't start — see /tmp/wexel-surfpool.log"; cleanup; }

echo "2/4 deploying Wexel onto the fork…"
sleep 3
solana airdrop 10 --url $FORK > /dev/null
for attempt in 1 2 3; do
  solana program deploy wexel_program/target/deploy/wexel_program.so \
    --program-id wexel_program/target/deploy/wexel_program-keypair.json --url $FORK \
    --max-sign-attempts 30 > /tmp/wexel-deploy.log 2>&1 && break
  [ $attempt = 3 ] && { echo "deploy failed — see /tmp/wexel-deploy.log and /tmp/wexel-surfpool.log"; cleanup; }
  echo "   deploy attempt $attempt failed, retrying…"; sleep 3
done

echo "3/4 starting keeper (Jupiter mode)…"
(cd wexel-keeper && RPC_URL=$FORK EXECUTOR=jupiter npm run keeper > /tmp/wexel-keeper.log 2>&1) &
KEEP=$!

echo "4/4 starting app in paper mode…"
echo
echo "   app        http://localhost:3000"
echo "   inspector  http://localhost:18488"
echo "   keeper log tail -f /tmp/wexel-keeper.log"
echo
cd wexel-app
NEXT_PUBLIC_MODE=paper NEXT_PUBLIC_RPC_URL=$FORK \
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v NEXT_PUBLIC_TEST_STOCK_MINT= \
  npx next dev -p 3000
cleanup
