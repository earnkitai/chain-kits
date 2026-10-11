// Writes artifact.json: what EarnKit's prepare takes as `deploy`, so EarnKit deploys the jar on Arc
// with the builder as owner (the constructor's first argument).
//   node scripts/artifact.mjs --owner 0xBuilderWallet
// Refuses the public anvil/Hardhat test accounts (their keys are published: anyone could take the
// tips). scripts/e2e.sh passes --test, which allows them and writes .e2e-artifact.json instead.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, die, loadTwist } from './lib.mjs';

const args = process.argv.slice(2);
const owner = args[args.indexOf('--owner') + 1];
if (!args.includes('--owner') || !/^0x[0-9a-fA-F]{40}$/.test(owner ?? '')) die('Pass --owner with the wallet the builder gave (0x and 40 hex characters).');
const test = args.includes('--test');
// Accounts 0 to 9 of the default test mnemonic used by anvil and Hardhat (public addresses).
const TEST_WALLETS = [
  'f39fd6e51aad88f6f4ce6ab8827279cfffb92266', '70997970c51812dc3a010c7d01b50e0d17dc79c8', '3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
  '90f79bf6eb2c4f870365e785982e1f101e93b906', '15d34aaf54267db7d7c367839aaf71a00a2c6a65', '9965507d1a55bcc2695c58ba16fb37d819b0a4dc',
  '976ea74026e726554db657fa54763abd0c3a0aa9', '14dc79964da2c08b23698b3d3cc7ca32193d9955', '23618e81e3f5cdf7f54c3d65f7fbc0abaec7d3e1',
  'a0ee7a142d267c1f36714e4a8f75612f20a79720',
];
if (!test && TEST_WALLETS.includes(owner.slice(2).toLowerCase()))
  die(`${owner} is a public test account: anyone can spend from it. Ask the builder for their own wallet.`);

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
const file = test ? '.e2e-artifact.json' : 'artifact.json';
writeFileSync(join(ROOT, file), JSON.stringify(artifact, null, 2) + '\n');
console.log(`Wrote ${file}: ${twist.name}, owner ${owner}, min tip ${twist.minTip} (6 decimals).`);
console.log('Pass its contents as `deploy` in EarnKit prepare.');
