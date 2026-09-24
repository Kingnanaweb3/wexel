#!/bin/bash
# Secrets arrive as Railway variables and are written to files here only.
mkdir -p /root/.config/solana
echo "$KEEPER_SECRET_KEY" > /root/.config/solana/id.json
echo "$PROGRAM_KEYPAIR" > /app/program-keypair.json

FORK=http://127.0.0.1:8899
RESET_HOURS=${RESET_HOURS:-2}
health() { curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' $FORK | grep -q ok; }

node proxy.js &

while true; do
  echo "[paper] starting fork from mainnet"
  mkdir -p /app/fork && cd /app/fork
  surfpool start -u "$UPSTREAM" --no-tui > /tmp/surfpool.log 2>&1 &
  SURF=$!
  cd /app
  for i in $(seq 1 120); do health && break; sleep 1; done

  sleep 3
  solana airdrop 10 --url $FORK > /dev/null
  # Keep trying: without the program, rules can't run at all.
  attempt=0
  until solana program show /app/program-keypair.json --url $FORK > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ $attempt -gt 8 ] && { echo "[paper] giving up on deploy"; break; }
    echo "[paper] deploying (attempt $attempt)…"
    solana program deploy /app/wexel_program.so --program-id /app/program-keypair.json \
      --url $FORK --max-sign-attempts 50 --with-compute-unit-price 50000 > /tmp/deploy.log 2>&1 \
      || { echo "[paper] deploy failed:"; tail -5 /tmp/deploy.log; }
    solana program close --buffers --url $FORK > /dev/null 2>&1
    sleep 5
  done
  solana program show /app/program-keypair.json --url $FORK > /dev/null 2>&1 \
    && echo "[paper] program is live on the fork" 

  (cd keeper && RPC_URL=$FORK EXECUTOR=jupiter npx tsx src/keeper.ts) &
  KEEP=$!

  echo "[paper] ready — next reset in ${RESET_HOURS}h"
  sleep $((RESET_HOURS * 3600))
  echo "[paper] resetting for fresh pool data"
  kill $KEEP $SURF 2>/dev/null; sleep 5
done
