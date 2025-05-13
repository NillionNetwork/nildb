import { Effect as E, Either, pipe } from "effect";
import type { Document } from "mongodb";
import { describe, it } from "vitest";
import {
  type QueryRuntimeVariables,
  injectVariablesIntoAggregation,
  validateVariables,
} from "#/queries/queries.services";
import type { QueryVariable } from "#/queries/queries.types";

function executePartialQuery(
  queryVariables: Record<string, QueryRuntimeVariables>,
  pipeline: Record<string, unknown>[],
  requestVariables: Record<string, unknown>,
) {
  return E.Do.pipe(
    E.bind("variables", () =>
      validateVariables(queryVariables as Document, requestVariables),
    ),
    E.bind("pipeline", ({ variables }) =>
      injectVariablesIntoAggregation(pipeline, variables),
    ),
    E.runSync,
  );
}

describe("pipeline variable injection", () => {
  it("replaces simple variables", async ({ expect }) => {
    const queryVariables = {
      address: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.wallet",
      },
    };
    const pipeline = [
      {
        $match: { wallet: "##address" },
      },
    ];

    const requestVariables = { address: "abc123" };

    const actual = executePartialQuery(
      queryVariables,
      pipeline,
      requestVariables,
    );

    const expected = [
      {
        $match: { wallet: "abc123" },
      },
    ];

    expect(actual.pipeline).toEqual(expected);
  });

  it("replaces multiple variable types", async ({ expect }) => {
    const queryVariables = {
      address: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.wallet",
      },
      value: {
        description: "",
        type: "number",
        path: "$.pipeline[0].$match.amount",
      },
      isActive: {
        description: "",
        type: "boolean",
        path: "$.pipeline[0].$match.active",
      },
    };
    const pipeline = [
      {
        $match: {
          wallet: "##address",
          amount: 1,
          active: false,
        },
      },
    ];

    const requestVariables = {
      address: "abc123",
      value: 1000,
      isActive: false,
    };

    const actual = executePartialQuery(
      queryVariables,
      pipeline,
      requestVariables,
    );

    const expected = [
      {
        $match: {
          wallet: "abc123",
          amount: 1000,
          active: false,
        },
      },
    ];

    expect(actual.pipeline).toEqual(expected);
  });

  it("replaces optional variables", async ({ expect }) => {
    const queryVariables = {
      address: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.wallet",
        optional: true,
      },
      value: {
        description: "",
        type: "number",
        path: "$.pipeline[0].$match.amount",
        optional: true,
      },
      isActive: {
        description: "",
        type: "boolean",
        path: "$.pipeline[0].$match.active",
        optional: true,
      },
    };
    const pipeline = [
      {
        $match: {
          wallet: "##address",
          amount: 1,
          active: true,
        },
      },
    ];

    const requestVariables = {};

    const actual = executePartialQuery(
      queryVariables,
      pipeline,
      requestVariables,
    );

    const expected = [
      {
        $match: {
          wallet: "##address",
          amount: 1,
          active: true,
        },
      },
    ];

    expect(actual.pipeline).toEqual(expected);
  });

  it("throws error for unexpected variables", async ({ expect }) => {
    const queryVariables = {
      address: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.wallet",
      } as QueryVariable,
    };

    const variables = {
      address: "abc123",
      isActive: false,
    };

    const result = pipe(
      validateVariables(queryVariables, variables),
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

  it("throws error for missing variables", async ({ expect }) => {
    const queryVariables = {
      address: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.wallet",
      } as QueryVariable,
    };

    const variables = {};

    const result = pipe(
      validateVariables(queryVariables, variables),
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

  it("handles complex pipeline with multiple stages", async ({ expect }) => {
    const queryVariables = {
      status: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.status",
      },
      startDate: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match._created.$gt",
      },
      collection: {
        description: "",
        type: "string",
        path: "$.pipeline[1].$lookup.from",
      },
      localField: {
        description: "",
        type: "string",
        path: "$.pipeline[1].$lookup.localField",
      },
      groupField: {
        description: "",
        type: "string",
        path: "$.pipeline[3].$group._id.$concat[1]",
      },
      valueField: {
        description: "",
        type: "number",
        path: "$.pipeline[3].$group.total.$sum",
      },
    };
    const pipeline = [
      {
        $match: {
          status: "##status",
          _created: { $gt: "##startDate" },
        },
      },
      {
        $lookup: {
          from: "##collection",
          localField: "##localField",
          foreignField: "id",
          as: "joined",
        },
      },
      {
        $unwind: "$joined",
      },
      {
        $group: {
          _id: { $concat: ["$joined.", "##groupField"] },
          total: { $sum: 0 },
        },
      },
    ];

    const requestVariables = {
      status: "active",
      startDate: "2024-01-01",
      collection: "users",
      localField: "userId",
      groupField: "category",
      valueField: 1,
    };

    const actual = executePartialQuery(
      queryVariables,
      pipeline,
      requestVariables,
    );

    const expected = [
      {
        $match: {
          status: "active",
          _created: { $gt: "2024-01-01" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "id",
          as: "joined",
        },
      },
      {
        $unwind: "$joined",
      },
      {
        $group: {
          _id: { $concat: ["$joined.", "category"] },
          total: { $sum: 1 },
        },
      },
    ];

    expect(actual.pipeline).toEqual(expected);
  });

  it("handles deeply nested structures", async ({ expect }) => {
    const queryVariables = {
      type1: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.$or[0].type",
      },
      category1: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.$or[1].category.$in[0]",
      },
      category2: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.$or[1].category.$in[1]",
      },
      status: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.$or[2].$and[0].status",
      },
      deepValue: {
        description: "",
        type: "string",
        path: "$.pipeline[0].$match.$or[2].$and[1].nested.deep.value",
      },
    };

    const pipeline = [
      {
        $match: {
          $or: [
            { type: "##type1" },
            { category: { $in: ["##category1", "##category2"] } },
            {
              $and: [
                { status: "##status" },
                {
                  nested: {
                    deep: {
                      value: "##deepValue",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ];

    const requestVariables = {
      type1: "special",
      category1: "A",
      category2: "B",
      status: "active",
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
                {
                  nested: {
                    deep: {
                      value: "nested-value",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ];

    expect(actual.pipeline).toEqual(expected);
  });
});
