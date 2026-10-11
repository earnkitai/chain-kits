// EarnKit's deploy and host checks, run locally. Copied from the EarnKit app on 2026-10-11
// (lib/earnkit/deploy.ts deployRefusal + runtimeRefusal, lib/earnkit/hosting.ts zipProblems,
// abuseFlags, usesStorage). If this passes, EarnKit's capped deployer and host accept the build.
//   node scripts/check.mjs                         # the compiled contract + site.zip
//   node scripts/check.mjs --twisted               # also: the twist is filled and the kit renamed
//   node scripts/check.mjs --rpc URL --address 0x  # also: the deployed runtime at that address
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT_HEADING, KIT_PACKAGE, KIT_TWIST, ROOT, fold, loadTwist, rpc } from './lib.mjs';
import { readStored, readZipEntries } from './zip.mjs';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const problems = [];
const ok = (line) => console.log(`ok   ${line}`);
const bad = (line) => {
  problems.push(line);
  console.log(`FAIL ${line}`);
};

// ---- Deploy checks (deploy.ts)
const CAPS = { initcodeBytes: 49_152, runtimeBytes: 24_576 };
const ERC20 = ['a9059cbb', '095ea7b3', '18160ddd']; // transfer, approve, totalSupply

function opcodes(hex) {
  const bytes = Buffer.from(hex.replace(/^0x/, ''), 'hex');
  let end = bytes.length;
  if (end >= 2) {
    const meta = bytes.readUInt16BE(end - 2);
    if (meta > 0 && meta + 2 <= end && bytes[end - 2 - meta] >= 0xa0 && bytes[end - 2 - meta] <= 0xbf) end -= meta + 2;
  }
  const ops = [];
  for (let i = 0; i < end; i++) {
    ops.push(bytes[i]);
    if (bytes[i] >= 0x60 && bytes[i] <= 0x7f) i += bytes[i] - 0x5f;
  }
  return ops;
}
function runtimeRefusal(hex, label) {
  const code = hex.toLowerCase().replace(/^0x/, '');
  if (code.length / 2 > CAPS.runtimeBytes) return bad(`${label}: ${code.length / 2} bytes, over ${CAPS.runtimeBytes}`);
  if (ERC20.every((s) => code.includes(`63${s}`))) return bad(`${label}: looks like a token (transfer, approve and totalSupply)`);
  if (opcodes(hex).some((op) => op === 0xf0 || op === 0xf5)) return bad(`${label}: creates contracts (CREATE or CREATE2)`);
  ok(`${label}: ${code.length / 2} bytes, not a token, no CREATE`);
}

const outPath = join(ROOT, 'out/UsdcTipJar.sol/UsdcTipJar.json');
if (!existsSync(outPath)) bad('out/UsdcTipJar.sol/UsdcTipJar.json is missing: run forge build');
else {
  const out = JSON.parse(readFileSync(outPath, 'utf8'));
  const ctor = out.abi.find((x) => x.type === 'constructor');
  if (ctor?.stateMutability === 'payable') bad('constructor is payable');
  else ok('constructor is not payable');
  if (ctor?.inputs?.[0]?.type !== 'address') bad("constructor's first argument must be the owner address");
  else ok('owner is the first constructor argument');
  const creation = out.bytecode.object.toLowerCase().replace(/^0x/, '');
  if (ERC20.every((s) => creation.includes(`63${s}`))) bad('creation code looks like a token');
  let name = 'Tip Jar';
  try {
    name = loadTwist().name;
  } catch {}
  // Initcode = creation code + (address, string, uint256) encoded: 3 head words, the length, the padded bytes.
  const initBytes = creation.length / 2 + 32 * 4 + Math.ceil(Buffer.byteLength(name) / 32) * 32;
  if (initBytes > CAPS.initcodeBytes) bad(`initcode ${initBytes} bytes, over ${CAPS.initcodeBytes}`);
  else ok(`initcode ${initBytes} bytes (cap ${CAPS.initcodeBytes})`);
  runtimeRefusal(out.deployedBytecode.object, 'runtime (compiled)');
  if (!out.abi.some((x) => x.type === 'function' && x.name === 'owner')) bad('no owner() view');
  if (!out.abi.some((x) => x.type === 'event' && x.name === 'Tipped')) bad('no Tipped event');
}

if (opt('--rpc') && opt('--address')) {
  const code = await rpc(opt('--rpc'), 'eth_getCode', [opt('--address'), 'latest']);
  runtimeRefusal(code, 'runtime (deployed)');
}

