import { getBuilderAuthMode } from "@nildb/middleware/capability.middleware";
import { describe, expect, it } from "vitest";

describe("getBuilderAuthMode", () => {
  it("requires Nilauth for legacy builders", () => {
    expect(getBuilderAuthMode({})).toBe("nilauth");
  });

  it("requires self-signed authentication for credit builders", () => {
    expect(getBuilderAuthMode({ creditsUsd: 0 })).toBe("self-signed");
  });
});
