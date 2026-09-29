# Base kit: Builder Codes

Base's Builder Grant Program asks for your Builder Code, and Base says "The first step to be
eligible for grants is to integrate Builder Codes." This kit adds one correctly.
Checked against Base's docs and the libraries on 2026-09-29.

A Builder Code (e.g. `bc_b7k3p9da`) is appended to transaction calldata as an
[ERC-8021](https://eip.tools/eip/8021) suffix. Contracts ignore it; Base's indexers count it.
No contract changes needed.

## 1. Get a code

- **Builders:** register on [base.dev](https://base.dev), then Settings → Builder Code.
  The builder does this; an agent can't.
- **Agents:** `POST https://api.base.dev/v1/agents/builder-codes` with
  `{"walletAddress":"0x..."}` (no login; same wallet → same code). Ask the builder first.

## 2. Attach it to every transaction

```ts
import { Attribution } from 'ox/erc8021'; // npm i ox viem  (viem >= 2.45)
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: ['bc_yourcode'] }); // never hand-write the hex
```

| Where | How |
|---|---|
| viem (server, agent, EOA) | `createWalletClient({ ..., dataSuffix: DATA_SUFFIX })` |
| wagmi + browser wallets | **per call:** `sendTransaction({ ..., dataSuffix: DATA_SUFFIX })`, or `sendCalls({ calls, capabilities: { dataSuffix: { value: DATA_SUFFIX, optional: true } } })` |
| ERC-4337 (viem bundler, CDP smart accounts) | `sendUserOperation({ ..., dataSuffix: DATA_SUFFIX })` |
| Privy | its `dataSuffix` plugin (`@privy-io/react-auth` >= 3.13.0) |

**Traps:**
- Base's docs say to set `dataSuffix` in wagmi's `createConfig`. In current wagmi (3.7.x) that
  never reaches a connected browser wallet, so those transactions go out **without** the code
  ([wevm/wagmi#5248](https://github.com/wevm/wagmi/issues/5248)). Pass it per call.
- Don't copy the suffix hex from Base's overview page; its `sendCalls` example is malformed.
- Never default to a placeholder code. A wrong code silently credits someone else.

## 3. Check it

```sh
cd base/example && npm install      # Node >= 20.12
cp .env.example .env     # set BUILDER_CODE, CHAIN, PRIVATE_KEY (shell values win over .env)
npm run send             # sends a 0-value tx to yourself with the code, reads it back
npm run check -- 0x<tx>  # any tx on CHAIN: "Builder Code(s): bc_..." or "No Builder Code"
```

Codes are lowercase letters, digits, and `_`. Sending with `CHAIN=base` costs real ETH and
needs `CONFIRM_MAINNET=1`. Only Base mainnet counts for attribution; Base doesn't say whether testnet
activity shows on base.dev. On base.dev, attribution counts rise under Onchain activity.

## x402 payments

x402's [builder-code extension](https://docs.x402.org/extensions/builder-code.md) puts your code on
settlement transactions, but the facilitator appends it, so it must support the extension:
Coinbase's CDP facilitator does; **Circle's Facilitator Service doesn't**.

## Tested (2026-09-29)

- `npm run send` via `.env` (on Arc testnet, where the test wallet had gas; the encoding is the
  same on every EVM chain): tx `0x5c20cc4425252920f1eba551bd65c610fc4b9e6c3ea3b29af9b669ed7a72eef4`
  succeeded and decodes to `bc_kittest`. `npm run check` finds it.
- Clear errors for: no `.env`, no `CHAIN`/`BUILDER_CODE`/`PRIVATE_KEY`, a placeholder or
  invalid code, an unknown chain, `CHAIN=base` without `CONFIRM_MAINNET=1`, a wallet with no
  gas, a missing hash, and a hash on the wrong chain. Works when run from any directory.
- Codes used were placeholders, not registered Builder Codes.

Sources: [Builder Codes](https://docs.base.org/specifications/builder-codes/overview)
([apps](https://docs.base.org/specifications/builder-codes/for-app-developers),
[agents](https://docs.base.org/specifications/builder-codes/for-agent-developers)),
[ox ERC-8021](https://oxlib.sh/ercs/erc8021/Attribution/toDataSuffix),
[viem wallet client](https://viem.sh/docs/clients/wallet),
[CDP x402 networks](https://docs.cdp.coinbase.com/x402/network-support).
