import { Effect as E, Either, pipe } from "effect";
import { describe, expect, it } from "vitest";
import { injectVariablesIntoAggregation } from "#/queries/service";

describe("inject.variable.pipeline.test", () => {
  it("replaces simple variables", () => {
    const pipeline = [
      {
        $match: { wallet: "##address" },
      },
    ];
    const variables = { address: "abc123" };
    const actual = pipe(
      injectVariablesIntoAggregation(pipeline, variables),
      E.runSync,
    );
    const expected = [
      {
        $match: { wallet: "abc123" },
      },
    ];

    expect(actual).toEqual(expected);
  });

  it("replaces multiple variable types", () => {
    const pipeline = [
      {
        $match: {
          wallet: "##address",
          amount: "##value",
          active: "##isActive",
        },
      },
    ];
    const variables = {
      address: "abc123",
      value: 1000,
      isActive: false,
    };
    const actual = pipe(
      injectVariablesIntoAggregation(pipeline, variables),
      E.runSync,
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

    expect(actual).toEqual(expected);
  });

  it("throws error for missing variables", () => {
    const pipeline = [
      {
        $match: { wallet: "##address" },
      },
    ];
    const variables = {};
    const result = pipe(
      injectVariablesIntoAggregation(pipeline, variables),
      E.either,
      E.runSync,
    );

    expect(Either.isLeft(result)).toBeTruthy();

    if (Either.isLeft(result)) {
      const error = result.left;
      expect(error.reason).toContain("Missing pipeline variable");
      expect(error.reason).toContain("##address");
    }
  });

  it("handles complex pipeline with multiple stages", () => {
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
          total: { $sum: "##valueField" },
        },
      },
    ];
    const variables = {
      status: "active",
      startDate: "2024-01-01",
      collection: "users",
      localField: "userId",
      groupField: "category",
      valueField: 1,
    };
    const actual = pipe(
      injectVariablesIntoAggregation(pipeline, variables),
      E.runSync,
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

    expect(actual).toEqual(expected);
  });

  it("handles deeply nested structures with arrays and objects", () => {
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
    const variables = {
      type1: "special",
      category1: "A",
      category2: "B",
      status: "active",
      deepValue: "nested-value",
    };
    const actual = pipe(
      injectVariablesIntoAggregation(pipeline, variables),
      E.runSync,
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

    expect(actual).toEqual(expected);
  });
});
