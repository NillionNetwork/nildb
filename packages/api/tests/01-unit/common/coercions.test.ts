import { applyCoercions, type CoercibleMap } from "@nildb/common/coercion";
import { Effect as E, Exit } from "effect";
import { UUID } from "mongodb";
import { describe, expect, it } from "vitest";

describe("coercion.test.js", () => {
  it("should return the original map if no $coerce key is present", () => {
    const data = { a: 1, b: "test" };

    const exit = E.runSyncExit(applyCoercions(data));
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual(data);
    }
  });

  describe("Primitive Coercion", () => {
    it("should coerce a value to a string", () => {
      const data = {
        value: 123,
        $coerce: { value: "string" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual({ value: "123" });
      }
    });

    it("should coerce a value to a number", () => {
      const data = {
        value: "123.45",
        $coerce: { value: "number" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual({ value: 123.45 });
      }
    });

    it("should coerce a value to a boolean", () => {
      const data = {
        value: "true",
        $coerce: { value: "boolean" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual({ value: true });
      }
    });
  });

  describe("Date Coercion", () => {
    it("should coerce a valid date-time string to a Date object", () => {
      const dateStr = "2024-01-01T12:00:00.000Z";
      const data = {
        value: dateStr,
        $coerce: { value: "date" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual({ value: new Date(dateStr) });
      }
    });

    it("should coerce a date-only string due to zod.coerce.date()'s flexibility", () => {
      const data = {
        value: "2024-01-01",
        $coerce: { value: "date" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual({ value: new Date(data.value) });
      }
    });

    it("should fail to coerce an invalid date string", () => {
      const data = {
        value: "not-a-date",
        $coerce: { value: "date" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const tag = (exit.cause as any).error._tag;
        expect(tag).toEqual("DataValidationError");
      }
    });
  });

  describe("UUID Coercion", () => {
    it("should coerce a valid UUID string to a UUID object", () => {
      const uuidStr = "3f5c92dd-214a-49b5-a129-e56c29fe5d3a";
      const data = {
        value: uuidStr,
        $coerce: { value: "uuid" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual({ value: new UUID(uuidStr) });
      }
    });

    it("should fail to coerce an invalid UUID string", () => {
      const data = {
        value: "not-a-uuid",
        $coerce: { value: "uuid" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const tag = (exit.cause as any).error._tag;
        expect(tag).toEqual("DataValidationError");
      }
    });
  });

  describe("Nested Path and Operator Coercion", () => {
    it("should coerce items within a query operator like $in", () => {
      const uuidStrs = [
        "3f5c92dd-214a-49b5-a129-e56c29fe5d3a",
        "c9a1d2b8-7c8c-4f5b-9d5a-8d7d6f5e4c3b",
      ];
      const data = {
        _id: { $in: uuidStrs },
        $coerce: { "_id.$in": "uuid" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data)) as any;
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        const { _id } = exit.value as any;
        expect(_id.$in[0]).toBeInstanceOf(UUID);
        expect(_id.$in[1]).toBeInstanceOf(UUID);
      }
    });

    it("should coerce a value in a deeply nested object", () => {
      const uuidStr = "a1b2c3d4-1234-5678-9abc-def123456789";
      const data = {
        foo: { bar: { baz: uuidStr } },
        $coerce: { "foo.bar.baz": "uuid" },
      } satisfies CoercibleMap;

      const exit = E.runSyncExit(applyCoercions(data));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        const result = exit.value as any;
        expect(result.foo.bar.baz).toBeInstanceOf(UUID);
        expect(result.foo.bar.baz.toString()).toBe(uuidStr);
      }
    });
  });
});
