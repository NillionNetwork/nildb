import { createPublicClient, http } from "viem";

import { ExchangeOracleAbi } from "./contracts";
import type { ExchangeRate } from "./types";

/**
 * CoinGecko-style API response format.
 * Example: { "nillion": { "usd": 0.25 } }
 */
type CoinGeckoResponse = Record<string, { usd: unknown }>;

/**
 * Sanity bounds for the NIL/USD rate.
 *
 * The rate is multiplied into every credit grant, so a zero, negative, NaN or
 * absurd value from a compromised or glitching price source turns directly
 * into wrong balances. These bounds are wide enough to never bind in practice
 * and narrow enough to catch a broken feed.
 */
const MIN_NIL_USD_PRICE = 1e-6;
const MAX_NIL_USD_PRICE = 1e6;

/**
 * Validate a price before it is allowed to influence a balance.
 */
function assertUsablePrice(price: unknown, source: string): number {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new Error(`Token price from ${source} is not a finite number`);
  }
  if (price < MIN_NIL_USD_PRICE || price > MAX_NIL_USD_PRICE) {
    throw new Error(`Token price ${price} from ${source} is outside the accepted range`);
  }
  return price;
}

/**
 * Fetch the current NIL/USD exchange rate from an HTTP API (CoinGecko-compatible).
 *
 * @param apiUrl - Base URL of the price API (e.g., "http://localhost:40923")
 * @param coinId - Coin identifier (e.g., "nillion")
 * @returns The current NIL/USD price and timestamp
 */
export async function getNilUsdPriceHttp(apiUrl: string, coinId: string, apiKey?: string): Promise<ExchangeRate> {
  const url = new URL("/api/v3/simple/price", apiUrl);
  url.searchParams.set("ids", coinId);
  url.searchParams.set("vs_currencies", "usd");

  const headers: Record<string, string> = {};
  if (apiKey) {
    const headerName = apiUrl.includes("pro-api.coingecko.com") ? "x-cg-pro-api-key" : "x-cg-demo-api-key";
    headers[headerName] = apiKey;
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch token price: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as CoinGeckoResponse;
  const coinData = data[coinId];
  if (coinData?.usd === undefined) {
    throw new Error(`Token price response missing ${coinId}.usd`);
  }

  return {
    nilUsdPrice: assertUsablePrice(coinData.usd, `${coinId} price api`),
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
    nilUsdPrice: assertUsablePrice(nilUsdPrice, "price oracle"),
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
