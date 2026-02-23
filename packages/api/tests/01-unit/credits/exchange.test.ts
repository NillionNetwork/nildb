import { describe, expect, it } from "vitest";

import { unilsToUsd, usdToUnils } from "@nillion/nilpay-client";

describe("unilsToUsd", () => {
  it("converts 1 NIL (1_000_000 unils) at $0.25 to $0.25", () => {
    expect(unilsToUsd(1_000_000n, 0.25)).toBe(0.25);
  });

  it("converts 0 unils to $0", () => {
    expect(unilsToUsd(0n, 0.25)).toBe(0);
  });

  it("converts 500_000 unils (0.5 NIL) at $1 to $0.5", () => {
    expect(unilsToUsd(500_000n, 1.0)).toBe(0.5);
  });

  it("converts large amounts correctly", () => {
    // 10 NIL at $2 = $20
    expect(unilsToUsd(10_000_000n, 2.0)).toBe(20);
  });
});

describe("usdToUnils", () => {
  it("converts $1 at $0.25/NIL to 4_000_000 unils (4 NIL)", () => {
    expect(usdToUnils(1.0, 0.25)).toBe(4_000_000n);
  });

  it("converts $0 to 0 unils", () => {
    expect(usdToUnils(0, 0.25)).toBe(0n);
  });

  it("converts $1 at $1/NIL to 1_000_000 unils", () => {
    expect(usdToUnils(1.0, 1.0)).toBe(1_000_000n);
  });

  it("floors fractional unils via Math.floor", () => {
    // $1 at $3/NIL = 0.333... NIL = 333333.333... unils → floors to 333333
    const result = usdToUnils(1.0, 3.0);
    expect(result).toBe(333333n);
  });

  it("floors when floating point produces sub-unil fractions", () => {
    // $0.01 / $0.1 = 0.09999...NIL due to IEEE754 → floors to 99999 unils
    const result = usdToUnils(0.01, 0.1);
    expect(result).toBe(99_999n);
  });
});
