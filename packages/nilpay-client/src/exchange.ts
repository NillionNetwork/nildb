import { createPublicClient, http } from "viem";

import { ExchangeOracleAbi } from "./contracts";
import type { ExchangeRate } from "./types";

/**
 * CoinGecko-style API response format.
 * Example: { "nillion": { "usd": 0.25 } }
 */
type CoinGeckoResponse = Record<string, { usd: number }>;

/**
 * Fetch the current NIL/USD exchange rate from an HTTP API (CoinGecko-compatible).
 *
 * @param apiUrl - Base URL of the price API (e.g., "http://localhost:40923")
 * @param coinId - Coin identifier (e.g., "nillion")
 * @returns The current NIL/USD price and timestamp
 */
export async function getNilUsdPriceHttp(apiUrl: string, coinId: string): Promise<ExchangeRate> {
  const url = new URL("/api/v3/simple/price", apiUrl);
  url.searchParams.set("ids", coinId);
  url.searchParams.set("vs_currencies", "usd");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch token price: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as CoinGeckoResponse;
  const coinData = data[coinId];
  if (!coinData?.usd) {
    throw new Error(`Token price response missing ${coinId}.usd`);
  }

  return {
    nilUsdPrice: coinData.usd,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Fetch the current NIL/USD exchange rate from an on-chain oracle.
 *
 * @param oracleAddress - Address of the Chainlink-compatible price oracle
 * @param rpcUrl - RPC URL for the chain where the oracle is deployed
 * @returns The current NIL/USD price and timestamp
 */
export async function getNilUsdPrice(oracleAddress: `0x${string}`, rpcUrl: string): Promise<ExchangeRate> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  const [latestRound, decimals] = await Promise.all([
    client.readContract({
      address: oracleAddress,
      abi: ExchangeOracleAbi,
      functionName: "latestRoundData",
    }),
    client.readContract({
      address: oracleAddress,
      abi: ExchangeOracleAbi,
      functionName: "decimals",
    }),
  ]);

  const [, answer, , updatedAt] = latestRound;
  const divisor = 10 ** decimals;
  const nilUsdPrice = Number(answer) / divisor;

  return {
    nilUsdPrice,
    timestamp: Number(updatedAt),
  };
}

/**
 * Convert NIL unils to USD value.
 * 1 NIL = 1,000,000 unils
 *
 * @param amountUnils - Amount in unils (1e-6 NIL)
 * @param nilUsdPrice - Current NIL/USD price
 * @returns USD value
 */
export function unilsToUsd(amountUnils: bigint, nilUsdPrice: number): number {
  const nilAmount = Number(amountUnils) / 1_000_000;
  return nilAmount * nilUsdPrice;
}

/**
 * Convert USD to NIL unils.
 *
 * @param usdAmount - Amount in USD
 * @param nilUsdPrice - Current NIL/USD price
 * @returns Amount in unils
 */
export function usdToUnils(usdAmount: number, nilUsdPrice: number): bigint {
  const nilAmount = usdAmount / nilUsdPrice;
  return BigInt(Math.floor(nilAmount * 1_000_000));
}
