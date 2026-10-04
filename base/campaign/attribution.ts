import { Attribution } from 'ox/erc8021';

/**
 * EarnKit's Builder Code (ERC-8021). Every transaction this starter sends carries it, so campaign
 * apps are attributed to EarnKit on Base. It never changes what your contract does.
 */
export const EARNKIT_BUILDER_CODE = 'earnkit';

/**
 * The calldata suffix: EarnKit's code, plus your own Builder Code from base.dev when you have one
 * (it also qualifies your app for Base's own rewards). Generated, never hand-written.
 */
export function dataSuffix(builderCode?: string) {
  const codes = [EARNKIT_BUILDER_CODE];
  const own = builderCode?.trim();
  if (own) {
    if (!/^[a-z0-9_]{1,32}$/.test(own))
      throw new Error(`BUILDER_CODE "${own}" isn't valid: lowercase letters, digits and _ only (e.g. bc_ab12cd34).`);
    if (own !== EARNKIT_BUILDER_CODE) codes.push(own);
  }
  return Attribution.toDataSuffix({ codes });
}

/** A GitHub repo link as EarnKit keys it: "github.com/<owner>/<repo>", lowercase. */
export function repoKey(url: string) {
  const key = url
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .replace(/^(github\.com\/[^/]+\/[^/]+)\/tree(\/.*)?$/, '$1');
  if (!/^github\.com\/[a-z0-9-]+\/[a-z0-9._-]+$/.test(key)) throw new Error(`${url} isn't a GitHub repo link.`);
  return key;
}

/**
 * What the deploying wallet signs to enter its contracts in an EarnKit campaign (EIP-191):
 * "EarnKit entry: <program id> <repo key> <payout wallet> <contracts>", the contracts lowercase,
 * deduped, sorted and joined with ",". Matches EarnKit's entry-proof.ts exactly, so a signature
 * made here verifies there: a signature binds one entry and can't be replayed for another
 * campaign, repo, payout wallet or contract set.
 */
export function entryMessage(programId: string, repoUrl: string, payoutWallet: string, contracts: string[]) {
  const contractList = [...new Set(contracts.map((c) => c.toLowerCase()))].sort().join(',');
  return `EarnKit entry: ${programId} ${repoKey(repoUrl)} ${payoutWallet.toLowerCase()} ${contractList}`;
}
