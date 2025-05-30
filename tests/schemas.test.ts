import { StatusCodes } from "http-status-codes";
import { UUID } from "mongodb";
import { describe } from "vitest";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { CollectionName } from "#/common/mongo";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { UploadResult } from "#/data/data.repository";
import type { SchemaDocument } from "#/schemas/schemas.repository";
import type { SchemaMetadata } from "#/schemas/schemas.types";
import schemaJson from "./data/wallet.schema.json";
import {
  assertDefined,
  assertDocumentCount,
  expectAccount,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("schemas.test.ts", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (ctx) => {
    await ctx.organization.ensureSubscriptionActive();
  });
  afterAll(async (_c) => {});

  it("can list schemas (expect 0)", async ({ c }) => {
    const { expect, organization } = c;

    const response = await organization.listSchemas();

    const result = await expectSuccessResponse<SchemaDocument[]>(c, response);
    expect(result.data).toHaveLength(0);
  });

  it("can add schema", async ({ c }) => {
    const { expect, bindings, organization } = c;

    const _id = new UUID();
    const response = await organization.addSchema({
      _id,
      name: schema.name,
      schema: schema.schema,
      documentType: schema.documentType,
    });

    expect(response.status).toBe(StatusCodes.CREATED);

    const document = await bindings.db.primary
      .collection(CollectionName.Accounts)
      .findOne({
        schemas: { $elemMatch: { $in: [_id] } },
      });
    assertDefined(c, document);

    schema.id = _id;
  });

  it("can upload data", async ({ c }) => {
    const { expect, bindings, organization } = c;

    const response = await organization.uploadData({
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          wallet: "0x1",
          country: "GBR",
          age: 42,
        },
      ],
    });

    const result = await expectSuccessResponse<UploadResult>(c, response);
    expect(result.data.created).toHaveLength(1);

    const data = await bindings.db.data
      .collection(schema.id.toString())
      .find()
      .toArray();

    expect(data).toHaveLength(1);
    expect(data[0]?.age).toBe(42);
  });

  it("can list schemas (expect 1)", async ({ c }) => {
    const { expect, organization } = c;

    const response = await organization.listSchemas();

    const result = await expectSuccessResponse<SchemaDocument[]>(c, response);
    expect(result.data).toHaveLength(1);
  });

  it("can get schema metadata", async ({ c }) => {
    const { expect, organization } = c;

    const response = await organization.getSchemaMetadata(
      schema.id.toString() as UuidDto,
    );

    const result = await expectSuccessResponse<SchemaMetadata>(c, response);
    expect(result.data.id).toBe(schema.id.toString());
    expect(result.data.count).toBe(1);
  });

  it("can delete schema", async ({ c }) => {
    const { expect, bindings, organization } = c;

    const id = schema.id;
    const response = await organization.deleteSchema({
      id,
    });
    expect(response.status).toBe(StatusCodes.NO_CONTENT);

    const schemaDocument = await bindings.db.primary
      .collection<SchemaDocument>(CollectionName.Schemas)
      .findOne({ _id: id });

    expect(schemaDocument).toBeNull();

    const organizationDocument =
      await expectAccount<OrganizationAccountDocument>(c, organization.did);
    expect(organizationDocument.schemas).toHaveLength(0);

    await assertDocumentCount(c, id, 0);
  });
});
