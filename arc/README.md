# Arc kit

Deploy and verify a contract on **Arc** (Circle's L1), and avoid the Arc-specific traps.
Checked against Arc's docs and run on Arc testnet on 2026-09-29.

## Deploy in one command

```sh
cd arc/example
cp .env.example .env        # set PRIVATE_KEY; get test USDC at https://faucet.circle.com
./deploy.sh                 # deploys UsdcTipJar to Arc testnet, verifies it, prints next steps
```

`deploy.sh` checks the wallet has USDC for gas, deploys, verifies on the explorer, and prints
ready-to-run commands to approve and tip. Settings come from `.env`; anything you set on the
command line wins. Needs [Foundry](https://getfoundry.sh). The example contract takes tips in USDC and sends them
to `OWNER` (default: the deployer, so a test tip comes back to you).

Mainnet: `NETWORK=arc CONFIRM_MAINNET=1 ./deploy.sh` (spends real USDC; deploys cost cents).
Verify mainnet contracts at https://explorer.arc.io/contract-verification, since its CLI API
sits behind a Cloudflare check.

Verification may print "already verified": the explorer auto-matches bytecode it has seen
before. That's a success.

## Network

| | Arc (mainnet) | Arc Testnet |
|---|---|---|
| Chain ID | `5042` | `5042002` |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| Gas token | USDC, **18 decimals** | USDC, **18 decimals** |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000`, **6 decimals** | same |
| viem | `arc` from `viem/chains` | `arcTestnet` from `viem/chains` |

Mainnet is public (since September 16, 2026) and anyone can deploy. viem's `arcTestnet` uses
`rpc.testnet.arc.network` / `testnet.arcscan.app`; both work (arcscan redirects to the explorer above).

## The traps

1. **One balance, two decimal systems.** USDC is the gas token (18 decimals: `msg.value`, native
   sends, `eth_getBalance`) and an ERC-20 at `0x3600…0000` (6 decimals: `balanceOf`,
   `transfer`, `approve`). The same wallet reads `19978353276000000000` natively and `19978353`
   via `balanceOf`. Never mix them (off by 10¹²); use the ERC-20 interface for app logic. Arc's
   own gas docs show `parseUnits("1", 6)` for a native send, which sends 10⁻¹² USDC: use 18.
2. **Gas under 20 gwei vanishes.** `maxFeePerGas` below 20 gwei is dropped silently: no error,
   no receipt. Use the RPC's fee estimates (Foundry and viem do); never hardcode a low price.
3. **No blobs, no randomness.** Blob (type-3) transactions are rejected; `block.prevrandao` is always 0.
4. **Don't wrap USDC.** Arc says not to deploy a WUSDC wrapper. A value transfer to `0x0` reverts.
   USDC's blocklist is enforced at runtime.
5. **Timestamps can repeat.** Blocks are about 0.5 s and timestamps aren't strictly increasing.
6. **Scripts need a User-Agent.** The public RPCs return 403 to some default HTTP clients (Python's).

Standard Foundry works (EVM baseline is Osaka; the kit compiles for `prague`). Arc's Foundry
fork, `arc-anvil`, reproduces Arc behavior locally; plain `anvil` doesn't.

## Tested (Arc testnet, 2026-09-29)

- `./deploy.sh` run from another directory: deployed
  `0x422395033C5544698Aee449E5a0F2283Cd427a83` and verified it; the printed approve and tip
  commands both succeeded (tip tx
  `0xf6317aa57d693aaef8490909f657adf7fbba24b975041de06f528a07afc32edb`).
- Earlier manual run, first-time verification "Pass - Verified":
  `0x53938CC7E0491CBEB1696E9f566C01Afa8cF262c`.
- The printed approve and tip commands, run exactly as printed with the key only in `.env`:
  both succeeded.
- `deploy.sh` stops with a clear message when `PRIVATE_KEY` is missing, the wallet has no USDC,
  `NETWORK` is misspelled, or `NETWORK=arc` is given (in `.env` or on the command line)
  without `CONFIRM_MAINNET=1`.

Sources: [docs.arc.io](https://docs.arc.io) (connect-to-arc, gas-and-fees, evm-differences,
stablecoin-native-model, deploy-on-arc), [mainnet launch](https://www.arc.io/blog/arc-mainnet-goes-live-on-september-16-2026).
