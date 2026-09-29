import { Attribution } from 'ox/erc8021';

/**
 * Your Base Builder Code: base.dev → Settings → Builder Code, or for an agent's wallet,
 * POST https://api.base.dev/v1/agents/builder-codes {"walletAddress":"0x..."} (no login;
 * the same wallet always gets the same code). Looks like "bc_b7k3p9da".
 */
export const BUILDER_CODE = process.env.BUILDER_CODE ?? 'bc_b7k3p9da';

/** ERC-8021 suffix appended to calldata. Always generate it; don't hand-write the hex. */
export const DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
