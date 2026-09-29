/**
 * Send a 0-value transaction to yourself carrying your Builder Code, then read it back.
 *   npm run send        (settings from .env)
 */
import { Attribution } from 'ox/erc8021';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { confirmMainnet, getChain, getDataSuffix, getPrivateKey } from './env.ts';

const chain = getChain();
confirmMainnet(chain.name);
const { code, suffix } = getDataSuffix();
const account = privateKeyToAccount(getPrivateKey());

// Every transaction from this client carries the suffix (viem >= 2.45).
const wallet = createWalletClient({ account, chain, transport: http(), dataSuffix: suffix });
const reader = createPublicClient({ chain, transport: http() });

if ((await reader.getBalance({ address: account.address })) === 0n) {
  console.error(`${account.address} has no gas on ${chain.name}. Fund it first.`);
  process.exit(1);
}

const hash = await wallet.sendTransaction({ to: account.address, value: 0n });
const receipt = await reader.waitForTransactionReceipt({ hash });
const tx = await reader.getTransaction({ hash });

console.log(`${chain.name} tx ${hash}: ${receipt.status}`);
console.log(`Builder Code on it: ${Attribution.fromData(tx.input)?.codes.join(', ') ?? 'none'} (expected ${code})`);
