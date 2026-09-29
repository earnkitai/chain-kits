#!/usr/bin/env bash
# Deploy UsdcTipJar to Arc and verify it. Reads settings from .env (see .env.example).
#   ./deploy.sh                       # Arc testnet
#   NETWORK=arc CONFIRM_MAINNET=1 ./deploy.sh   # Arc mainnet (real USDC)
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi

: "${PRIVATE_KEY:?Set PRIVATE_KEY in arc/example/.env (copy .env.example). Get test USDC at https://faucet.circle.com}"
NETWORK="${NETWORK:-arc_testnet}"
case "$NETWORK" in
  arc_testnet) CHAIN_ID=5042002; RPC=https://rpc.testnet.arc.io; EXPLORER=https://explorer.testnet.arc.io ;;
  arc)
    CHAIN_ID=5042; RPC=https://rpc.mainnet.arc.io; EXPLORER=https://explorer.arc.io
    [ "${CONFIRM_MAINNET:-}" = "1" ] || { echo "NETWORK=arc spends real USDC. Re-run with CONFIRM_MAINNET=1."; exit 1; } ;;
  *) echo "NETWORK must be arc_testnet or arc (got '$NETWORK')"; exit 1 ;;
esac

DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
OWNER="${OWNER:-$DEPLOYER}"
BALANCE=$(cast call 0x3600000000000000000000000000000000000000 'balanceOf(address)(uint256)' "$DEPLOYER" --rpc-url "$RPC" | awk '{print $1}')
echo "Deployer $DEPLOYER on $NETWORK has $(awk "BEGIN{print $BALANCE/1e6}") USDC"
[ "$BALANCE" -gt 10000 ] || { echo "Needs a little USDC for gas (testnet: https://faucet.circle.com)."; exit 1; }

forge build --quiet
OUT=$(forge create src/UsdcTipJar.sol:UsdcTipJar --rpc-url "$RPC" --private-key "$PRIVATE_KEY" \
  --broadcast --json --constructor-args "$OWNER" 2>&1) || { echo "$OUT"; exit 1; }
JAR=$(printf '%s' "$OUT" | sed -n 's/.*"deployedTo": *"\(0x[0-9a-fA-F]*\)".*/\1/p')
[ -n "$JAR" ] || { echo "Couldn't read the deployed address from forge:"; echo "$OUT"; exit 1; }
echo "Deployed UsdcTipJar at $JAR (owner $OWNER)"

if [ "$NETWORK" = arc_testnet ]; then
  # "already verified" also counts: Blockscout auto-matches bytecode it has seen before.
  forge verify-contract "$JAR" src/UsdcTipJar.sol:UsdcTipJar --chain-id "$CHAIN_ID" \
    --verifier blockscout --verifier-url "$EXPLORER/api/" \
    --constructor-args "$(cast abi-encode 'constructor(address)' "$OWNER")" --watch | tail -2
else
  echo "Mainnet verification: use $EXPLORER/contract-verification (the CLI API is behind a Cloudflare check)."
fi

cat <<NEXT

$EXPLORER/address/$JAR

Try it (tip 0.5 USDC; amounts use 6 decimals):
  cast send 0x3600000000000000000000000000000000000000 'approve(address,uint256)' $JAR 500000 --rpc-url $RPC --private-key \$PRIVATE_KEY
  cast send $JAR 'tip(uint256,string)' 500000 "hello" --rpc-url $RPC --private-key \$PRIVATE_KEY
NEXT
