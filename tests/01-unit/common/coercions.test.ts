import { Effect as E, Either, pipe } from "effect";
import { UUID } from "mongodb";
import { describe, it } from "vitest";
import { applyCoercions } from "#/common/mongo";
import type { CoercibleMap } from "#/common/types";

describe("coercions.test.ts", () => {
  it("coerces primitive values implicitly", ({ expect }) => {
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

  it("coerces primitive values to string", ({ expect }) => {
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

  it("coerces primitive values to number", ({ expect }) => {
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

  it("reject coercion from string values to number", ({ expect }) => {
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

  it("coerces primitive values to boolean", ({ expect }) => {
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

  it("reject coercion from string to boolean", ({ expect }) => {
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

  it("reject coercion from number to boolean", ({ expect }) => {
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

  it("coerces single uuid", ({ expect }) => {
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

  it("coerces multiple uuid", ({ expect }) => {
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

  it("coerces single date", ({ expect }) => {
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

  it("coerces eq date", ({ expect }) => {
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

  it("coerces multiple dates", ({ expect }) => {
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

  it("coerces mixed values", ({ expect }) => {
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

  it("do not coerce value", ({ expect }) => {
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

  it("coercible value is not defined", ({ expect }) => {
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
});
