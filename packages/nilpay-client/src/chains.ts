import type { ChainConfig } from "./types";

/**
 * Known chain configurations.
 * RPC URLs are left empty and should be configured at runtime.
 */
export const KnownChains: Record<number, Omit<ChainConfig, "rpcUrl">> = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: "Ethereum Mainnet",
    nilTokenAddress: "0x7Cf9a80db3B29eE8efE3710AadB7b95270572d47",
    burnContractAddress: "0x846947028695122d5888c901a41c3B4E59760012",
  },
  // Ethereum Sepolia
  11155111: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    nilTokenAddress: "0xfa718d54f31bcf49CcaC3a79C276fa87d11E2F44",
    burnContractAddress: "0x093Cb1e70df8c8F94C2B79818DA623eE3e7e59Df",
  },
  // Nillion L2 (placeholder chain ID — not deployed yet)
  0x4e494c: {
    chainId: 0x4e494c,
    name: "Nillion L2",
    nilTokenAddress: "0x0000000000000000000000000000000000000000",
    burnContractAddress: "0x0000000000000000000000000000000000000000",
  },
  // Anvil (local development — deterministic deploy addresses)
  31337: {
    chainId: 31337,
    name: "Anvil (Local)",
    nilTokenAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    burnContractAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
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
 * Format: "chainId=url,chainId=url,..."
 * Example: "1=https://eth.rpc.com,11155111=https://sepolia.rpc.com"
 */
export function parseChainRpcUrls(input: string): Map<number, string> {
  const result = new Map<number, string>();
  const entries = input
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const eqIndex = entry.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid chain RPC format: "${entry}". Expected "chainId=url"`);
    }
    const chainIdStr = entry.slice(0, eqIndex);
    const url = entry.slice(eqIndex + 1);
    const chainId = Number.parseInt(chainIdStr, 10);
    if (Number.isNaN(chainId)) {
      throw new Error(`Invalid chain ID: "${chainIdStr}"`);
    }
    result.set(chainId, url);
  }

  return result;
}
