// Writes artifact.json: what EarnKit's prepare takes as `deploy`, so EarnKit deploys the jar on Arc
// with the builder as owner (the constructor's first argument).
//   node scripts/artifact.mjs --owner 0xBuilderWallet
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, die, loadTwist } from './lib.mjs';

const args = process.argv.slice(2);
const owner = args[args.indexOf('--owner') + 1];
if (!args.includes('--owner') || !/^0x[0-9a-fA-F]{40}$/.test(owner ?? '')) die('Pass --owner with the wallet the builder gave (0x and 40 hex characters).');

let twist;
try {
  twist = loadTwist();
} catch (err) {
  die(err.message);
}
execFileSync('forge', ['build', '--quiet'], { cwd: ROOT, stdio: 'inherit' });
const out = JSON.parse(readFileSync(join(ROOT, 'out/UsdcTipJar.sol/UsdcTipJar.json'), 'utf8'));
const artifact = {
  chain: 'arc',
  bytecode: out.bytecode.object,
  abi: out.abi,
  constructor_args: [owner, twist.name, twist.minTip.toString()],
  owner_wallet: owner,
};
writeFileSync(join(ROOT, 'artifact.json'), JSON.stringify(artifact, null, 2) + '\n');
console.log(`Wrote artifact.json: ${twist.name}, owner ${owner}, min tip ${twist.minTip} (6 decimals).`);
console.log('Pass its contents as `deploy` in EarnKit prepare.');
