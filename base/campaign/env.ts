import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { base, baseSepolia } from 'viem/chains';

/** Settings from .env (values set in the shell win), checked up front. */
const ENV_FILE = join(import.meta.dirname, '.env');
const hasEnvFile = existsSync(ENV_FILE);
if (hasEnvFile) {
  const shell = { ...process.env };
  process.loadEnvFile(ENV_FILE);
  Object.assign(process.env, shell);
}

function fail(message: string): never {
  console.error(hasEnvFile ? message : `${message}\n(No .env yet: cp .env.example .env)`);
  process.exit(1);
}

const CHAINS = { base, 'base-sepolia': baseSepolia } as const;

export function getChain() {
  const name = process.env.CHAIN;
  if (!name || !(name in CHAINS)) fail(`Set CHAIN in .env to one of: ${Object.keys(CHAINS).join(', ')}. Campaigns score base only.`);
  return CHAINS[name as keyof typeof CHAINS];
}

/** Base mainnet costs real ETH; require an explicit yes. */
export function confirmMainnet(chainName: string) {
  if (process.env.CHAIN === 'base' && process.env.CONFIRM_MAINNET !== '1')
    fail(`CHAIN=base sends a real transaction on ${chainName}. Re-run with CONFIRM_MAINNET=1.`);
}

/** Your own Builder Code from base.dev (optional). */
export const getBuilderCode = () => process.env.BUILDER_CODE?.trim() || undefined;

export function getPrivateKey() {
  const key = process.env.PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) fail('Set PRIVATE_KEY in .env (0x + 64 hex characters).');
  return key as `0x${string}`;
}

export function getCheckin() {
  const a = process.env.CHECKIN;
  if (!a || !/^0x[0-9a-fA-F]{40}$/.test(a)) fail('Set CHECKIN in .env to the address npm run deploy printed.');
  return a as `0x${string}`;
}
