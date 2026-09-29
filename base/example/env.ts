import { existsSync } from 'node:fs';
import { Attribution } from 'ox/erc8021';
import { arcTestnet, base, baseSepolia } from 'viem/chains';

/** Settings from .env, checked up front so mistakes fail loudly instead of misattributing. */
if (existsSync('.env')) process.loadEnvFile('.env');

function fail(message: string): never {
  console.error(message);
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

/** Your code as an ERC-8021 suffix. Generated, never hand-written. */
export function getDataSuffix() {
  const code = process.env.BUILDER_CODE;
  // No default on purpose: a wrong or placeholder code credits someone else.
  if (!code || !/^[a-z0-9_]{1,32}$/.test(code)) {
    fail('Set BUILDER_CODE in .env to your code from base.dev → Settings → Builder Code (e.g. bc_b7k3p9da).');
  }
  return { code, suffix: Attribution.toDataSuffix({ codes: [code] }) };
}

export function getPrivateKey() {
  const key = process.env.PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) fail('Set PRIVATE_KEY in .env (0x + 64 hex characters).');
  return key as `0x${string}`;
}
