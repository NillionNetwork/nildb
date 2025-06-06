import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { assertDocumentCount } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("delete by filter data", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });

  const collectionSize = 100;
  type Record = {
    _id: UuidDto;
    name: string;
  };
  const data: Record[] = Array.from({ length: collectionSize - 3 }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async (c) => {
    data.push({ _id: createUuidDto(), name: "foo" });
    data.push({ _id: createUuidDto(), name: "bar" });
    data.push({ _id: createUuidDto(), name: "bar" });

    const shuffledData = [...data].sort(() => Math.random() - 0.5);

    const { builder, user } = c;

    await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data: shuffledData,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("rejects empty filter", async ({ c }) => {
    const { builder } = c;

    await builder
      .deleteData(c, {
        schema: schema.id,
        filter: {},
      })
      .expectFailure(
        StatusCodes.BAD_REQUEST,
        // TODO: disabled until we correctly unpack the zod error message
        // 'Filter cannot be empty at "filter"',
      );
  });

  it("can remove a single match", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder
      .deleteData(c, {
        schema: schema.id,
        filter: { name: "foo" },
      })
      .expectSuccess();

    expect(result.data.deletedCount).toBe(1);
    await assertDocumentCount(c, schema.id, collectionSize - 1);
  });

  it("can remove multiple matches", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder
      .deleteData(c, {
        schema: schema.id,
        filter: { name: "bar" },
      })
      .expectSuccess();

    expect(result.data.deletedCount).toBe(2);

    await assertDocumentCount(c, schema.id, collectionSize - 3);
  });
});
