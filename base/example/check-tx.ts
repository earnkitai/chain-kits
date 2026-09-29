/**
 * Check any transaction for a Builder Code.
 *   npm run check -- 0x<tx hash>      (CHAIN from .env)
 */
import { Attribution } from 'ox/erc8021';
import { createPublicClient, http } from 'viem';
import { getChain } from './env.ts';

const hash = process.argv[2];
if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  console.error('Usage: npm run check -- 0x<transaction hash>');
  process.exit(1);
}
const chain = getChain();
const tx = await createPublicClient({ chain, transport: http() })
  .getTransaction({ hash: hash as `0x${string}` })
  .catch(() => {
    console.error(`Transaction not found on ${chain.name}. Is CHAIN right?`);
    process.exit(1);
  });
const found = Attribution.fromData(tx.input);
console.log(found ? `Builder Code(s): ${found.codes.join(', ')}` : 'No Builder Code on this transaction.');
