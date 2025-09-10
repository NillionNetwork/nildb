import { Effect as E, Either, pipe } from "effect";
import type { Document } from "mongodb";
import { UUID } from "mongodb";
import { describe, it } from "vitest";
import {
  injectVariablesIntoAggregation,
  type QueryRuntimeVariables,
  validateQuery,
  validateVariables,
} from "#/queries/queries.services";
import type { QueryDocument, QueryVariable } from "#/queries/queries.types";

describe("queries.services.ts", () => {
  describe("validateQuery", () => {
    it("should succeed for a valid query", ({ expect }) => {
      const variables: Record<string, QueryVariable> = {
        minAmount: { path: "$.pipeline[0].$match.amount.$gte" },
        status: { path: "$.pipeline[0].$match.status" },
        startDate: { path: "$.pipeline[0].$match.timestamp.$gte" },
      };
      const pipeline = [
        {
          $match: {
            amount: { $gte: 0 },
            status: "",
            timestamp: { $gte: "1970-01-01T00:00:00.000Z" },
          },
        },
      ];
      const result = pipe(
        validateQuery(buildQuery(variables, pipeline)),
        E.either,
        E.runSync,
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("should succeed for a valid array query", ({ expect }) => {
      const variables: Record<string, QueryVariable> = {
        values: { path: "$.pipeline[0].$match.values" },
      };
      const pipeline = [{ $match: { values: [1, 2, 3, 4, 5] } }];
      const result = pipe(
        validateQuery(buildQuery(variables, pipeline)),
        E.either,
        E.runSync,
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("should fail for an unsupported type in the pipeline", ({ expect }) => {
      const variables: Record<string, QueryVariable> = {
        minAmount: { path: "$.pipeline[0].$match.amount.$gte" },
      };
      const pipeline = [{ $match: { amount: { $gte: new Date() } } }];
      const result = pipe(
        validateQuery(buildQuery(variables, pipeline)),
        E.either,
        E.runSync,
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left.humanize();
        expect(error[0]).toBe("DataValidationError");
        expect(error[1]).toBe("Unsupported value type");
      }
    });

    it("should fail for an unsupported inner type in an array", ({
      expect,
    }) => {
      const variables: Record<string, QueryVariable> = {
        values: { path: "$.pipeline[0].$match.values" },
      };
      const pipeline = [{ $match: { values: [1, 2, { value: 3 }] } }];
      const result = pipe(
        validateQuery(buildQuery(variables, pipeline)),
        E.either,
        E.runSync,
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left.humanize();
        expect(error[0]).toBe("DataValidationError");
        expect(error[1]).toBe("Unsupported value type");
      }
    });

    it("should fail if a variable path is not found in the pipeline", ({
      expect,
    }) => {
      const variables: Record<string, QueryVariable> = {
        status: { path: "$.pipeline[0].$match.status" },
      };
      const pipeline = [{ $match: { amount: { $gte: 0 } } }];
      const result = pipe(
        validateQuery(buildQuery(variables, pipeline)),
        E.either,
        E.runSync,
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left.humanize();
        expect(error[0]).toBe("VariableInjectionError");
        expect(error[1]).contains("Variable path not found");
      }
    });

    function buildQuery(
      variables: Record<string, QueryVariable>,
      pipeline: Record<string, unknown>[],
    ): QueryDocument {
      return {
        _id: new UUID(),
        _created: new Date(),
        _updated: new Date(),
        owner: "did:nil:fake",
        name: "test-query",
        collection: new UUID(),
        variables,
        pipeline,
      };
    }
  });

  describe("validateVariables", () => {
    it("should fail for unexpected variables", ({ expect }) => {
      const queryVariables: Record<string, QueryVariable> = {
        address: { path: "$.pipeline[0].$match.wallet" },
      };
      const requestVariables = { address: "abc123", isActive: false };
      const result = pipe(
        validateVariables(queryVariables, requestVariables),
        E.either,
        E.runSync,
      );
      expect(Either.isLeft(result)).toBeTruthy();
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error.issues[0]).toContain("Query execution variables mismatch");
        expect(error.issues[1]).toContain("unexpected=isActive");
      }
    });

    it("should fail for missing required variables", ({ expect }) => {
      const queryVariables: Record<string, QueryVariable> = {
        address: { path: "$.pipeline[0].$match.wallet" },
      };
      const requestVariables = {};
      const result = pipe(
        validateVariables(queryVariables, requestVariables),
        E.either,
        E.runSync,
      );
      expect(Either.isLeft(result)).toBeTruthy();
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error.issues[0]).toContain("Query execution variables mismatch");
        expect(error.issues[1]).toContain("missing=address");
      }
    });
  });

  describe("injectVariablesIntoAggregation", () => {
    function executePartialQuery(
      queryVariables: Record<string, QueryVariable>,
      pipeline: Record<string, unknown>[],
      requestVariables: Record<string, unknown>,
    ) {
      return E.Do.pipe(
        E.bind("variables", () =>
          validateVariables(queryVariables as Document, requestVariables),
        ),
        E.bind("pipeline", ({ variables }) =>
          injectVariablesIntoAggregation(queryVariables, pipeline, variables),
        ),
        E.runSync,
      );
    }

    it("should replace simple variables", ({ expect }) => {
      const queryVariables: Record<string, QueryVariable> = {
        address: { path: "$.pipeline[0].$match.wallet" },
      };
      const pipeline = [{ $match: { wallet: "" } }];
      const requestVariables: QueryRuntimeVariables = {
        address: "abc123",
      };
      const actual = executePartialQuery(
        queryVariables,
        pipeline,
        requestVariables,
      );
      const expected = [{ $match: { wallet: "abc123" } }];
      expect(actual.pipeline).toEqual(expected);
    });

    it("should replace multiple variable types", ({ expect }) => {
      const queryVariables: Record<string, QueryVariable> = {
        address: { path: "$.pipeline[0].$match.wallet" },
        value: { path: "$.pipeline[0].$match.amount" },
        isActive: { path: "$.pipeline[0].$match.active" },
      };
      const pipeline = [{ $match: { wallet: "", amount: 0, active: false } }];
      const requestVariables = {
        address: "abc123",
        value: 1000,
        isActive: true,
      };
      const actual = executePartialQuery(
        queryVariables,
        pipeline,
        requestVariables,
      );
      const expected = [
        { $match: { wallet: "abc123", amount: 1000, active: true } },
      ];
      expect(actual.pipeline).toEqual(expected);
    });

    it("should handle optional variables when they are not provided", ({
      expect,
    }) => {
      const queryVariables: Record<string, QueryVariable> = {
        address: { path: "$.pipeline[0].$match.wallet", optional: true },
      };
      const pipeline = [{ $match: { wallet: "default" } }];
      const requestVariables = {};
      const actual = executePartialQuery(
        queryVariables,
        pipeline,
        requestVariables,
      );
      // Expect the pipeline to be unchanged because the optional variable was not provided
      expect(actual.pipeline).toEqual([{ $match: { wallet: "default" } }]);
    });

    it("should handle complex and deeply nested structures", ({ expect }) => {
      const queryVariables: Record<string, QueryVariable> = {
        type1: { path: "$.pipeline[0].$match.$or[0].type" },
        category1: {
          path: "$.pipeline[0].$match.$or[1].category.$in[0]",
        },
        deepValue: {
          path: "$.pipeline[0].$match.$or[2].$and[1].nested.deep.value",
        },
      };
      const pipeline = [
        {
          $match: {
            $or: [
              { type: "" },
              { category: { $in: ["", "B"] } },
              {
                $and: [
                  { status: "active" },
                  { nested: { deep: { value: "" } } },
                ],
              },
            ],
          },
        },
      ];
      const requestVariables = {
        type1: "special",
        category1: "A",
        deepValue: "nested-value",
      };
      const actual = executePartialQuery(
        queryVariables,
        pipeline,
        requestVariables,
      );
      const expected = [
        {
          $match: {
            $or: [
              { type: "special" },
              { category: { $in: ["A", "B"] } },
              {
                $and: [
                  { status: "active" },
                  { nested: { deep: { value: "nested-value" } } },
                ],
              },
            ],
          },
        },
      ];
      expect(actual.pipeline).toEqual(expected);
    });
  });
});
