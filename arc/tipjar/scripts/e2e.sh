#!/usr/bin/env bash
# End to end on a local anvil, no keys: forge test, deploy the jar from artifact.json with the
# builder as owner (the way EarnKit deploys it), one tip, read Tipped and stats(), build site.zip,
# run EarnKit's deploy and host checks.
#   bash scripts/e2e.sh             # the kit as it is
#   bash scripts/e2e.sh --twisted   # also requires the twist filled and the kit renamed
set -euo pipefail
cd "$(dirname "$0")/.."
CHECK_ARGS=()
[ "${1:-}" = "--twisted" ] && CHECK_ARGS+=(--twisted)

step() { printf '\n== %s\n' "$1"; }
fail() { printf '\nFAIL: %s\n' "$1"; exit 1; }
json() { node -e "const v=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log($1)"; }

step "forge test"
forge build --quiet
forge test

step "anvil"
PORT=$(node -e "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")
anvil --port "$PORT" --silent > .anvil.log 2>&1 &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null || true' EXIT
RPC="http://127.0.0.1:$PORT"
for _ in $(seq 1 50); do cast block-number --rpc-url "$RPC" >/dev/null 2>&1 && break; sleep 0.2; done
cast block-number --rpc-url "$RPC" >/dev/null || fail "anvil didn't start (see .anvil.log)"

USDC=0x3600000000000000000000000000000000000000
ACCOUNTS=$(cast rpc eth_accounts --rpc-url "$RPC")
DEPLOYER=$(echo "$ACCOUNTS" | json 'v[0]')   # stands in for EarnKit's deployer
OWNER=$(echo "$ACCOUNTS" | json 'v[1]')      # the builder's wallet
TIPPER=$(echo "$ACCOUNTS" | json 'v[2]')
# Arc's USDC isn't on anvil: put the test mock's code at its address.
cast rpc anvil_setCode "$USDC" "$(json 'v.deployedBytecode.object' < out/MockUsdc.sol/MockUsdc.json)" --rpc-url "$RPC" >/dev/null
echo "anvil on $PORT, mock USDC at $USDC"

step "deploy from artifact.json (owner = builder $OWNER)"
node scripts/artifact.mjs --owner "$OWNER"
INITCODE=$(json '(()=>{const {execFileSync}=require("child_process");const a=v.constructor_args;return v.bytecode+execFileSync("cast",["abi-encode","constructor(address,string,uint256)",a[0],a[1],a[2]]).toString().trim().slice(2)})()' < artifact.json)
RECEIPT=$(cast send --unlocked --from "$DEPLOYER" --rpc-url "$RPC" --json --create "$INITCODE")
JAR=$(echo "$RECEIPT" | json 'v.contractAddress')
BLOCK=$(echo "$RECEIPT" | json 'Number(v.blockNumber)')
[ "$(echo "$RECEIPT" | json 'v.status')" = "0x1" ] || fail "deploy reverted"
echo "jar $JAR at block $BLOCK"
GOT_OWNER=$(cast call "$JAR" 'owner()(address)' --rpc-url "$RPC")
[ "$(echo "$GOT_OWNER" | tr A-F a-f)" = "$(echo "$OWNER" | tr A-F a-f)" ] || fail "owner() is $GOT_OWNER, expected $OWNER"
echo "owner() = $GOT_OWNER (the builder)"

step "one tip"
MIN=$(cast call "$JAR" 'minTip()(uint256)' --rpc-url "$RPC" | awk '{print $1}')
AMOUNT=$(( MIN > 1500000 ? MIN : 1500000 ))
send() { cast send --unlocked --from "$TIPPER" "$@" --rpc-url "$RPC" --json | json 'v.status' | grep -q 0x1 || fail "tx failed: $*"; }
send "$USDC" 'mint(address,uint256)' "$TIPPER" "$AMOUNT"
send "$USDC" 'approve(address,uint256)' "$JAR" "$AMOUNT"
send "$JAR" 'tip(uint256,string)' "$AMOUNT" "e2e tip"
OWNER_BAL=$(cast call "$USDC" 'balanceOf(address)(uint256)' "$OWNER" --rpc-url "$RPC" | awk '{print $1}')
[ "$OWNER_BAL" = "$AMOUNT" ] || fail "owner got $OWNER_BAL, expected $AMOUNT"
STATS=$(cast call "$JAR" 'stats()(uint256,uint256,uint256)' --rpc-url "$RPC" | awk '{print $1}' | paste -sd, -)
[ "$STATS" = "1,$AMOUNT,1" ] || fail "stats() = $STATS, expected 1,$AMOUNT,1"
echo "owner received $AMOUNT (6 decimals); stats() = $STATS"

step "read Tipped"
TOPIC=$(cast keccak 'Tipped(address,uint256,string)')
LOGS=$(cast logs --address "$JAR" --from-block "$BLOCK" --to-block latest "$TOPIC" --rpc-url "$RPC" --json)
[ "$(echo "$LOGS" | json 'v.length')" = "1" ] || fail "expected 1 Tipped log"
FROM=$(echo "$LOGS" | json '"0x"+v[0].topics[1].slice(26)')
[ "$FROM" = "$(echo "$TIPPER" | tr A-F a-f)" ] || fail "Tipped from $FROM, expected $TIPPER"
echo "Tipped topic $TOPIC from $FROM"

step "site.zip"
node scripts/make-site.mjs --network local --rpc "$RPC" --address "$JAR" --block "$BLOCK"

step "EarnKit deploy and host checks"
node scripts/check.mjs --rpc "$RPC" --address "$JAR" ${CHECK_ARGS[@]+"${CHECK_ARGS[@]}"}

printf '\nE2E PASSED\n'
