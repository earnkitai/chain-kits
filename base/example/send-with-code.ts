/**
 * Send a transaction that carries your Builder Code, then read it back from the chain.
 *   PRIVATE_KEY=0x... CHAIN=base-sepolia npm run send
 */
import { Attribution } from 'ox/erc8021';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BUILDER_CODE, DATA_SUFFIX } from './builder-code.ts';
import { chain } from './chains.ts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Every transaction from this client gets the suffix (viem >= 2.45).
const wallet = createWalletClient({ account, chain, transport: http(), dataSuffix: DATA_SUFFIX });
const reader = createPublicClient({ chain, transport: http() });

console.log(`Builder Code ${BUILDER_CODE} → suffix ${DATA_SUFFIX}`);
const hash = await wallet.sendTransaction({ to: account.address, value: 0n });
const receipt = await reader.waitForTransactionReceipt({ hash });
const tx = await reader.getTransaction({ hash });

console.log(`${chain.name} tx ${hash}: ${receipt.status}`);
console.log('calldata ends with the ERC-8021 marker:', tx.input.endsWith('80218021802180218021802180218021'));
console.log('decoded:', Attribution.fromData(tx.input));
