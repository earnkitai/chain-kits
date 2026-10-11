// Bakes the jar's address and the twist into site/config.js, then zips site/ into site.zip
// (index.html at the zip's root), ready for EarnKit's upload URL or GitHub Pages.
//   node scripts/make-site.mjs --address 0xJar                      # Arc mainnet
//   node scripts/make-site.mjs --address 0xJar --network arc-testnet
//   node scripts/make-site.mjs --address 0xJar --network local --rpc http://127.0.0.1:8545
// Optional: --block <deploy block> lets the notes list read back to the deploy;
// --rpc and --explorer override the network's defaults.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NETWORKS, ROOT, die, loadTwist, rpc } from './lib.mjs';
import { writeZip } from './zip.mjs';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const address = opt('--address');
const network = opt('--network') ?? 'arc';
if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) die('Pass --address with the deployed jar (0x and 40 hex characters).');
if (!NETWORKS[network]) die(`--network must be one of: ${Object.keys(NETWORKS).join(', ')}`);
const net = { ...NETWORKS[network], ...(opt('--rpc') && { rpc: opt('--rpc') }), ...(opt('--explorer') && { explorer: opt('--explorer') }) };
const block = opt('--block');
if (block !== undefined && !/^\d+$/.test(block)) die('--block must be a block number.');

let twist;
try {
  twist = loadTwist();
} catch (err) {
  die(err.message);
}

// The address must be a jar on this chain: right chain id, code there, an owner set.
try {
  const id = Number(await rpc(net.rpc, 'eth_chainId'));
  if (network === 'local') net.chainId = id;
  else if (id !== net.chainId) die(`${net.rpc} is chain ${id}, not ${net.chainName} (${net.chainId}).`);
  const code = await rpc(net.rpc, 'eth_getCode', [address, 'latest']);
  if (!code || code === '0x') die(`No contract at ${address} on ${net.chainName}. Check the address and --network.`);
  const owner = await rpc(net.rpc, 'eth_call', [{ to: address, data: '0x8da5cb5b' }, 'latest']);
  if (!owner || /^0x0*$/.test(owner)) die(`${address} has no owner(): is it the tip jar?`);
  console.log(`Jar ${address} on ${net.chainName}, owner 0x${owner.slice(-40)}`);
} catch (err) {
  die(`Couldn't read the jar from ${net.rpc}: ${err.message}`);
}

const config = {
  name: twist.name,
  description: twist.description,
  feature: twist.feature,
  feature_kind: twist.feature_kind,
  goal_usdc: twist.goal_usdc,
  wallet_connect: twist.wallet_connect,
  jar: address,
  deploy_block: block ? Number(block) : null,
  chain_id: net.chainId,
  chain_name: net.chainName,
  rpc: net.rpc,
  explorer: net.explorer,
};
writeFileSync(join(ROOT, 'site/config.js'), `// Written by scripts/make-site.mjs. Public values only.\nwindow.TIPJAR = ${JSON.stringify(config, null, 2)};\n`);

// The zipped index.html carries the twist too, so the page reads right before app.js runs.
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stamp = (html) =>
  html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(twist.name)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(twist.description)}$2`)
    .replace(/(<h1 id="name"[^>]*>)[^<]*(<\/h1>)/, `$1${esc(twist.name)}$2`)
    .replace(/(<p id="description"[^>]*>)[^<]*(<\/p>)/, `$1${esc(twist.description)}$2`)
    .replace(/(<p id="feature"[^>]*>)[^<]*(<\/p>)/, `$1${esc(twist.feature)}$2`);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const name = relative(join(ROOT, 'site'), path).split('\\').join('/');
      const data = readFileSync(path);
      files.push({ name, data: name === 'index.html' ? Buffer.from(stamp(data.toString('utf8'))) : data });
    }
  }
};
walk(join(ROOT, 'site'));
writeFileSync(join(ROOT, 'site.zip'), writeZip(files));
console.log(`Wrote site/config.js and site.zip (${files.length} files: ${files.map((f) => f.name).join(', ')}).`);
