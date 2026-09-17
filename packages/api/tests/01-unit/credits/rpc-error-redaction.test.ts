import { toSafeRpcErrorName } from "@nildb/credits/ethereum.services";
import { describe, expect, it } from "vitest";

describe("toSafeRpcErrorName", () => {
  it("keeps a conventional error class without exposing its message", () => {
    const error = new Error("URL: https://rpc.example/secret-api-key");
    error.name = "HttpRequestError";

    expect(toSafeRpcErrorName(error)).toBe("HttpRequestError");
    expect(toSafeRpcErrorName(error)).not.toContain("secret-api-key");
  });

  it("rejects attacker-controlled error names", () => {
    const error = new Error("failure");
    error.name = "URL: https://rpc.example/secret-api-key";

    expect(toSafeRpcErrorName(error)).toBe("Error");
  });
});
