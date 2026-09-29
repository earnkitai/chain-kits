import { arcTestnet, base, baseSepolia } from 'viem/chains';

// Builder Codes attribute on Base; the suffix encoding is the same on any EVM chain.
export const CHAINS = { base, 'base-sepolia': baseSepolia, 'arc-testnet': arcTestnet } as const;
export const chain = CHAINS[(process.env.CHAIN ?? 'base-sepolia') as keyof typeof CHAINS];
