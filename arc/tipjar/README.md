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

- Tip only through `tip()`. USDC or anything else sent straight to the jar's address is stuck
  for good: there is no sweep, by design.
- The owner can't be changed. If the owner wallet is lost, deploy a new jar.

## The page

- Reads the jar over Arc's public RPC (it answers sandboxed pages): owner, totals, and the
  feature (recent notes from `Tipped` logs, or a goal bar).
- Notes show only from tips of at least 1 USDC (or `minTip` if higher), so the page can't be
  covered in text for fractions of a cent. Smaller tips still count in the totals.
- With a browser wallet it switches to Arc, approves the exact amount, and tips.
- With no wallet, or one that can't connect inside the host's sandbox, it shows "Tip from the
  explorer": the explorer URLs, the jar and USDC addresses and the amounts as text to copy into a
  new tab. It never opens links itself: on EarnKit hosting a page it opens inherits the sandbox,
  where the explorer can't connect a wallet.
- Settings live in `site/config.js` (a script, not JSON: a sandboxed page can't fetch its own
  files). Pure helpers live in `site/lib.js`, tested by `scripts/page.test.mjs`.

## Deploy it yourself (optional)

EarnKit deploys it for the builder. To deploy from your own wallet instead:

```sh
forge create src/UsdcTipJar.sol:UsdcTipJar --rpc-url https://rpc.testnet.arc.io \
  --private-key "$PRIVATE_KEY" --broadcast --constructor-args 0xOwner "My Jar" 0
node scripts/make-site.mjs --network arc-testnet --address 0xJar
```

Keep the key in your shell or `.env` (gitignored), never in a file you commit.

## Tested

- `forge test`: 9 passed. `node --test scripts/page.test.mjs`: 4 passed. `bash scripts/e2e.sh`:
  passed (forge 1.8.1, Node 24, 2026-10-11).
- The artifact and `site.zip` pass the EarnKit app's own `deployRefusal`, `runtimeRefusal`,
  `zipProblems`, `abuseFlags` and `usesStorage` (initcode 5,341 bytes, runtime 3,464 bytes).
- The page served under EarnKit's exact host CSP (origin `null`) in headless Chromium, against
  anvil:
  - Totals and notes read. A dust tip's note stays hidden while it counts in the totals.
  - A tip through a stand-in injected wallet landed. No real wallet extension was tested.
  - A wallet that fails to connect shows "Tip from the explorer" as copyable text, with no links
    that open from the page. Tapping a box selects or copies its text.
  - Not tested: the explorer's own write pages with a wallet (that happens outside this page).
- Fresh-agent runs (2026-10-11): a new agent session given only BUILD.md, the twist "tips for my
  podcast listeners" and a wallet went from `degit` to `E2E PASSED` with `--twisted` plus
  `artifact.json` in about 70 s (run 1) and 64 s (run 2, after fixes from run 1), with no errors
  in either. Scope: steps 1 to 5 and 7; the GitHub push, EarnKit's deploy and the upload weren't
  part of it. The bar is 60 minutes.

MIT licensed.
