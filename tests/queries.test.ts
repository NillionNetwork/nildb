import { UUID } from "mongodb";
import { describe } from "vitest";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { CollectionName } from "#/common/mongo";
import type { SchemaDocument } from "#/schemas/schemas.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { expectAccount } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("query.test.ts", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;

  // don't pass in query since this suite is testing query creation
  const { it, beforeAll, afterAll } = createTestFixtureExtension({ schema });
  beforeAll(async (_ctx) => {
    query.schema = schema.id;
  });

  afterAll(async (_c) => {});

  it("can list queries (expect 0)", async ({ c }) => {
    const { expect, builder } = c;
    const { data } = await builder.listQueries(c).expectSuccess();
    expect(data).toHaveLength(0);
  });

  it("can add a query", async ({ c }) => {
    const { builder } = c;
    query.id = new UUID();
    await builder
      .addQuery(c, {
        _id: query.id,
        name: query.name,
        schema: query.schema,
        variables: query.variables,
        pipeline: query.pipeline,
      })
      .expectSuccess();
  });

  it("can list queries (expect 1)", async ({ c }) => {
    const { expect, builder } = c;
    const { data } = await builder.listQueries(c).expectSuccess();
    expect(data).toHaveLength(1);
  });

  it("can delete a query", async ({ c }) => {
    const { expect, bindings, builder } = c;

    await builder
      .deleteQuery(c, {
        id: query.id,
      })
      .expectSuccess();

    const queryDocument = await bindings.db.primary
      .collection<SchemaDocument>(CollectionName.Schemas)
      .findOne({ _id: query.id });

    expect(queryDocument).toBeNull();

    const account = await expectAccount<OrganizationAccountDocument>(
      c,
      builder.did,
    );
    expect(account.queries).toHaveLength(0);
  });
});