// ---- Host checks (hosting.ts)
const STATIC_EXT = new Set('html htm css js mjs json map png jpg jpeg gif webp avif svg ico woff woff2 ttf otf wasm txt webmanifest'.split(' '));
const ARCHIVE_OR_BINARY = /\.(exe|apk|dmg|msi|bat|cmd|sh|ps1|jar|zip|rar|7z|tar|gz|tgz|bz2|xz|iso|deb|rpm)$/i;
const OUTSIDE = /(^|\/)\.{1,2}(\/|$)|^\/|\/\/|\\|[\u0000-\u001f\u007f]/;
function zipProblems(entries) {
  const files = entries.filter((e) => !e.isDir);
  if (files.length > 500) return 'more than 500 files';
  const seen = new Set();
  let total = 0;
  for (const e of files) {
    if (e.isLink || !e.name || OUTSIDE.test(e.name)) return `file outside the site folder: ${e.name}`;
    const lower = e.name.toLowerCase();
    if (seen.has(lower)) return `same file twice: ${e.name}`;
    seen.add(lower);
    const base = lower.slice(lower.lastIndexOf('/') + 1);
    const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : '';
    if (ARCHIVE_OR_BINARY.test(lower) || !STATIC_EXT.has(ext)) return `not a website file: ${e.name}`;
    if (e.size > 10 * 1024 * 1024) return `over 10 MB: ${e.name}`;
    total += e.size;
    if (total > 25 * 1024 * 1024) return 'over 25 MB in total';
  }
  return files.some((e) => e.name.toLowerCase() === 'index.html') ? null : 'no index.html at the zip root';
}
const BRANDS = /\b(metamask|coinbase|phantom|rabby|trust\s?wallet|ledger|binance|kraken|chase|wells\s?fargo|bank of america|paypal|revolut)\b/i;
const SEED = /\b(seed|recovery|secret|mnemonic) (phrase|words?)\b|\bmnemonic\b|\b(12|24)[- ]words?\b|\b(enter|paste|type|import) (your )?private key\b/i;

const zipPath = join(ROOT, 'site.zip');
if (!existsSync(zipPath)) bad('site.zip is missing: run node scripts/make-site.mjs');
else {
  const buf = readFileSync(zipPath);
  const entries = readZipEntries(buf);
  const why = zipProblems(entries);
  if (why) bad(`site.zip: ${why}`);
  else ok(`site.zip: ${entries.length} static files, index.html at the root, ${buf.length} bytes`);
  const texts = entries.filter((e) => /\.(html?|js|mjs|css|json|txt|svg)$/i.test(e.name)).map((e) => ({ path: e.name, text: readStored(buf, e).toString('utf8') }));
  for (const f of texts) {
    if (/<input[^>]+type\s*=\s*["']?password/i.test(f.text) && BRANDS.test(f.text)) bad(`${f.path}: a password field next to a wallet or bank name (sent to review)`);
    const plain = f.text.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/\s+/g, ' ');
    if (SEED.test(plain)) bad(`${f.path}: mentions a seed phrase or private key (sent to review)`);
    if (/\b(approve|setApprovalForAll|increaseAllowance|permit)\s*\(\s*["']?0x[0-9a-fA-F]{40}/.test(f.text)) bad(`${f.path}: a hard-coded approval (sent to review)`);
    if (/\b(localStorage|sessionStorage)\s*(\.\s*(setItem|getItem)\b|\[)|\bindexedDB\s*\.\s*open\b/.test(f.text) && /\.(js|mjs|html?)$/i.test(f.path))
      bad(`${f.path}: uses browser storage, which hosted sites block`);
    if (/PRIVATE_KEY|private_?key["']?\s*[:=]\s*["']?(0x)?[0-9a-fA-F]{64}/i.test(f.text)) bad(`${f.path}: looks like it holds a key`);
  }
  const cfg = texts.find((f) => f.path === 'config.js');
  if (!cfg || !/"jar": "0x[0-9a-fA-F]{40}"/.test(cfg.text)) bad('site.zip: config.js with the jar address is missing');
  else ok('site.zip: config.js carries the jar address');
}

// ---- The twist (--twisted)
if (args.includes('--twisted')) {
  try {
    const t = loadTwist();
    const same = ['name', 'description', 'feature'].filter((k) => fold(t[k]) === fold(KIT_TWIST[k]));
    if (same.length) bad(`twist.json still has the kit's ${same.join(', ')}: write them from the builder's twist`);
    else ok(`twist: ${t.name} / ${t.feature_kind}`);
  } catch (err) {
    bad(err.message);
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name;
  if (fold(pkg) === fold(KIT_PACKAGE)) bad(`package.json "name" is still ${KIT_PACKAGE}: rename it after the twist`);
  else ok(`package name: ${pkg}`);
  const heading = (/^# (.+)$/m.exec(readFileSync(join(ROOT, 'README.md'), 'utf8')) ?? [])[1];
  if (fold(heading) === fold(KIT_HEADING)) bad(`README.md heading is still "${KIT_HEADING}": rename it after the twist`);
  else ok(`README heading: ${heading}`);
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s). Fix them before deploying.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
