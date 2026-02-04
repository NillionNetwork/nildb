import { getChainConfig, parseChainRpcUrls } from "./chains.js";
import { computeDigest, deserializePayload, serializePayload } from "./digest.js";
import { getNilUsdPrice, getNilUsdPriceHttp, unilsToUsd, usdToUnils } from "./exchange.js";
import { getProofChainHashes, hashToken, hashTokenAtIndex } from "./revocation.js";
import type { ChainConfig, ExchangeRate, PaymentPayload, PaymentValidationResult } from "./types.js";
import { getBurnEvent, validatePayment } from "./validation.js";

export type NilpayClientConfig = {
  chainRpcUrls: Map<number, string>;
  supportedChainIds: number[];
  // On-chain oracle config (Chainlink-compatible)
  exchangeOracleAddress?: `0x${string}`;
  exchangeOracleRpcUrl?: string;
  // HTTP API config (CoinGecko-compatible)
  exchangeApiUrl?: string;
  exchangeCoinId?: string;
};

/**
 * Client for payment and revocation operations.
 */
export class NilpayClient {
  private readonly chainRpcUrls: Map<number, string>;
  private readonly supportedChainIds: Set<number>;
  private readonly exchangeOracleAddress?: `0x${string}`;
  private readonly exchangeOracleRpcUrl?: string;
  private readonly exchangeApiUrl?: string;
  private readonly exchangeCoinId?: string;

  constructor(config: NilpayClientConfig) {
    this.chainRpcUrls = config.chainRpcUrls;
    this.supportedChainIds = new Set(config.supportedChainIds);
    this.exchangeOracleAddress = config.exchangeOracleAddress;
    this.exchangeOracleRpcUrl = config.exchangeOracleRpcUrl;
    this.exchangeApiUrl = config.exchangeApiUrl;
    this.exchangeCoinId = config.exchangeCoinId;
  }

  /**
   * Create a client from environment-style configuration.
   */
  static fromEnv(env: {
    chainRpcUrls: string;
    supportedChainIds: string;
    exchangeOracleAddress?: string;
    exchangeOracleRpcUrl?: string;
    exchangeApiUrl?: string;
    exchangeCoinId?: string;
  }): NilpayClient {
    const chainRpcUrls = parseChainRpcUrls(env.chainRpcUrls);
    const supportedChainIds = env.supportedChainIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10));

    return new NilpayClient({
      chainRpcUrls,
      supportedChainIds,
      exchangeOracleAddress: env.exchangeOracleAddress as `0x${string}` | undefined,
      exchangeOracleRpcUrl: env.exchangeOracleRpcUrl,
      exchangeApiUrl: env.exchangeApiUrl,
      exchangeCoinId: env.exchangeCoinId,
    });
  }

  /**
   * Check if a chain ID is supported.
   */
  isChainSupported(chainId: number): boolean {
    return this.supportedChainIds.has(chainId);
  }

  /**
   * Get the chain configuration for a chain ID.
   */
  getChainConfig(chainId: number): ChainConfig | null {
    const rpcUrl = this.chainRpcUrls.get(chainId);
    if (!rpcUrl) {
      return null;
    }
    return getChainConfig(chainId, rpcUrl);
  }

  /**
   * Compute the digest for a payment payload.
   */
  computeDigest(payload: PaymentPayload): `0x${string}` {
    return computeDigest(payload);
  }

  /**
   * Validate a payment on-chain.
   */
  async validatePayment(
    chainId: number,
    txHash: `0x${string}`,
    payload: PaymentPayload,
  ): Promise<PaymentValidationResult> {
    const chain = this.getChainConfig(chainId);
    if (!chain) {
      return {
        valid: false,
        reason: `Chain ${chainId} is not configured`,
      };
    }

    return validatePayment(chain, txHash, payload);
  }

  /**
   * Get the current NIL/USD exchange rate.
   * Prefers HTTP API if configured, falls back to on-chain oracle.
   */
  async getNilUsdPrice(): Promise<ExchangeRate> {
    // Prefer HTTP API (simpler, faster)
    if (this.exchangeApiUrl && this.exchangeCoinId) {
      return getNilUsdPriceHttp(this.exchangeApiUrl, this.exchangeCoinId);
    }
    // Fall back to on-chain oracle
    if (this.exchangeOracleAddress && this.exchangeOracleRpcUrl) {
      return getNilUsdPrice(this.exchangeOracleAddress, this.exchangeOracleRpcUrl);
    }
    throw new Error("Exchange rate not configured: set either HTTP API or on-chain oracle");
  }

  /**
   * Convert NIL unils to USD.
   */
  unilsToUsd(amountUnils: bigint, nilUsdPrice: number): number {
    return unilsToUsd(amountUnils, nilUsdPrice);
  }

  /**
   * Convert USD to NIL unils.
   */
  usdToUnils(usdAmount: number, nilUsdPrice: number): bigint {
    return usdToUnils(usdAmount, nilUsdPrice);
  }
}

// Re-export utilities for direct use
export { computeDigest, deserializePayload, serializePayload } from "./digest.js";

export { getNilUsdPrice, getNilUsdPriceHttp, unilsToUsd, usdToUnils } from "./exchange.js";

export { getBurnEvent, validatePayment } from "./validation.js";

export { getProofChainHashes, hashToken, hashTokenAtIndex } from "./revocation.js";

export { getChainConfig, parseChainRpcUrls, KnownChains } from "./chains.js";
