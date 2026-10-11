# Arc tip jar starter (EarnKit)

A USDC tip page on Arc: a small contract that sends every tip straight to its owner, and a static
page that shows the jar and takes tips. Built to go from zero to deployable in under an hour.
Agents: follow [BUILD.md](BUILD.md).

| Part | What it is |
|---|---|
| `src/UsdcTipJar.sol` | The jar. Owner, name and minimum tip set in the constructor. Tips in USDC (6 decimals) |
| `site/` | The page: static files, no build step, no dependencies, no keys |
| `twist.json` | The builder's twist: name, description, one feature |
| `scripts/e2e.sh` | forge test, a local anvil deploy and tip, the site zip, EarnKit's checks |
| `scripts/artifact.mjs` | The `deploy` artifact for EarnKit's `prepare` |
| `scripts/make-site.mjs` | Bakes the jar's address into `site/config.js` and zips `site/` |
| `scripts/check.mjs` | EarnKit's deploy and host checks, run locally |

## The contract

| | |
|---|---|
| `constructor(address owner, string name, uint256 minTip)` | Owner gets every tip; not payable |
| `tip(uint256 amount, string note)` | Approve USDC to the jar first. Reverts on 0, below `minTip`, or a note over 280 bytes |
| `event Tipped(address indexed from, uint256 amount, string note)` | One per tip |
| `stats() returns (tips, total, tippers)` | Every total in one call |
| `owner()`, `name()`, `minTip()`, `tipCount()`, `totalTipped()`, `tipperCount()` | Views |
| `tipsFrom(address)`, `tippedBy(address)` | Per tipper: count and USDC |
| `USDC()`, `MAX_NOTE()` | `0x3600000000000000000000000000000000000000`, 280 |

USDC on Arc is `0x3600000000000000000000000000000000000000` on mainnet and testnet, with 6
decimals on its ERC-20 interface (the gas token side uses 18). See the
[Arc kit](https://github.com/earnkitai/chain-kits/tree/main/arc) for Arc's traps. The jar never touches `msg.value` and never holds funds.

## The page

- Reads the jar over Arc's public RPC (it answers sandboxed pages): owner, totals, and the
  feature (recent notes from `Tipped` logs, or a goal bar).
- With a browser wallet it switches to Arc, approves the exact amount, and tips.
- With no wallet, or one that can't connect inside the host's sandbox, it shows
  "Tip from the explorer" links with the exact values.
- Settings live in `site/config.js` (a script, not JSON: a sandboxed page can't fetch its own files).

## Deploy it yourself (optional)

EarnKit deploys it for the builder. To deploy from your own wallet instead:

```sh
forge create src/UsdcTipJar.sol:UsdcTipJar --rpc-url https://rpc.testnet.arc.io \
  --private-key "$PRIVATE_KEY" --broadcast --constructor-args 0xOwner "My Jar" 0
node scripts/make-site.mjs --network arc-testnet --address 0xJar
```

Keep the key in your shell or `.env` (gitignored), never in a file you commit.

## Tested

- `forge test`: 9 passed. `bash scripts/e2e.sh`: passed (forge 1.8.1, Node 24, 2026-10-11).
- The artifact and `site.zip` pass the EarnKit app's own `deployRefusal`, `runtimeRefusal`,
  `zipProblems`, `abuseFlags` and `usesStorage` (initcode 5,341 bytes, runtime 3,464 bytes).
- The page under the host's exact CSP sandbox (origin `null`) in headless Chromium: totals and
  notes read from anvil; a tip through an injected wallet landed; a wallet that fails to connect
  falls back to the explorer links.
- Fresh-agent run: see below.

MIT licensed.
