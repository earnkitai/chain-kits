import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Attribution } from 'ox/erc8021';
import { arcTestnet, base, baseSepolia } from 'viem/chains';

/**
 * Settings from base/example/.env (values set in the shell win), checked up front so mistakes
 * fail loudly instead of misattributing.
 */
const ENV_FILE = join(import.meta.dirname, '.env');
const hasEnvFile = existsSync(ENV_FILE);
if (hasEnvFile) {
  const shell = { ...process.env };
  process.loadEnvFile(ENV_FILE);
  Object.assign(process.env, shell);
}

function fail(message: string): never {
  console.error(hasEnvFile ? message : `${message}\n(No .env yet: cp .env.example .env in base/example.)`);
  process.exit(1);
}

const CHAINS = { base, 'base-sepolia': baseSepolia, 'arc-testnet': arcTestnet } as const;

export function getChain() {
  const name = process.env.CHAIN;
  if (!name || !(name in CHAINS)) {
    fail(`Set CHAIN in .env to one of: ${Object.keys(CHAINS).join(', ')}. Attribution only counts on base.`);
  }
  return CHAINS[name as keyof typeof CHAINS];
}

/** Sending on Base mainnet costs real ETH; require an explicit yes. */
export function confirmMainnet(chainName: string) {
  if (process.env.CHAIN === 'base' && process.env.CONFIRM_MAINNET !== '1') {
    fail(`CHAIN=base sends a real transaction on ${chainName}. Re-run with CONFIRM_MAINNET=1.`);
  }
}

/** Your code as an ERC-8021 suffix. Generated, never hand-written. */
export function getDataSuffix() {
  const code = process.env.BUILDER_CODE;
  // No default on purpose: a wrong or placeholder code credits someone else.
  if (!code || ['bc_yourcode', 'bc_b7k3p9da'].includes(code)) {
    fail('Set BUILDER_CODE in .env to your own code from base.dev → Settings → Builder Code.');
  }
  if (!/^[a-z0-9_]{1,32}$/.test(code)) {
    fail(`BUILDER_CODE "${code}" isn't valid: lowercase letters, digits, and _ only (e.g. bc_ab12cd34).`);
  }
  return { code, suffix: Attribution.toDataSuffix({ codes: [code] }) };
}

export function getPrivateKey() {
  const key = process.env.PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) fail('Set PRIVATE_KEY in .env (0x + 64 hex characters).');
  return key as `0x${string}`;
}
