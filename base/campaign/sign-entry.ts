/**
 * Prints deployer_signature for an EarnKit campaign entry: the wallet that deployed the contracts
 * (PRIVATE_KEY) signs "EarnKit entry: <program id> <repo> <payout wallet> <contracts>". The
 * program id comes from EarnKit (get_program / the campaign page); CHECKIN (from .env) is always
 * one of the contracts. Nothing is sent onchain.
 *   npm run sign-entry -- <program id> https://github.com/<owner>/<repo> 0x<payout wallet> [more contract addresses...]
 */
import { privateKeyToAccount } from 'viem/accounts';
import { entryMessage } from './attribution.ts';
import { getCheckin, getPrivateKey } from './env.ts';

const [programId, repo, payout, ...extraContracts] = process.argv.slice(2);
if (!programId || !repo || !/^0x[0-9a-fA-F]{40}$/.test(payout ?? '')) {
  console.error('Usage: npm run sign-entry -- <program id> <GitHub repo link> <payout wallet> [more contract addresses...]');
  process.exit(1);
}
const account = privateKeyToAccount(getPrivateKey());
const contracts = [getCheckin(), ...extraContracts];
const message = entryMessage(programId, repo, payout, contracts);
console.log(`message: ${message}\nsigner: ${account.address}\ndeployer_signature: ${await account.signMessage({ message })}`);
