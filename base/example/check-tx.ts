/**
 * Check any transaction for a Builder Code.
 *   CHAIN=base npm run check -- 0x<tx hash>
 */
import { Attribution } from 'ox/erc8021';
import { createPublicClient, http } from 'viem';
import { chain } from './chains.ts';

const hash = process.argv[2] as `0x${string}`;
const tx = await createPublicClient({ chain, transport: http() }).getTransaction({ hash });
const found = Attribution.fromData(tx.input);
console.log(found ? `Builder Code(s): ${found.codes.join(', ')}` : 'No Builder Code on this transaction.');
