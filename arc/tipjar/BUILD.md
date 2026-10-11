# Build it (for the coding agent)

You turn the builder's one-line twist into a live USDC tip page on Arc. EarnKit deploys the
contract (it pays the gas) and hosts the page. Needs [Foundry](https://getfoundry.sh) and Node 20+.
No npm install. Never put a key in the repo or the page.

1. **Copy the kit** into a new folder and start a repo:
   `npx degit earnkitai/chain-kits/arc/tipjar <project> && cd <project> && git init`

2. **Fill `twist.json` from the builder's twist.** Write every value yourself; never invent a wallet.

   | Slot | Rule | Example for "a tip jar for my open-source library" |
   |---|---|---|
   | `name` | 3 to 40 characters | `LibFund` |
   | `description` | one line, 10 to 160 characters | `Back the library with a USDC tip on Arc.` |
   | `feature` | one sentence, 10 to 160 characters | `A goal bar shows how close the next release fund is.` |
   | `feature_kind` | `notes` (recent notes from tips of 1 USDC or more), `goal` (progress bar) or `none` | `goal` |
   | `goal_usdc` | the goal in USDC when `feature_kind` is `goal`, else 0 | `500` |
   | `min_tip_usdc` | smallest tip in USDC, `"0"` for any amount; the page's smallest button is 1 | `"1"` |
   | `wallet_connect` | keep `true`; `false` shows only "Tip from the explorer" links | `true` |

   No addresses in the text slots. Pick the `feature_kind` that fits the twist and write
   `feature` to describe it.

3. **Rename the kit.** Set `package.json` `name` and `description` to the project (`libfund`).
   Replace `README.md` from its heading down to "Agents: follow" with the project's name and
   description; keep the rest. EarnKit treats a repo still named like the kit as the unchanged starter.

4. **Optional: shape the page** in `site/` (copy, colors, layout). The name, description and
   feature come from `twist.json`: `make-site.mjs` writes them into the zipped page's title,
   heading and text, so leave those in `index.html` as they are. Keep it static. Keep the
   `config.js` and `app.js` script tags. No `localStorage`, no `fetch` of the site's own files, no
   CDN: hosted pages run in a sandbox that blocks them.

5. **Prove it:** `bash scripts/e2e.sh --twisted`. It runs `forge test`, deploys on a local anvil with
   a test wallet as owner, tips once, reads `Tipped`, builds `site.zip`, and runs EarnKit's deploy
   and host checks. Fix anything marked FAIL; finish only on `E2E PASSED`. It uses test wallets
   and never touches your `artifact.json`, `site.zip` or `site/config.js`.

6. **Push** to a new public repo under the builder's own GitHub account (not a fork). Add the
   `earnkit.txt` proof line EarnKit gave you and commit it. `.gitignore` already keeps out `.env`,
   `out/`, `artifact.json` and `site.zip`.

7. **Make the deploy artifact** with the wallet the builder gave:
   `node scripts/artifact.mjs --owner 0xBuilderWallet`
   Pass the contents of `artifact.json` as `deploy` in EarnKit's `prepare`, with `host: true`.
   The wallet is the constructor's owner, so `owner()` is the builder from the first block. The script
   refuses public test wallets (anvil, Hardhat).

8. **Build the site** with the address from the reply (`deploy.address`):
   `node scripts/make-site.mjs --address 0xJarAddress`
   It checks the address on Arc first. POST `site.zip` to the reply's `upload_url` (`Content-Type: application/zip`) within 15 minutes.

9. **If EarnKit hosting is off or refused,** host on GitHub Pages from the same repo:
   `git add -f site/config.js && git commit -m "Site config" && git subtree push --prefix site origin gh-pages`
   then `gh api -X POST repos/<owner>/<repo>/pages -f "source[branch]=gh-pages" -f "source[path]=/"`.
   Send `https://<owner>.github.io/<repo>/` as the live URL in the next `prepare`.

Done: the jar is on Arc with the builder as owner, and the page is live.
