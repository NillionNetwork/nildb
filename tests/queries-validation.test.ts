import { Did } from "@nillion/nuc";
import { Effect as E, Either, pipe } from "effect";
import { UUID } from "mongodb";
import { describe, it } from "vitest";
import { validateQuery } from "#/queries/queries.services";
import type {
  QueryArrayVariable,
  QueryDocument,
  QueryVariable,
} from "#/queries/queries.types";

describe("query definition", () => {
  it("valid query", async ({ expect }) => {
    const variables: Record<string, QueryVariable | QueryArrayVariable> = {
      minAmount: {
        type: "number",
        description: "Minimum amount filter",
        path: "$.pipeline[0].$match.amount.$gte",
      },
      status: {
        type: "string",
        description: "Status to filter by",
        path: "$.pipeline[0].$match.status",
      },
      startDate: {
        type: "date",
        description: "Start date filter",
        path: "$.pipeline[0].$match.timestamp.$gte",
      },
    };

    const pipeline = [
      {
        $match: {
          amount: {
            $gte: 0,
          },
          status: "",
          timestamp: {
            $gte: "1970-01-01T00:00:00.000Z",
          },
        },
      },
      {
        $group: {
          _id: "$status",
          totalAmount: {
            $sum: "$amount",
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          totalAmount: -1,
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

  it("valid array query", async ({ expect }) => {
    const variables: Record<string, QueryVariable | QueryArrayVariable> = {
      values: {
        type: "array",
        description: "The values to find",
        items: {
          type: "number",
        },
        path: "$.pipeline[0].$match.values",
      },
    };

    const pipeline = [
      {
        $match: {
          values: [1, 2, 3, 4, 5],
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

  it("unexpected type", async ({ expect }) => {
    const variables: Record<string, QueryVariable | QueryArrayVariable> = {
      minAmount: {
        type: "number",
        description: "Minimum amount filter",
        path: "$.pipeline[0].$match.amount.$gte",
      },
    };

    const pipeline = [
      {
        $match: {
          amount: {
            $gte: "",
          },
        },
      },
    ];

    const result = pipe(
      validateQuery(buildQuery(variables, pipeline)),
      E.either,
      E.runSync,
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      const error = result.left.humanize();
      expect(error[0]).toBe("DataValidationError");
      expect(error[1]).toBe('Expected number, received string at "minAmount"');
    }
  });

  it("unexpected inner type", async ({ expect }) => {
    const variables: Record<string, QueryVariable | QueryArrayVariable> = {
      values: {
        type: "array",
        description: "The values to find",
        items: {
          type: "number",
        },
        path: "$.pipeline[0].$match.values",
      },
    };

    const pipeline = [
      {
        $match: {
          values: [1, 2, "3", 4, 5],
        },
      },
    ];

    const result = pipe(
      validateQuery(buildQuery(variables, pipeline)),
      E.either,
      E.runSync,
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      const error = result.left.humanize();
      expect(error[0]).toBe("DataValidationError");
      expect(error[1]).toBe('Expected number, received string at "values"');
    }
  });

  it("variable not found", async ({ expect }) => {
    const variables: Record<string, QueryVariable | QueryArrayVariable> = {
      minAmount: {
        type: "number",
        description: "Minimum amount filter",
        path: "$.pipeline[0].$match.amount.$gte",
      },
      status: {
        type: "string",
        description: "Status to filter by",
        path: "$.pipeline[0].$match.status",
      },
    };

    const pipeline = [
      {
        $match: {
          amount: {
            $gte: 0,
          },
        },
      },
    ];

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
});

function buildQuery(
  variables: Record<string, QueryVariable | QueryArrayVariable>,
  pipeline: Record<string, unknown>[],
): QueryDocument {
  return {
    _id: new UUID(),
    _created: new Date(),
    _updated: new Date(),
    owner: new Did(Uint8Array.from(Array(33).fill(0xaa))).toString(),
    name: "variables.wallet.query.json",
    schema: new UUID(),
    variables,
    pipeline,
  };
}
