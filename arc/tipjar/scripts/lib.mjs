// Shared by the kit's scripts. No dependencies.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const USDC = '0x3600000000000000000000000000000000000000';

/** Arc's networks (docs.arc.io, connect-to-arc). `local` is anvil, for scripts/e2e.sh. */
export const NETWORKS = {
  arc: { chainId: 5042, chainName: 'Arc', rpc: 'https://rpc.mainnet.arc.io', explorer: 'https://explorer.arc.io' },
  'arc-testnet': { chainId: 5042002, chainName: 'Arc Testnet', rpc: 'https://rpc.testnet.arc.io', explorer: 'https://explorer.testnet.arc.io' },
  local: { chainId: 31337, chainName: 'Anvil', rpc: 'http://127.0.0.1:8545', explorer: '' },
};

/** The kit's own names: a twisted repo must change both, or EarnKit reads it as the unchanged kit. */
export const KIT_PACKAGE = 'earnkit-arc-tipjar-starter';
export const KIT_HEADING = 'Arc tip jar starter (EarnKit)';
export const KIT_TWIST = { name: 'Tip Jar', description: 'Send a tip in USDC on Arc.', feature: 'Every tip can carry a short note, shown on the page.' };
export const fold = (s) => String(s ?? '').toLowerCase().replace(/[\s_-]+/g, '');

export const die = (msg) => {
  console.error(`\n${msg}`);
  process.exit(1);
};

/** "1.5" -> 1500000n (USDC has 6 decimals on its ERC-20 interface). */
export function usdcUnits(s) {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(s).trim());
  if (!m) throw new Error(`not a USDC amount: ${s}`);
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0'));
}

const ADDRESS = /(0x)?[0-9a-fA-F]{40}/;

/** twist.json, checked. Throws a plain message naming the bad slot. */
export function loadTwist() {
  const t = JSON.parse(readFileSync(join(ROOT, 'twist.json'), 'utf8'));
  const text = (k, min, max) => {
    const v = t[k];
    if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw new Error(`twist.json "${k}" must be ${min} to ${max} characters`);
    if (ADDRESS.test(v)) throw new Error(`twist.json "${k}" must not contain an address`);
    return v.trim();
  };
  const name = text('name', 3, 40);
  const description = text('description', 10, 160);
  const feature = text('feature', 10, 160);
  if ((feature.match(/[.!?](\s|$)/g) ?? []).length > 1) throw new Error('twist.json "feature" must be one sentence');
  if (!['notes', 'goal', 'none'].includes(t.feature_kind)) throw new Error('twist.json "feature_kind" must be "notes", "goal" or "none"');
  const goal = Number(t.goal_usdc ?? 0);
  if (t.feature_kind === 'goal' && !(goal > 0)) throw new Error('twist.json "goal_usdc" must be above 0 when feature_kind is "goal"');
  const minTip = usdcUnits(t.min_tip_usdc ?? '0');
  return { name, description, feature, feature_kind: t.feature_kind, goal_usdc: goal, minTip, wallet_connect: t.wallet_connect !== false };
}

/** One JSON-RPC call (with a User-Agent: Arc's RPC refuses some default clients). */
export async function rpc(url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'earnkit-arc-tipjar/0.1' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}
