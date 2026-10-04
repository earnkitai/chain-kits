/**
 * Deploys Checkin (src/Checkin.sol) with EarnKit's Builder Code on the deploy transaction.
 *   forge build && npm run deploy        (settings from .env)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { dataSuffix } from './attribution.ts';
import { confirmMainnet, getBuilderCode, getChain, getPrivateKey } from './env.ts';

const chain = getChain();
confirmMainnet(chain.name);
const account = privateKeyToAccount(getPrivateKey());
const wallet = createWalletClient({ account, chain, transport: http(), dataSuffix: dataSuffix(getBuilderCode()) });
const reader = createPublicClient({ chain, transport: http() });
const artifact = JSON.parse(readFileSync(join(import.meta.dirname, 'out', 'Checkin.sol', 'Checkin.json'), 'utf8'));
const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, account, chain });
const receipt = await reader.waitForTransactionReceipt({ hash });
console.log(`Checkin: ${receipt.contractAddress} (tx ${hash}), deployed from ${account.address}.`);
console.log("If that isn't the builder's payout wallet, run: npm run sign-entry -- <program id> <repo link> <payout wallet>");
