import { encodeFunctionData, type Address, type Hex, type WalletClient } from 'viem';
import { dataSuffix } from './attribution.ts';

export const checkinAbi = [
  {
    type: 'function',
    name: 'checkIn',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'note', type: 'string' }],
    outputs: [],
  },
] as const;

/**
 * A check-in from a person's browser wallet, with the codes on it. Smart wallets (Base App,
 * Coinbase Smart Wallet) get them through wallet_sendCalls' dataSuffix capability; other wallets
 * get a plain transaction with the suffix appended to the calldata. Pass the codes per call: a
 * suffix set in wagmi's createConfig never reaches a connected browser wallet (wevm/wagmi#5248).
 */
export async function checkInFromWallet(
  wallet: WalletClient,
  account: Address,
  checkin: Address,
  note: string,
  builderCode?: string,
) {
  const suffix = dataSuffix(builderCode);
  const data = encodeFunctionData({ abi: checkinAbi, functionName: 'checkIn', args: [note] });
  try {
    return await wallet.sendCalls({
      account,
      chain: wallet.chain,
      calls: [{ to: checkin, data }],
      capabilities: { dataSuffix: { value: suffix, optional: true } },
    } as Parameters<WalletClient['sendCalls']>[0]);
  } catch {
    return await wallet.sendTransaction({
      account,
      chain: wallet.chain,
      to: checkin,
      data: `${data}${suffix.slice(2)}` as Hex,
    });
  }
}
