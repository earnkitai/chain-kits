# EarnKit chain kits

Coding agents already build apps well. They go wrong on what's chain-specific, new, or easy to
get wrong. Each kit covers only that, checked against official docs and run for real.

| Kit | Covers | For |
|---|---|---|
| [arc/](arc/) | Deploy + verify a contract on Arc, USDC as gas, the 18 vs 6 decimals trap, fee floor | Arc Microgrants, Circle Developer Grants |
| [base/](base/) | Builder Codes (ERC-8021): get one, attach it everywhere, check it | Base Builder Grant Program |
| [base/campaign/](base/campaign/) | A contract people call directly, Builder Codes on every transaction, entry signing | EarnKit campaigns on Base |

Start with the kit for your chain: its README has one command to run it. The Arc kit needs
[Foundry](https://getfoundry.sh); the Base kit needs Node 20.12+. Every kit uses testnet by
default and asks for an explicit `CONFIRM_MAINNET=1` before spending real funds.

Paid agent services (x402) live in a full starter:
[earnkitai/starter-agent-service](https://github.com/earnkitai/starter-agent-service).

Each kit says what was tested, when, and where. If a fact here disagrees with a chain's docs
later, the docs win; open an issue.

MIT licensed.
