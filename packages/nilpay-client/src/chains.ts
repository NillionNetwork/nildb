import type { ChainConfig } from "./types.js";

/**
 * Known chain configurations.
 * RPC URLs are left empty and should be configured at runtime.
 */
export const KnownChains: Record<number, Omit<ChainConfig, "rpcUrl">> = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: "Ethereum Mainnet",
    nilTokenAddress: "0x0000000000000000000000000000000000000000", // TODO: Set real address
    burnContractAddress: "0x0000000000000000000000000000000000000000", // TODO: Set real address
  },
  // Ethereum Sepolia
  11155111: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    nilTokenAddress: "0x0000000000000000000000000000000000000000", // TODO: Set real address
    burnContractAddress: "0x0000000000000000000000000000000000000000", // TODO: Set real address
  },
  // Nillion L2 (placeholder chain ID)
  0x4e494c: {
    chainId: 0x4e494c,
    name: "Nillion L2",
    nilTokenAddress: "0x0000000000000000000000000000000000000000", // TODO: Set real address
    burnContractAddress: "0x0000000000000000000000000000000000000000", // TODO: Set real address
  },
  // Anvil (local development)
  31337: {
    chainId: 31337,
    name: "Anvil (Local)",
    nilTokenAddress: "0x0000000000000000000000000000000000000000", // Configured at test time
    burnContractAddress: "0x0000000000000000000000000000000000000000", // Configured at test time
  },
};

/**
 * Get chain config by chain ID.
 */
export function getChainConfig(chainId: number, rpcUrl: string): ChainConfig | null {
  const known = KnownChains[chainId];
  if (!known) {
    return null;
  }
  return {
    ...known,
    rpcUrl,
  };
}

/**
 * Parse chain RPC URLs from environment format.
 * Format: "chainId:url,chainId:url,..."
 * Example: "1:https://eth.rpc.com,11155111:https://sepolia.rpc.com"
 */
export function parseChainRpcUrls(input: string): Map<number, string> {
  const result = new Map<number, string>();
  const entries = input
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) {
      throw new Error(`Invalid chain RPC format: "${entry}". Expected "chainId:url"`);
    }
    const chainIdStr = entry.slice(0, colonIndex);
    const url = entry.slice(colonIndex + 1);
    const chainId = Number.parseInt(chainIdStr, 10);
    if (Number.isNaN(chainId)) {
      throw new Error(`Invalid chain ID: "${chainIdStr}"`);
    }
    result.set(chainId, url);
  }

  return result;
}
