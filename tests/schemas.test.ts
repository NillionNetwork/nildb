import { UUID } from "mongodb";
import { describe } from "vitest";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { CollectionName } from "#/common/mongo";
import { createUuidDto } from "#/common/types";
import type { SchemaDocument } from "#/schemas/schemas.types";
import { Permissions } from "#/user/user.types";
import schemaJson from "./data/wallet.schema.json";
import {
  assertDefined,
  assertDocumentCount,
  expectAccount,
} from "./fixture/assertions";
import type { SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("schemas.test.ts", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (ctx) => {
    await ctx.builder.ensureSubscriptionActive();
  });
  afterAll(async (_c) => {});

  it("can list schemas (expect 0)", async ({ c }) => {
    const { expect, builder } = c;
    const { data } = await builder.listSchemas(c).expectSuccess();
    expect(data).toHaveLength(0);
  });

  it("can add schema", async ({ c }) => {
    const { bindings, builder } = c;

    const _id = new UUID();
    await builder
      .addSchema(c, {
        _id,
        name: schema.name,
        schema: schema.schema,
        documentType: schema.documentType,
      })
      .expectSuccess();

    const document = await bindings.db.primary
      .collection(CollectionName.Accounts)
      .findOne({
        schemas: { $elemMatch: { $in: [_id] } },
      });
    assertDefined(c, document);

    schema.id = _id;
  });

  it("can upload data", async ({ c }) => {
    const { expect, bindings, builder, user } = c;

    const result = await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data: [
          {
            _id: createUuidDto(),
            wallet: "0x1",
            country: "GBR",
            age: 42,
          },
        ],
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(1);

    const data = await bindings.db.data
      .collection(schema.id.toString())
      .find()
      .toArray();

    expect(data).toHaveLength(1);
    expect(data[0]?.age).toBe(42);
  });

  it("can list schemas (expect 1)", async ({ c }) => {
    const { expect, builder } = c;

    const { data } = await builder.listSchemas(c).expectSuccess();
    expect(data).toHaveLength(1);
  });

  it("can get schema metadata", async ({ c }) => {
    const { expect, builder } = c;

    const { data } = await builder
      .getSchemaMetadata(c, schema.id.toString())
      .expectSuccess();

    expect(data.id).toBe(schema.id.toString());
    expect(data.count).toBe(1);
  });

  it("can delete schema", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const id = schema.id;
    await builder.deleteSchema(c, { id }).expectSuccess();

    const schemaDocument = await bindings.db.primary
      .collection<SchemaDocument>(CollectionName.Schemas)
      .findOne({ _id: id });

    expect(schemaDocument).toBeNull();

    const organizationDocument =
      await expectAccount<OrganizationAccountDocument>(c, builder.did);
    expect(organizationDocument.schemas).toHaveLength(0);

    await assertDocumentCount(c, id, 0);
  });
});
