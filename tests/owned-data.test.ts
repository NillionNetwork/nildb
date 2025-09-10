import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { OwnedDocumentBase } from "#/data/data.types";
import collectionJson from "./data/wallet.collection.json";
import queryJson from "./data/wallet.query.json";
import { waitForQueryRun } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";
import {
  type BuilderTestClient,
  createBuilderTestClient,
  createUserTestClient,
} from "./fixture/test-client";

describe("owned-data.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });

  let builderB: BuilderTestClient;
  beforeAll(async (c) => {
    const { builder, bindings, app } = c;
    builderB = await createBuilderTestClient({
      app,
      keypair: Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_1!),
      chainUrl: process.env.APP_NILCHAIN_JSON_RPC!,
      nilauthBaseUrl: bindings.config.nilauthBaseUrl,
      nodePublicKey: builder._options.nodePublicKey,
    });

    await builderB
      .register(c, {
        did: builderB.did.didString,
        name: "builderB",
      })
      .expectSuccess();

    await builderB.ensureSubscriptionActive();
  });
  afterAll(async (_c) => {});

  type Record = {
    _id: UuidDto;
    wallet: string;
    country: string;
    age: number;
  };

  it("can't upload data with invalid permissions", async ({ c }) => {
    const { builder, user } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x1",
        country: "GBR",
        age: 20,
      },
    ];

    await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: false,
          write: false,
          execute: false,
        },
      })
      .expectFailure(StatusCodes.UNAUTHORIZED);
  });

  it("can upload data", async ({ c }) => {
    const { expect, bindings, builder, user } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x1",
        country: "GBR",
        age: 20,
      },
      {
        _id: createUuidDto(),
        wallet: "0x2",
        country: "CAN",
        age: 30,
      },
      {
        _id: createUuidDto(),
        wallet: "0x3",
        country: "GBR",
        age: 40,
      },
    ];

    const result = await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: true,
          execute: true,
        },
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data
      .collection(collection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects primary key collisions", async ({ skip, c }) => {
    skip("depends on indexes, disable until index endpoint is ready");
    const { expect, bindings, builder, user } = c;

    const data = [
      {
        _id: createUuidDto(),
        wallet: "0x1",
        country: "GBR",
        age: 30,
      },
    ];

    const result = await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectSuccess();

    expect(result.data.errors).toHaveLength(1);

    const cursor = bindings.db.data
      .collection(collection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it("allows for partial success", async ({ skip, c }) => {
    skip("depends on indexes, disable until index endpoint is ready");
    const { expect, builder, user } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x1", // collides expect failure
        country: "GBR",
        age: 30,
      },
      {
        _id: createUuidDto(),
        wallet: "0x4", // unique expect success
        country: "GBR",
        age: 30,
      },
    ];

    const result = await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectSuccess();

    expect(result.data.errors).toHaveLength(1);
    expect(result.data.created).toHaveLength(1);
  });

  it("rejects duplicates in data payload", async ({ skip, c }) => {
    skip("depends on indexes, disable until index endpoint is ready");
    const { expect, builder, user } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x4",
        country: "GBR",
        age: 30,
      },
      {
        _id: createUuidDto(),
        wallet: "0x4",
        country: "GBR",
        age: 30,
      },
    ];

    await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectSuccess();

    const cursor = c.bindings.db.data
      .collection(collection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(4);
  });

  it("rejects data that does not conform", async ({ c }) => {
    const { builder, user } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        // @ts-expect-error should be string but want to check rejection
        wallet: true,
        country: "GBR",
        age: 30,
      },
    ];

    await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
  });

  it("can run a query", async ({ c }) => {
    const { expect, builder } = c;

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables: query.variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const { data } = await waitForQueryRun(c, runId);
    expect(data.result).toEqual([
      {
        averageAge: 30,
        count: 3,
      },
    ]);
  });

  it("can read data by a single id", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .findOne({});

    expect(expected).toBeDefined();
    const _id = expected!._id.toString();

    const result = await builder
      .findData(c, {
        collection: collection.id,
        filter: { _id },
      })
      .expectSuccess();

    const actual = result.data[0];
    expect(actual._id).toBe(_id);
  });

  it("can read data from a list of ids", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(3)
      .toArray();

    expect(expected).toBeDefined();
    const ids = expected.map((document) => document._id.toString());

    const result = await builder
      .findData(c, {
        collection: collection.id,
        filter: { _id: { $in: ids } },
      })
      .expectSuccess();

    expect(result.data).toHaveLength(3);
  });

  it("can delete data", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    expect(expected).toBeDefined();
    const ids = expected.map((document) => document._id.toString());

    const result = await builder
      .deleteData(c, {
        collection: collection.id,
        filter: { _id: { $in: ids } },
      })
      .expectSuccess();

    expect((result.data as DeleteResult).deletedCount).toEqual(1);
  });

  it("can list data", async ({ c }) => {
    const { expect, user } = c;
    const result = await user.listDataReferences(c).expectSuccess();
    expect(result.data).toHaveLength(2);
  });

  it("can update data", async ({ c }) => {
    const { bindings, user } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];
    await user
      .updateData(c, {
        collection: collection.id.toString(),
        document: documentId.toString(),
        update: {
          $set: {
            age: 41,
          },
        },
      })
      .expectSuccess();
  });

  it("can read data", async ({ c }) => {
    const { expect, bindings, user } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    const result = await user
      .readData(c, collection.id.toString(), documentId.toString())
      .expectSuccess();

    expect(result.data._acl).toHaveLength(1);
    expect(result.data._acl[0]?.read).toBe(true);
    expect(result.data._acl[0]?.write).toBe(true);
    expect(result.data._acl[0]?.execute).toBe(true);
  });

  it("user cannot access data they are not the owner of", async ({ c }) => {
    const { bindings, builder, user } = c;

    const otherUser = await createUserTestClient({
      app: user.app,
      keypair: Keypair.generate(),
      nodePublicKey: user._options.nodePublicKey,
    });

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x4",
        country: "GBR",
        age: 30,
      },
    ];

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();
    const documentId = expected.map((document) => document._id.toString())[0];

    // Enforce register user
    await builder
      .createOwnedData(c, {
        owner: otherUser.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectSuccess();

    await otherUser
      .readData(c, collection.id.toString(), documentId.toString())
      .expectFailure(StatusCodes.NOT_FOUND, "DocumentNotFoundError");
  });

  it("can grant access", async ({ c }) => {
    const { expect, bindings, user } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await user
      .grantAccess(c, {
        collection: collection.id.toString(),
        document: documentId.toString(),
        acl: {
          grantee: builderB.did.didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectSuccess();

    const result = await user
      .readData(c, collection.id.toString(), documentId.toString())
      .expectSuccess();

    expect(result.data._acl).toHaveLength(2);
    expect(result.data._acl[1]?.read).toBe(true);
    expect(result.data._acl[1]?.write).toBe(false);
    expect(result.data._acl[1]?.execute).toBe(false);
  });

  it("insufficient access cannot be granted to the collection owner", async ({
    c,
  }) => {
    const { bindings, user, builder } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await user
      .grantAccess(c, {
        collection: collection.id.toString(),
        document: documentId.toString(),
        acl: {
          grantee: builder.did.didString,
          read: false,
          write: false,
          execute: false,
        },
      })
      .expectFailure(StatusCodes.UNAUTHORIZED);
  });

  it("can revoke access", async ({ c }) => {
    const { expect, bindings, user } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await user
      .revokeAccess(c, {
        collection: collection.id.toString(),
        document: documentId.toString(),
        grantee: builderB.did.didString,
      })
      .expectSuccess();

    const result = await user
      .readData(c, collection.id.toString(), documentId.toString())
      .expectSuccess();

    expect(result.data._acl).toHaveLength(1);
  });

  it("cannot revoke access", async ({ c }) => {
    const { bindings, user, builder } = c;

    const expected = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await user
      .revokeAccess(c, {
        collection: collection.id.toString(),
        document: documentId.toString(),
        grantee: builder.did.didString,
      })
      .expectFailure(
        StatusCodes.BAD_REQUEST,
        "Collection owners cannot have their access revoked",
      );
  });

  it("remove users if all their data have been deleted", async ({ c }) => {
    const { builder, user } = c;
    const result = await user.listDataReferences(c).expectSuccess();
    await builder
      .deleteData(c, {
        collection: collection.id,
        filter: { _id: { $in: result.data.map((ref) => ref.document) } },
      })
      .expectSuccess();
    await user.listDataReferences(c).expectStatusCode(StatusCodes.UNAUTHORIZED);
  });
});
