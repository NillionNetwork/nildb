import { Effect as E, Either, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { UUID } from "mongodb";
import { describe } from "vitest";
import { applyCoercions } from "#/common/mongo";
import { type CoercibleMap, createUuidDto } from "#/common/types";
import { Permissions } from "#/user/user.types";
import schemaJson from "./data/coercions.schema.json";
import type { SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("coercions", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
  });
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("coerces primitive values implicitly", async ({ expect }) => {
    const _id = "string";
    const amount = 50;
    const isActive = true;
    const data: CoercibleMap = {
      _id,
      amount,
      isActive,
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    expect(coercedData._id).toStrictEqual(_id);
    expect(coercedData.amount).toStrictEqual(amount);
    expect(coercedData.isActive).toStrictEqual(isActive);
  });

  it("coerces primitive values to string", async ({ expect }) => {
    const _id = "string";
    const amount = 50;
    const isActive = true;
    const data: CoercibleMap = {
      _id,
      amount,
      isActive,
      $coerce: {
        _id: "string",
        amount: "string",
        isActive: "string",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    expect(coercedData._id).toStrictEqual(_id);
    expect(coercedData.amount).toStrictEqual(`${amount}`);
    expect(coercedData.isActive).toStrictEqual(`${isActive}`);
  });

  it("coerces primitive values to number", async ({ expect }) => {
    const _id = "100";
    const amount = 50;
    const isActive = true;
    const data: CoercibleMap = {
      _id,
      amount,
      isActive,
      $coerce: {
        _id: "number",
        amount: "number",
        isActive: "number",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    expect(coercedData._id).toStrictEqual(Number(_id));
    expect(coercedData.amount).toStrictEqual(amount);
    expect(coercedData.isActive).toStrictEqual(Number(isActive));
  });

  it("reject coercion from string values to number", async ({ expect }) => {
    const _id = "foo";
    const data: CoercibleMap = {
      _id,
      $coerce: {
        _id: "number",
      },
    };
    const result = pipe(applyCoercions(data), E.either, E.runSync);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("coerces primitive values to boolean", async ({ expect }) => {
    const _id = "true";
    const amount = 1;
    const isActive = true;
    const data: CoercibleMap = {
      _id,
      amount,
      isActive,
      $coerce: {
        _id: "boolean",
        amount: "boolean",
        isActive: "boolean",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    expect(coercedData._id).toStrictEqual(Boolean(_id));
    expect(coercedData.amount).toStrictEqual(Boolean(amount));
    expect(coercedData.isActive).toStrictEqual(isActive);
  });

  it("reject coercion from string to boolean", async ({ expect }) => {
    const _id = "foo";
    const data: CoercibleMap = {
      _id,
      $coerce: {
        _id: "boolean",
      },
    };
    const result = pipe(applyCoercions(data), E.either, E.runSync);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("reject coercion from number to boolean", async ({ expect }) => {
    const amount = 100;
    const data: CoercibleMap = {
      amount,
      $coerce: {
        amount: "boolean",
      },
    };
    const result = pipe(applyCoercions(data), E.either, E.runSync);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("coerces single uuid", async ({ expect }) => {
    const _id = "3f5c92dd-214a-49b5-a129-e56c29fe5d3a";
    const expected = new UUID(_id);
    const data: CoercibleMap = {
      _id,
      $coerce: {
        _id: "uuid",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    expect(coercedData._id).toStrictEqual(expected);
  });

  it("coerces multiple uuid", async ({ expect }) => {
    const _ids = [
      "3f5c92dd-214a-49b5-a129-e56c29fe5d3a",
      "3f5c92dd-214a-49b5-a129-e56c29fe5d3a",
    ];
    const expected = _ids.map((id) => new UUID(id));
    const data: CoercibleMap = {
      _id: {
        $in: _ids,
      },
      $coerce: {
        _id: "uuid",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    const coercedIds = coercedData._id as Record<string, unknown>;
    expect(coercedIds.$in).toStrictEqual(expected);
  });

  it("coerces single date", async ({ expect }) => {
    const _created = "2025-02-24T17:09:00.267Z";
    const expected = new Date(_created);
    const data: CoercibleMap = {
      _created,
      $coerce: {
        _created: "date",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    expect(coercedData._created).toStrictEqual(expected);
  });

  it("coerces eq date", async ({ expect }) => {
    const _created = "2025-02-24T17:09:00.267Z";
    const expected = new Date(_created);
    const data: CoercibleMap = {
      _created: {
        $eq: _created,
      },
      $coerce: {
        _created: "date",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    expect((coercedData._created as Record<string, unknown>).$eq).toStrictEqual(
      expected,
    );
  });

  it("coerces multiple dates", async ({ expect }) => {
    const _created = ["2025-02-24T17:09:00.267Z", "2025-02-24T17:09:00.267Z"];
    const expected = _created.map((date) => new Date(date));
    const data: CoercibleMap = {
      _created: {
        $in: _created,
      },
      $coerce: {
        _created: "date",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    const coercedDates = coercedData._created as Record<string, unknown>;
    expect(coercedDates.$in).toStrictEqual(expected);
  });

  it("coerces mixed values", async ({ expect }) => {
    const identifiers = [
      "3f5c92dd-214a-49b5-a129-e56c29fe5d3a",
      "3f5c92dd-214a-49b5-a129-e56c29fe5d3a",
    ];
    const expectedUuids = identifiers.map((id) => new UUID(id));
    const dates = ["2025-02-24T17:09:00.267Z", "2025-02-24T17:09:00.267Z"];
    const expectedDates = dates.map((date) => new Date(date));
    const data: CoercibleMap = {
      identifiers: {
        $in: identifiers,
      },
      dates: {
        $in: dates,
      },
      $coerce: {
        identifiers: "uuid",
        dates: "date",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    const coercedUuids = coercedData.identifiers as Record<string, unknown>;
    expect(coercedUuids.$in).toStrictEqual(expectedUuids);
    const coercedDates = coercedData.dates as Record<string, unknown>;
    expect(coercedDates.$in).toStrictEqual(expectedDates);
  });

  it("do not coerce value", async ({ expect }) => {
    const _created = ["2025-02-24T17:09:00.267Z", "2025-02-24T17:09:00.267Z"];
    const data: CoercibleMap = {
      _created: {
        $in: _created,
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    const coercedDates = coercedData._created as Record<string, unknown>;
    expect(coercedDates.$in).toStrictEqual(_created);
  });

  it("coercible value is not defined", async ({ expect }) => {
    const _created = ["2025-02-24T17:09:00.267Z", "2025-02-24T17:09:00.267Z"];
    const data: CoercibleMap = {
      _created: {
        $in: _created,
      },
      $coerce: {
        _updated: "date",
      },
    };
    const coercedData = pipe(applyCoercions(data), E.runSync) as CoercibleMap;
    const coercedDates = coercedData._created as Record<string, unknown>;
    expect(coercedDates.$in).toStrictEqual(_created);
  });

  it("coerces valid data", async ({ c }) => {
    const { expect, builder, bindings, user } = c;

    const testId = createUuidDto();
    const testDate = new Date().toISOString();
    const testDouble = "123.45";

    const data = [
      {
        _id: testId,
        date_from_string: testDate,
        numeric_from_string: testDouble,
      },
    ];

    const response = await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    expect(response.data.created).toHaveLength(1);
    expect(response.data.errors).toHaveLength(0);

    const documents = await bindings.db.data
      .collection(schema.id.toString())
      .find({})
      .toArray();

    const document = documents[0];

    expect(document._id.toString()).toBe(testId);
    expect(document.date_from_string.toISOString()).toBe(testDate);
    expect(document.numeric_from_string).toBe(Number(testDouble));
  });

  it("rejects invalid date-time strings", async ({ c }) => {
    const { builder, user } = c;

    const testId = createUuidDto();
    const notADate = new Date().toISOString().split("T")[0]; // just take date
    const testDouble = "123.45";

    const data = [
      {
        _id: testId,
        date_from_string: notADate,
        numeric_from_string: testDouble,
      },
    ];

    await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectFailure(
        StatusCodes.BAD_REQUEST,
        "DataValidationError",
        '/0/date_from_string: must match format "date-time"',
      );
  });

  it("rejects invalid numeric strings", async ({ c }) => {
    const { builder, user } = c;

    const testId = createUuidDto();
    const notADate = new Date().toISOString();
    const testDouble = "abcde"; // not numeric

    const data = [
      {
        _id: testId,
        date_from_string: notADate,
        numeric_from_string: testDouble,
      },
    ];

    await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectFailure(
        StatusCodes.BAD_REQUEST,
        "DataValidationError",
        '/0/numeric_from_string: must match format "numeric"',
      );
  });

  it("rejects invalid uuid strings", async ({ c }) => {
    const { builder, user } = c;

    const testId = "xxxx-xxxx";
    const notADate = new Date().toISOString();
    const testDouble = "42";

    const data = [
      {
        _id: testId,
        date_from_string: notADate,
        numeric_from_string: testDouble,
      },
    ];

    await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectFailure(
        StatusCodes.BAD_REQUEST,
        "DataValidationError",
        '/0/_id: must match format "uuid"',
      );
  });
});
