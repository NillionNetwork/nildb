/**
 * Payment helper for activating subscriptions via real ERC-20 burns on Anvil.
 *
 * This module provides utilities to perform the full payment flow:
 * 1. Create payment resource from nilauth
 * 2. Approve BurnWithDigest contract to spend tokens
 * 3. Burn tokens with the payment digest
 * 4. Validate payment with nilauth
 */

import type { NilauthClient } from "@nillion/nilauth-client";
import { type Did, Signer } from "@nillion/nuc";
import { bytesToHex } from "@noble/hashes/utils.js";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

// Contract addresses from nil-devnet DeployLocal.s.sol (deterministic)
const CONTRACTS = {
  mockErc20: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const,
  burnWithDigest: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const,
};

// Anvil test user account (Account 1, has ~9,000 mNIL after deployment)
// This is a well-known Anvil default account - safe to hardcode for local dev
const ANVIL_TEST_USER = {
  privateKey:
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const,
  address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const,
};

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const burnAbi = [
  {
    name: "burnWithDigest",
    type: "function",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "digest", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Activates a subscription by performing a real ERC-20 burn on Anvil.
 *
 * The payer is always the Anvil test account (which has mNIL tokens).
 * The subscriber can be any DID.
 *
 * If the subscription is already active (412 error), this function
 * silently succeeds since the goal is achieved.
 *
 * @param nilauth - NilauthClient instance
 * @param subscriberDid - The DID to activate the subscription for
 * @param rpcUrl - Anvil RPC URL (defaults to localhost:30545 for docker setup)
 */
export async function activateSubscriptionWithPayment(
  nilauth: NilauthClient,
  subscriberDid: Did,
  rpcUrl = "http://127.0.0.1:30545",
): Promise<void> {
  // The payer is always the Anvil test account (has the mNIL tokens)
  // We derive a NUC signer from the same private key for validatePayment authorization
  const payerPrivateKeyHex = ANVIL_TEST_USER.privateKey.slice(2); // remove 0x prefix
  const payerSigner = Signer.fromPrivateKey(payerPrivateKeyHex);
  const payerDid = await payerSigner.getDid();

  // Create viem clients for Ethereum transactions
  const ethAccount = privateKeyToAccount(ANVIL_TEST_USER.privateKey);
  const walletClient = createWalletClient({
    account: ethAccount,
    chain: foundry,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(rpcUrl),
  });

  // Step 1: Create payment resource (subscriber can be anyone, payer is test account)
  const { resourceHash, payload } = nilauth.createPaymentResource(
    subscriberDid,
    "nildb",
    payerDid,
  );

  // Step 2: Approve burn contract to spend tokens
  const amount = parseUnits("1", 6); // 1 mNIL per subscription (NIL token has 6 decimals)
  const approveHash = await walletClient.writeContract({
    address: CONTRACTS.mockErc20,
    abi: erc20Abi,
    functionName: "approve",
    args: [CONTRACTS.burnWithDigest, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Step 3: Burn tokens with digest
  const digestHex = `0x${bytesToHex(resourceHash)}` as `0x${string}`;
  const burnHash = await walletClient.writeContract({
    address: CONTRACTS.burnWithDigest,
    abi: burnAbi,
    functionName: "burnWithDigest",
    args: [amount, digestHex],
  });
  await publicClient.waitForTransactionReceipt({ hash: burnHash });

  // Step 4: Validate payment with nilauth (payer signs the request)
  // 412 means subscription is already active, which is fine
  try {
    await nilauth.validatePayment(burnHash, payload, payerSigner);
  } catch (error: unknown) {
    // Check if this is a 412 error (subscription already active)
    // The error chain: NilauthUnreachable -> HTTPError with status 412
    const errorString = String(error);
    const causeString =
      error instanceof Error && error.cause ? String(error.cause) : "";
    const isAlreadyActive =
      errorString.includes("412") || causeString.includes("412");
    if (!isAlreadyActive) {
      throw error;
    }
    // Subscription already active - that's fine, we're done
  }
}
