/**
 * Sends one check-in to CHECKIN with the codes on it, then reads them back from the chain.
 *   npm run check-in        (settings from .env)
 */
import { Attribution } from 'ox/erc8021';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { checkinAbi } from './browser.ts';
import { dataSuffix } from './attribution.ts';
import { confirmMainnet, getBuilderCode, getChain, getCheckin, getPrivateKey } from './env.ts';

const chain = getChain();
confirmMainnet(chain.name);
const account = privateKeyToAccount(getPrivateKey());
const wallet = createWalletClient({ account, chain, transport: http(), dataSuffix: dataSuffix(getBuilderCode()) });
const reader = createPublicClient({ chain, transport: http() });
const hash = await wallet.writeContract({ address: getCheckin(), abi: checkinAbi, functionName: 'checkIn', args: ['hello'], account, chain });
await reader.waitForTransactionReceipt({ hash });
const tx = await reader.getTransaction({ hash });
const found = (Attribution.fromData(tx.input) as { codes?: readonly string[] } | undefined)?.codes ?? [];
console.log(`${chain.name} tx ${hash}: Builder Codes ${found.join(', ') || 'none'}`);
