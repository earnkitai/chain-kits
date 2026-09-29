# Arc kit

What a coding agent needs to deploy and verify a contract on **Arc** (Circle's L1), and the
Arc-specific traps to avoid. Everything here was checked against Arc's official docs and run
on Arc testnet on 2026-09-29 (see "Tested").

## Network

| | Arc (mainnet) | Arc Testnet |
|---|---|---|
| Chain ID | `5042` | `5042002` |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| Native currency | USDC, **18 decimals** | USDC, **18 decimals** |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000`, **6 decimals** | same |
| viem chain | `arc` from `viem/chains` | `arcTestnet` from `viem/chains` |
| Test funds | | [faucet.circle.com](https://faucet.circle.com) (20 USDC every 2 hours) |

Mainnet has been public since September 16, 2026, and deploying is permissionless.

## The traps

1. **One balance, two decimal systems.** USDC is both the gas token and an ERC-20 at
   `0x3600…0000`. `msg.value`, native sends, and `eth_getBalance` use **18** decimals; the ERC-20
   interface (`balanceOf`, `transfer`, `approve`) uses **6**. The same wallet reads
   `19978353276000000000` natively and `19978353` via `balanceOf`. Never mix them in math
   (off by 10¹²). Prefer the ERC-20 interface for app logic, as Arc recommends.
   Arc's own gas docs show `parseUnits("1", 6)` for a native send: that sends 10⁻¹² USDC. Use
   `parseUnits(x, 18)` for native value.
2. **Gas below 20 gwei disappears.** Transactions with `maxFeePerGas` under 20 gwei are dropped
   from the mempool with no error and no receipt. Use the RPC's fee estimates (Foundry and viem
   do by default); never hardcode a low gas price. The base fee isn't burned.
3. **No blobs, no randomness.** Type-3 (blob) transactions are rejected; `PREVRANDAO` is always 0,
   so don't use `block.prevrandao` for randomness.
4. **Don't wrap USDC.** Arc's docs say not to deploy a WUSDC wrapper; use the ERC-20 interface.
   A value-bearing transfer to `0x0` reverts. USDC's blocklist is enforced at runtime.
5. **Timestamps can repeat.** Blocks are about 0.5 s and timestamps are non-decreasing, not
   strictly increasing. Don't assume each block has a new timestamp.
6. **RPC and bots.** The public RPCs returned 403 to Python's default user agent; set a
   User-Agent header in scripts.

EVM baseline is **Osaka** (EIP-7702, `CREATE2`, EIP-2935 behave as on Ethereum). Standard Foundry
works; `evm_version = "prague"` compiles fine. Arc also ships a Foundry fork (`arc-forge`) whose
`arc-anvil` reproduces Arc behavior locally; plain `anvil` doesn't.

## Deploy and verify (Foundry)

`example/` is a tested Foundry project: `UsdcTipJar`, which takes tips in USDC through the ERC-20
interface.

```sh
cd example
forge build

# Deploy (testnet). Gas is paid in USDC from the deployer's balance.
forge create src/UsdcTipJar.sol:UsdcTipJar --rpc-url arc_testnet \
  --private-key $PRIVATE_KEY --broadcast --constructor-args <owner address>

# Verify on the testnet explorer (Blockscout)
forge verify-contract <deployed address> src/UsdcTipJar.sol:UsdcTipJar --chain-id 5042002 \
  --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" <owner address>) --watch

# Use it: approve then tip 0.5 USDC (6 decimals)
cast send 0x3600000000000000000000000000000000000000 'approve(address,uint256)' <jar> 500000 \
  --rpc-url arc_testnet --private-key $PRIVATE_KEY
cast send <jar> 'tip(uint256,string)' 500000 "hello" --rpc-url arc_testnet --private-key $PRIVATE_KEY
```

For **mainnet**, use `--rpc-url arc` and fund the deployer with real USDC (deploys here cost
cents). The mainnet explorer runs Blockscout too, but its API sits behind a Cloudflare challenge
and Arc doesn't document a mainnet verifier URL. Verify through the UI at
`https://explorer.arc.io` if the CLI is blocked.

## Wallets and apps

- viem: `import { arc, arcTestnet } from 'viem/chains'`.
- Add to a wallet: name `Arc` / `Arc Testnet`, RPC and explorer from the table, chain ID as above,
  currency symbol `USDC` (18 decimals).
- Arc Testnet isn't in the WalletConnect chain registry.

## Tested (Arc testnet, 2026-09-29)

- Deployed `UsdcTipJar` with standard Foundry: `0x53938CC7E0491CBEB1696E9f566C01Afa8cF262c`
  (tx `0x56aeeac0…5007`)
- Verified on Blockscout: "Pass - Verified"
- `approve` (tx `0x1ea29cf0…b69b`) then `tip(500000, …)` (tx `0xb9fed66f…498f`): both status 1,
  allowance consumed to 0
- Three transactions plus the deploys cost about 0.02 test USDC in gas

Sources: [docs.arc.io](https://docs.arc.io) (connect-to-arc, gas-and-fees, evm-differences,
stablecoin-native-model, deploy-on-arc), [arc.io blog](https://www.arc.io/blog/arc-mainnet-goes-live-on-september-16-2026).
