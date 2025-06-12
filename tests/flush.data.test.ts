import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { Permissions } from "#/users/users.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { assertDocumentCount } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("flush data collection", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection: schema,
    query,
  });

  const collectionSize = 100;
  type Record = {
    _id: UuidDto;
    name: string;
  };
  const data: Record[] = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async (c) => {
    const { builder, user } = c;

    await builder
      .uploadOwnedData(c, {
        userId: user.did,
        collection: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("can flush a collection", async ({ c }) => {
    const { expect, builder } = c;

    await assertDocumentCount(c, schema.id, collectionSize);

    const result = await builder
      .flushData(c, {
        schema: schema.id,
      })
      .expectSuccess();

    expect(result.data.deletedCount).toBe(collectionSize);
    await assertDocumentCount(c, schema.id, 0);
  });
});
