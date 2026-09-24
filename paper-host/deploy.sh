#!/bin/bash
# Prerequisites (once):  npm i -g @railway/cli && railway login && cd ~/wexel/paper-host && railway init
set -e
cd ~/wexel/paper-host
ADMIN=$(cat .admin-token)

echo "1/5 uploading and building on Railway (first build ~10 min)…"
railway up --detach

echo "2/5 setting Railway secrets…"
read -s "HKEY?Helius key: " 2>/dev/null || read -s -p "Helius key: " HKEY; echo
railway variables --set "UPSTREAM=https://mainnet.helius-rpc.com/?api-key=$HKEY" \
                  --set "KEEPER_SECRET_KEY=$(cat ~/.config/solana/id.json)" \
                  --set "PROGRAM_KEYPAIR=$(cat ../wexel_program/target/deploy/wexel_program-keypair.json)" \
                  --set "ADMIN_TOKEN=$ADMIN" > /dev/null
echo "   secrets set"

echo "3/5 public address…"
DOMAIN=$(railway domain 2>&1 | grep -o '[a-z0-9.-]*\.up\.railway\.app' | head -1)
[ -z "$DOMAIN" ] && { echo "couldn't read the Railway domain — run 'railway domain' and tell Claude"; exit 1; }
echo "   https://$DOMAIN"

echo "4/5 pointing Vercel at the sandbox…"
cd ../wexel-app
for V in NEXT_PUBLIC_MODE NEXT_PUBLIC_RPC_URL NEXT_PUBLIC_WS_URL NEXT_PUBLIC_USDC_MINT NEXT_PUBLIC_TEST_STOCK_MINT ADMIN_TOKEN; do
  npx vercel env rm $V production --yes > /dev/null 2>&1 || true
done
printf "paper" | npx vercel env add NEXT_PUBLIC_MODE production > /dev/null
printf "https://$DOMAIN" | npx vercel env add NEXT_PUBLIC_RPC_URL production > /dev/null
printf "wss://$DOMAIN" | npx vercel env add NEXT_PUBLIC_WS_URL production > /dev/null
printf "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" | npx vercel env add NEXT_PUBLIC_USDC_MINT production > /dev/null
printf "$ADMIN" | npx vercel env add ADMIN_TOKEN production --sensitive > /dev/null
echo "   done"

echo "5/5 redeploying the app…"
npx vercel --prod
echo
echo "Sandbox health:  curl https://$DOMAIN   (should say 'wexel paper sandbox')"
echo "Railway logs:    cd ~/wexel/paper-host && railway logs"
