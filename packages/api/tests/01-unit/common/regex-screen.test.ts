import { findUnsafePattern, hasNestedQuantifier, screenPattern } from "@nildb/common/regex";
import { validateData, validateSchema } from "@nildb/common/validator";
import { Effect as E, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("hasNestedQuantifier", () => {
  it.each(["^(a+)+$", "(a*)*", "(\\d+)+", "^((ab)+)+$", "(a+){2,}", "x(y(z+)*)"])("flags %s", (pattern) => {
    expect(hasNestedQuantifier(pattern)).toBe(true);
  });

  it.each(["^[a-z]+$", "^\\d{4}-\\d{2}-\\d{2}$", "(abc)+", "^(cat|dog)$", "a{2}b{3}", "[(+*)]+"])(
    "allows %s",
    (pattern) => {
      expect(hasNestedQuantifier(pattern)).toBe(false);
    },
  );

  it("treats an escaped paren as a literal", () => {
    expect(hasNestedQuantifier("\\(a+\\)+")).toBe(false);
  });
});

describe("screenPattern", () => {
  it("rejects an over-long pattern", () => {
    expect(screenPattern("a".repeat(301))).toContain("exceeds");
  });

  it("accepts an ordinary pattern", () => {
    expect(screenPattern("^[a-z]+$")).toBeNull();
  });
});

describe("findUnsafePattern", () => {
  it("finds a pattern nested inside a schema", () => {
    const schema = {
      type: "array",
      items: { type: "object", properties: { x: { type: "string", pattern: "^(a+)+$" } } },
    };

    expect(findUnsafePattern(schema)?.pattern).toBe("^(a+)+$");
  });

  it("checks patternProperties keys", () => {
    expect(findUnsafePattern({ patternProperties: { "(x*)*": { type: "string" } } })?.pattern).toBe("(x*)*");
  });

  it("returns null for a safe schema", () => {
    expect(findUnsafePattern({ type: "string", pattern: "^[0-9]{4}$" })).toBeNull();
  });
});

describe("schema validation", () => {
  const catastrophic = {
    type: "array",
    items: { type: "object", properties: { x: { type: "string", pattern: "^(a+)+$" } } },
  };

  it("refuses to register a collection schema with a catastrophic pattern", () => {
    expect(Exit.isFailure(E.runSyncExit(validateSchema(catastrophic)))).toBe(true);
  });

  it("refuses to validate data against a stored catastrophic pattern", () => {
    // Schemas stored before the screen existed must not be able to stall the
    // event loop either.
    const exit = E.runSyncExit(validateData(catastrophic, [{ x: `${"a".repeat(30)}!` }]));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("still accepts an ordinary schema", () => {
    const schema = {
      type: "array",
      items: { type: "object", properties: { x: { type: "string", pattern: "^[a-z]+$" } } },
    };

    expect(Exit.isSuccess(E.runSyncExit(validateSchema(schema)))).toBe(true);
    expect(Exit.isSuccess(E.runSyncExit(validateData(schema, [{ x: "abc" }])))).toBe(true);
  });
});
