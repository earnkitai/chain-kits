# Base kit: Builder Codes

Base's Builder Grant Program asks "What's your Base Builder Code?", and Base's docs say "The
first step to be eligible for grants is to integrate Builder Codes." This kit is how a coding
agent adds one correctly. Checked against Base's docs and the libraries on 2026-09-29.

## What it is

A Builder Code (e.g. `bc_b7k3p9da`) identifies your app onchain. It's appended to transaction
calldata as an [ERC-8021](https://eip.tools/eip/8021) suffix: contracts ignore it, Base's
indexers read it. No contract changes; about 16 gas per byte.

## 1. Get a code

- **App builders:** register on [base.dev](https://base.dev) (a Base Dashboard account), then
  Settings → Builder Code. This is a builder step; the agent can't do it for them.
- **Agents:** `POST https://api.base.dev/v1/agents/builder-codes` with
  `{"walletAddress":"0x..."}`. No login; the same wallet always gets the same code. Ask the
  builder before registering a wallet.

## 2. Build the suffix (never hand-write it)

```ts
import { Attribution } from 'ox/erc8021'; // npm i ox viem  (viem >= 2.45)
export const DATA_SUFFIX = Attribution.toDataSuffix({ codes: ['bc_yourcode'] });
```

Don't copy the hex from Base's overview page: its `sendCalls` example has the bytes in the wrong
order and doesn't decode.

## 3. Attach it to every transaction

| Where | How |
|---|---|
| **viem** (server, agent, EOA) | `createWalletClient({ ..., dataSuffix: DATA_SUFFIX })`: applies to `sendTransaction`, `sendCalls`, `writeContract` simulation and more |
| **wagmi + browser wallets** | **Pass it per call.** `sendTransaction({ ..., dataSuffix: DATA_SUFFIX })` or `sendCalls({ calls, capabilities: { dataSuffix: { value: DATA_SUFFIX, optional: true } } })` |
| **ERC-4337** (viem bundler, CDP smart accounts) | `sendUserOperation({ ..., dataSuffix: DATA_SUFFIX })`; for userOps the suffix goes on `userOp.callData` |
| **Privy** | its `dataSuffix` plugin (`@privy-io/react-auth` >= 3.13.0) |
| **Base App** | adds your code automatically for its users |

**Trap:** Base's docs say to put `dataSuffix` in wagmi's `createConfig`. In current wagmi
(3.7.x), that setting never reaches a connected browser wallet, so those transactions go out
**without** the code (open bug [wevm/wagmi#5248](https://github.com/wevm/wagmi/issues/5248), fix
not merged). Pass it per call until that ships.

## 4. Check it worked

```sh
cd example && npm install
PRIVATE_KEY=0x... CHAIN=base npm run send     # sends a 0-value tx with the code, decodes it back
CHAIN=base npm run check -- 0x<tx hash>        # any tx: "Builder Code(s): bc_..." or "No Builder Code"
```

Also: the last 16 bytes of the calldata are `8021` repeated; on base.dev, attribution counts
increase under Onchain activity.

Base doesn't say whether base.dev counts **testnet** activity. Assume only Base mainnet counts.

## x402 payments

x402 has a [builder-code extension](https://docs.x402.org/extensions/builder-code.md) that puts
your code on the settlement transaction (`declareBuilderCodeExtension('bc_yourcode')` from
`@x402/extensions/builder-code`). The **facilitator** appends it, so it must support the
extension: Coinbase's CDP facilitator and x402.org's testnet facilitator do; **Circle's
Facilitator Service doesn't**. If x402 settlements need to count toward a Base grant, settle
through CDP.

## Tested (2026-09-29)

- `send-with-code.ts` with viem `dataSuffix`: tx `0xbda11a2f…5fa3` mined (status success); its
  calldata ends with the ERC-8021 marker and decodes to `{ codes: ['bc_earnkit'] }`.
  Run on Arc testnet because the test wallet had gas there; the encoding is identical on every
  EVM chain. Attribution itself only happens on Base.
- `check-tx.ts`: finds the code on that tx; reports "No Builder Code" on a normal tx.
- The code used was a placeholder, not a registered Builder Code.

Sources: [Builder Codes overview](https://docs.base.org/specifications/builder-codes/overview),
[for app developers](https://docs.base.org/specifications/builder-codes/for-app-developers),
[for agent developers](https://docs.base.org/specifications/builder-codes/for-agent-developers),
[ox ERC-8021](https://oxlib.sh/ercs/erc8021/Attribution/toDataSuffix),
[viem wallet client](https://viem.sh/docs/clients/wallet),
[CDP x402 network support](https://docs.cdp.coinbase.com/x402/network-support).
