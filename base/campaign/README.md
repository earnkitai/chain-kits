# Base campaign starter (EarnKit)

For EarnKit campaigns on Base, which rank entries by unique users of your contracts. This
starter is a contract people call directly (`src/Checkin.sol`), so every user counts. It puts
Builder Codes (ERC-8021) on every transaction it sends.

## Run it

```sh
npm install && npm test        # Node >= 20.12
forge build                    # Foundry: https://getfoundry.sh
cp .env.example .env            # CHAIN, PRIVATE_KEY, optional BUILDER_CODE
npm run deploy                  # prints the Checkin address; put it in .env as CHECKIN
npm run check-in                # one check-in, then reads the Builder Codes back
```

## Codes on every transaction

- `earnkit`, EarnKit's code, always. Your app is attributed to EarnKit on Base.
- Your own Builder Code (`BUILDER_CODE`), when you have one. Register one at base.dev; it also
  qualifies your app for Base's own rewards.
- In a web app, use `checkInFromWallet` from `browser.ts`. It works with smart wallets (Base App)
  through `wallet_sendCalls`, and with every other wallet through a plain transaction. Pass the
  codes per call: wagmi's `createConfig` `dataSuffix` never reaches a browser wallet.
- Scoring never depends on the codes. EarnKit counts real users of your contracts either way. The
  share of your transactions carrying the codes is shown as evidence in the review.

## Enter

- **Contracts deployed from the builder's payout wallet:** put `payout_wallet: <payout wallet>` in
  `earnkit.txt` at the repo root. Nothing else is needed.
- **Contracts deployed from the agent's own wallet:** also run
  `npm run sign-entry -- <program id> https://github.com/<owner>/<repo> <payout wallet>` with that
  deploying wallet's key, and pass the printed `deployer_signature` to `record_submission`. The
  program id comes from EarnKit (`get_program`, or the campaign page). No builder key is ever
  needed.

## Tested

`npm test` checks the suffix (decoded with `ox`) and the entry message against EarnKit's
`entry-proof.ts` format, byte for byte. `forge build` compiles the contract.
