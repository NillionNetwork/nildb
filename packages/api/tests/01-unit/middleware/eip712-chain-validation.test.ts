import { validateEip712ChainId } from "@nildb/middleware/capability.middleware";
import { describe, expect, it } from "vitest";

import type { Envelope } from "@nillion/nuc";

function encodeHeader(header: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(header)).toString("base64url");
}

function makeEnvelope(headers: Record<string, unknown>[]): Envelope {
  const [nucHeader, ...proofHeaders] = headers;
  return {
    nuc: {
      rawHeader: encodeHeader(nucHeader),
      rawPayload: encodeHeader({}),
      signature: new Uint8Array(),
      payload: {} as Envelope["nuc"]["payload"],
    },
    proofs: proofHeaders.map((h) => ({
      rawHeader: encodeHeader(h),
      rawPayload: encodeHeader({}),
      signature: new Uint8Array(),
      payload: {} as Envelope["nuc"]["payload"],
    })),
  };
}

describe("validateEip712ChainId", () => {
  it("should pass when supportedChainIds is empty (not configured)", () => {
    const envelope = makeEnvelope([{ typ: "nuc+eip712", alg: "ES256K", meta: { domain: { chainId: 31337 } } }]);
    expect(() => validateEip712ChainId(envelope, [])).not.toThrow();
  });

  it("should pass when EIP-712 token chainId matches a supported chain", () => {
    const envelope = makeEnvelope([{ typ: "nuc+eip712", alg: "ES256K", meta: { domain: { chainId: 31337 } } }]);
    expect(() => validateEip712ChainId(envelope, [31337, 1])).not.toThrow();
  });

  it("should reject when EIP-712 token chainId does not match any supported chain", () => {
    const envelope = makeEnvelope([{ typ: "nuc+eip712", alg: "ES256K", meta: { domain: { chainId: 11155111 } } }]);
    expect(() => validateEip712ChainId(envelope, [31337, 1])).toThrow(
      "EIP-712 token signed on chain 11155111, expected one of [31337, 1]",
    );
  });

  it("should skip native tokens and only check EIP-712 tokens", () => {
    const envelope = makeEnvelope([
      { typ: "nuc", alg: "ES256K" },
      { typ: "nuc+eip712", alg: "ES256K", meta: { domain: { chainId: 31337 } } },
    ]);
    expect(() => validateEip712ChainId(envelope, [31337])).not.toThrow();
  });

  it("should reject if any proof token has wrong chainId", () => {
    const envelope = makeEnvelope([
      { typ: "nuc", alg: "ES256K" },
      { typ: "nuc+eip712", alg: "ES256K", meta: { domain: { chainId: 1 } } },
    ]);
    expect(() => validateEip712ChainId(envelope, [31337])).toThrow(
      "EIP-712 token signed on chain 1, expected one of [31337]",
    );
  });

  it("should pass when all tokens are native (no EIP-712)", () => {
    const envelope = makeEnvelope([
      { typ: "nuc", alg: "ES256K" },
      { typ: "nuc", alg: "ES256K" },
    ]);
    expect(() => validateEip712ChainId(envelope, [31337])).not.toThrow();
  });
});
