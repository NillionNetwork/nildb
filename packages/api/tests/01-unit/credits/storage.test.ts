import { calculateBillableStorage, calculateStorageCost } from "@nildb/workers/storage.services";
import { describe, expect, it } from "vitest";

const GB = 1024 * 1024 * 1024;

describe("calculateBillableStorage", () => {
  const freeTierBytes = 100 * 1024 * 1024; // 100MB

  it("returns 0 when storage is under free tier", () => {
    expect(calculateBillableStorage(50 * 1024 * 1024, freeTierBytes)).toBe(0);
  });

  it("returns 0 when storage equals free tier", () => {
    expect(calculateBillableStorage(freeTierBytes, freeTierBytes)).toBe(0);
  });

  it("returns difference when storage exceeds free tier", () => {
    const totalBytes = 200 * 1024 * 1024; // 200MB
    expect(calculateBillableStorage(totalBytes, freeTierBytes)).toBe(totalBytes - freeTierBytes);
  });

  it("handles 0 total bytes", () => {
    expect(calculateBillableStorage(0, freeTierBytes)).toBe(0);
  });
});

describe("calculateStorageCost", () => {
  const costPerGbHour = 0.001;

  it("returns 0 for 0 billable bytes", () => {
    expect(calculateStorageCost(0, costPerGbHour, 1)).toBe(0);
  });

  it("returns 0 for 0 hours", () => {
    expect(calculateStorageCost(GB, costPerGbHour, 0)).toBe(0);
  });

  it("calculates correctly for 1 GB over 1 hour", () => {
    expect(calculateStorageCost(GB, costPerGbHour, 1)).toBe(costPerGbHour);
  });

  it("calculates correctly for fractional GB over multiple hours", () => {
    const halfGb = GB / 2;
    const hours = 24;
    const expected = 0.5 * costPerGbHour * hours;
    expect(calculateStorageCost(halfGb, costPerGbHour, hours)).toBeCloseTo(expected);
  });

  it("handles sub-GB quantities accurately", () => {
    const tenMb = 10 * 1024 * 1024;
    const hours = 1;
    const expectedGb = tenMb / GB;
    expect(calculateStorageCost(tenMb, costPerGbHour, hours)).toBeCloseTo(expectedGb * costPerGbHour);
  });
});
