import { UUID } from "mongodb";
import { describe } from "vitest";
import type { CollectionDocument } from "#/collections/collections.types";
import { CollectionName } from "#/common/mongo";
import { createUuidDto } from "#/common/types";
import collectionJson from "./data/wallet.collection.json";
import {
  assertDefined,
  assertDocumentCount,
  expectBuilder,
} from "./fixture/assertions";
import type { CollectionFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("collections.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (ctx) => {
    await ctx.builder.ensureSubscriptionActive();
  });
  afterAll(async (_c) => {});

  it("can list collections (expect 0)", async ({ c }) => {
    const { expect, builder } = c;
    const { data } = await builder.readCollections(c).expectSuccess();
    expect(data).toHaveLength(0);
  });

  it("can add collection", async ({ c }) => {
    const { bindings, builder } = c;

    const _id = createUuidDto();
    await builder
      .createCollection(c, {
        _id,
        type: collection.type,
        name: collection.name,
        schema: collection.schema,
      })
      .expectSuccess();

    const document = await bindings.db.primary
      .collection(CollectionName.Builders)
      .findOne({
        collections: { $elemMatch: { $in: [new UUID(_id)] } },
      });
    assertDefined(c, document);

    collection.id = _id;
  });

  it("can upload data", async ({ c }) => {
    const { expect, bindings, builder, user } = c;

    const result = await builder
      .createOwnedData(c, {
        owner: user.did,
        collection: collection.id,
        data: [
          {
            _id: createUuidDto(),
            wallet: "0x1",
            country: "GBR",
            age: 42,
          },
        ],
        acl: { grantee: builder.did, read: true, write: false, execute: false },
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(1);

    const data = await bindings.db.data
      .collection(collection.id.toString())
      .find()
      .toArray();

    expect(data).toHaveLength(1);
    expect(data[0]?.age).toBe(42);
  });

  it("can list collections (expect 1)", async ({ c }) => {
    const { expect, builder } = c;

    const { data } = await builder.readCollections(c).expectSuccess();
    expect(data).toHaveLength(1);
  });

  it("can get collection metadata", async ({ c }) => {
    const { expect, builder } = c;

    const { data } = await builder
      .readCollection(c, collection.id)
      .expectSuccess();

    expect(data._id).toBe(collection.id);
    expect(data.count).toBe(1);
  });

  it("can delete collection", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const id = collection.id;
    await builder.deleteCollection(c, id).expectSuccess();

    const collectionDocument = await bindings.db.primary
      .collection<CollectionDocument>(CollectionName.Collections)
      .findOne({ _id: new UUID(id) });

    expect(collectionDocument).toBeNull();

    const builderDocument = await expectBuilder(c, builder.did);
    expect(builderDocument.collections).toHaveLength(0);

    await assertDocumentCount(c, id, 0);
  });
});
