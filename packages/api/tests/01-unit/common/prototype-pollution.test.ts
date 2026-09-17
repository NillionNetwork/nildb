import { applyCoercions, type CoercibleMap } from "@nildb/common/coercion";
import { isUnsafePath } from "@nildb/common/paths";
import { injectVariablesIntoAggregation } from "@nildb/queries/queries.services";
import { Effect as E, Exit } from "effect";
import { describe, expect, it } from "vitest";

// Regression tests: `es-toolkit`'s set() only refuses `__proto__`, so a path
// routed through `constructor.prototype` reaches Object.prototype and corrupts
// every object in the process. Both entry points below take the path from a
// request body.

describe("prototype pollution guards", () => {
  describe("isUnsafePath", () => {
    it.each([
      "__proto__",
      "__proto__.polluted",
      "constructor.prototype.toString",
      "a.constructor.prototype.x",
      'a["constructor"]["prototype"].x',
      "a.prototype.x",
    ])("rejects %s", (path) => {
      expect(isUnsafePath(path)).toBe(true);
    });

    it.each(["filter.amount", "filter.user.id", "a[0].b", "_created"])("allows %s", (path) => {
      expect(isUnsafePath(path)).toBe(false);
    });
  });

  describe("applyCoercions", () => {
    it("fails instead of writing through constructor.prototype", () => {
      const map: CoercibleMap = {
        filter: { a: 1 },
        $coerce: { "constructor.prototype.toString": "string" },
      };

      const exit = E.runSyncExit(applyCoercions(map));

      expect(Exit.isFailure(exit)).toBe(true);
      // The prototype must be untouched.
      expect(typeof Object.prototype.toString).toBe("function");
      expect(typeof {}.toString).toBe("function");
    });

    it("still coerces ordinary nested paths", () => {
      const map: CoercibleMap = {
        filter: { amount: "100" },
        $coerce: { "filter.amount": "number" },
      };

      const result = E.runSync(applyCoercions(map));

      expect(result).toEqual({ filter: { amount: 100 } });
    });
  });

  describe("injectVariablesIntoAggregation", () => {
    it("fails instead of writing through a polluting variable path", () => {
      const exit = E.runSyncExit(
        injectVariablesIntoAggregation({ evil: { path: "$.pipeline.constructor.prototype.pwned" } }, [{ $match: {} }], {
          evil: "attacker-controlled",
        }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(({} as Record<string, unknown>).pwned).toBeUndefined();
    });

    it("still injects into an ordinary pipeline path", () => {
      const pipeline = E.runSync(
        injectVariablesIntoAggregation({ name: { path: "$.pipeline[0].$match.name" } }, [{ $match: {} }], {
          name: "alice",
        }),
      );

      expect(pipeline).toEqual([{ $match: { name: "alice" } }]);
    });
  });
});
