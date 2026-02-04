/**
 * ABI for the NIL token burn contract.
 * This contract emits LogBurnWithDigest events when tokens are burned.
 */
export const BurnContractAbi = [
  {
    type: "event",
    name: "LogBurnWithDigest",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "digest", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "function",
    name: "burnWithDigest",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "digest", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * ABI for the NIL/USD exchange rate oracle.
 */
export const ExchangeOracleAbi = [
  {
    type: "function",
    name: "latestRoundData",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;
