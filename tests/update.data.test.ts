import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import type { UpdateResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { DataDocument } from "#/data/data.repository";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { assertDefined, expectSuccessResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("update.data.test", () => {
  const userId = Keypair.generate().toDidString();
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });
  type Record = {
    _id: UuidDto;
    name: string;
  };
  const collectionSize = 100;
  const data: Record[] = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async ({ organization }) => {
    await organization.uploadData({
      userId,
      schema: schema.id,
      data,
      permissions: new Permissions(organization.did, {
        read: true,
        write: false,
        execute: false,
      }),
    });
  });

  afterAll(async (_c) => {});

  it("can update data in a collection", async ({ c }) => {
    const { expect, bindings, organization } = c;

    const record = data[Math.floor(Math.random() * collectionSize)];

    const filter = { name: record.name };
    const update = { $set: { name: "foo" } };
    const response = await organization.updateData({
      schema: schema.id,
      filter,
      update,
    });

    const result = await expectSuccessResponse<UpdateResult>(c, response);
    expect(result.data.modifiedCount).toBe(1);
    expect(result.data.matchedCount).toBe(1);

    const actual = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .findOne({ name: "foo" });

    assertDefined(c, actual);
    expect(actual._id.toString()).toBe(record._id);
  });
});
