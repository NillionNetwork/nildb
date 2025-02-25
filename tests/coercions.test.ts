import { UUID } from "mongodb";
import { describe } from "vitest";
import { applyCoercions } from "#/common/mongo";
import { type CoercibleMap, createUuidDto } from "#/common/types";
import type { UploadResult } from "#/data/data.repository";
import schemaJson from "./data/coercions.schema.json";
import {
  expectErrorResponse,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("data operations", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
  });
  beforeAll(async (_ctx) => {});
  afterAll(async (_ctx) => {});

  it("coerces single uuid", async ({ expect }) => {
    const _id = "3f5c92dd-214a-49b5-a129-e56c29fe5d3a";
    const expected = new UUID(_id);
    const data: CoercibleMap = {
      _id,
      $coerce: {
        _id: "uuid",
      },
    };
    const coercedData = applyCoercions(data) as CoercibleMap;
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
    const coercedData = applyCoercions(data) as CoercibleMap;
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
    const coercedData = applyCoercions(data) as CoercibleMap;
    expect(coercedData._created).toStrictEqual(expected);
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
    const coercedData = applyCoercions(data) as CoercibleMap;
    const coercedDates = coercedData._created as Record<string, unknown>;
    expect(coercedDates.$in).toStrictEqual(expected);
  });

  it("do not coerce value", async ({ expect }) => {
    const _created = ["2025-02-24T17:09:00.267Z", "2025-02-24T17:09:00.267Z"];
    const data: CoercibleMap = {
      _created: {
        $in: _created,
      },
    };
    const coercedData = applyCoercions(data) as CoercibleMap;
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
    const coercedData = applyCoercions(data) as CoercibleMap;
    const coercedDates = coercedData._created as Record<string, unknown>;
    expect(coercedDates.$in).toStrictEqual(_created);
  });

  it("coerces valid data", async ({ expect, organization, bindings }) => {
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

    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });

    const result = await expectSuccessResponse<UploadResult>(response);
    expect(result.data.created).toHaveLength(1);
    expect(result.data.errors).toHaveLength(0);

    const documents = await bindings.db.data
      .collection(schema.id.toString())
      .find({})
      .toArray();

    const document = documents[0];

    expect(document._id.toString()).toBe(testId);
    expect(document.date_from_string.toISOString()).toBe(testDate);
    expect(document.numeric_from_string).toBe(Number(testDouble));
  });

  it("rejects invalid date-time strings", async ({ expect, organization }) => {
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

    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });

    const errors = await expectErrorResponse(response);

    expect(errors.errors).toHaveLength(2);
    expect(errors.errors[0]).toBe("DataValidationError");
    expect(errors.errors[1]).toBe(
      '/0/date_from_string: must match format "date-time"',
    );
  });

  it("rejects invalid numeric strings", async ({ expect, organization }) => {
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

    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });

    const errors = await expectErrorResponse(response);

    expect(errors.errors).toHaveLength(2);
    expect(errors.errors[0]).toBe("DataValidationError");
    expect(errors.errors[1]).toBe(
      '/0/numeric_from_string: must match format "numeric"',
    );
  });

  it("rejects invalid uuid strings", async ({ expect, organization }) => {
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

    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });

    const errors = await expectErrorResponse(response);

    expect(errors.errors).toHaveLength(2);
    expect(errors.errors[0]).toBe("DataValidationError");
    expect(errors.errors[1]).toBe('/0/_id: must match format "uuid"');
  });
});
