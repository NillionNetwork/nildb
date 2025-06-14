import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import collectionJson from "./data/wallet.collection.json";
import queryJson from "./data/wallet.query.json";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("owned-data.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  type Record = {
    _id: UuidDto;
    wallet: string;
    country: string;
    age: number;
  };

  it.skip("can upload data", async ({ c }) => {
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
        owner: user.did,
        collection: collection.id,
        data,
        acl: { grantee: builder.did, read: true, write: false, execute: false },
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data
      .collection(collection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  // it.skip("rejects primary key collisions", async ({ skip, c }) => {
  //   skip("TODO: depends on indexes, disable until index endpoint is ready");
  //   const { expect, bindings, builder, user } = c;
  //
  //   const data = [
  //     {
  //       _id: createUuidDto(),
  //       wallet: "0x1",
  //       country: "GBR",
  //       age: 30,
  //     },
  //   ];
  //
  //   const result = await builder
  //     .createOwnedData(c, {
  //       owner: user.did,
  //       collection: collection.id,
  //       data,
  //       acl: { grantee: builder.did, read: true, write: false, execute: false },
  //     })
  //     .expectSuccess();
  //
  //   expect(result.data.errors).toHaveLength(1);
  //
  //   const cursor = bindings.db.data
  //     .collection(collection.id.toString())
  //     .find({});
  //   const records = await cursor.toArray();
  //   expect(records).toHaveLength(3);
  // });
  //
  // it.skip("allows for partial success", async ({ skip, c }) => {
  //   skip("depends on indexes, disable until index endpoint is ready");
  //   const { expect, builder, user } = c;
  //
  //   const data: Record[] = [
  //     {
  //       id: createUuidDto(),
  //       wallet: "0x1", // collides expect failure
  //       country: "GBR",
  //       age: 30,
  //     },
  //     {
  //       id: createUuidDto(),
  //       wallet: "0x4", // unique expect success
  //       country: "GBR",
  //       age: 30,
  //     },
  //   ];
  //
  //   const result = await builder
  //     .createOwnedData(c, {
  //       owner: user.did,
  //       collection: collection.id,
  //       data,
  //       acl: { grantee: builder.did, read: true, write: false, execute: false },
  //     })
  //     .expectSuccess();
  //
  //   expect(result.data.errors).toHaveLength(1);
  //   expect(result.data.created).toHaveLength(1);
  // });
  //
  // it.skip("rejects duplicates in data payload", async ({ skip, c }) => {
  //   skip("depends on indexes, disable until index endpoint is ready");
  //   const { expect, builder, user } = c;
  //
  //   const data: Record[] = [
  //     {
  //       id: createUuidDto(),
  //       wallet: "0x4",
  //       country: "GBR",
  //       age: 30,
  //     },
  //     {
  //       id: createUuidDto(),
  //       wallet: "0x4",
  //       country: "GBR",
  //       age: 30,
  //     },
  //   ];
  //
  //   await builder
  //     .createOwnedData(c, {
  //       owner: user.did,
  //       collection: collection.id,
  //       data,
  //       acl: { grantee: builder.did, read: true, write: false, execute: false },
  //     })
  //     .expectSuccess();
  //
  //   const cursor = c.bindings.db.data
  //     .collection(collection.id.toString())
  //     .find({});
  //   const records = await cursor.toArray();
  //   expect(records).toHaveLength(4);
  // });
  //
  // it("rejects data that does not conform", async ({ c }) => {
  //   const { builder, user } = c;
  //
  //   const data: Record[] = [
  //     {
  //       id: createUuidDto(),
  //       // @ts-expect-error should be string but want to check rejection
  //       wallet: true,
  //       country: "GBR",
  //       age: 30,
  //     },
  //   ];
  //
  //   await builder
  //     .createOwnedData(c, {
  //       owner: user.did,
  //       collection: collection.id,
  //       data,
  //       acl: { grantee: builder.did, read: true, write: false, execute: false },
  //     })
  //     .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
  // });
  //
  // it.skip("can run a query", async ({ skip, c }) => {
  //   skip("depends on indexes, disable until index endpoint is ready");
  //   const { expect, builder } = c;
  //
  //   const runId = (
  //     await builder
  //       .runQuery(c, {
  //         _id: query.id,
  //         variables: query.variables,
  //       })
  //       .expectSuccess()
  //   ).data as UuidDto;
  //
  //   const { data } = await waitForQueryRun(c, runId);
  //   expect(data.result).toEqual([
  //     {
  //       averageAge: 30,
  //       count: 3,
  //     },
  //   ]);
  // });
  //
  // it("can read data by a single id", async ({ c }) => {
  //   const { expect, bindings, builder } = c;
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .findOne({});
  //
  //   expect(expected).toBeDefined();
  //   const _id = expected!._id.toString();
  //
  //   const result = await builder
  //     .readData(c, {
  //       schema: collection.id,
  //       filter: { _id },
  //     })
  //     .expectSuccess();
  //
  //   const actual = result.data[0];
  //   expect(actual._id).toBe(_id);
  // });
  //
  // it("can read data from a list of ids", async ({ c }) => {
  //   const { expect, bindings, builder } = c;
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .find({})
  //     .limit(3)
  //     .toArray();
  //
  //   expect(expected).toBeDefined();
  //   const ids = expected.map((document) => document._id.toString());
  //
  //   const result = await builder
  //     .readData(c, {
  //       schema: collection.id,
  //       filter: { _id: { $in: ids } },
  //     })
  //     .expectSuccess();
  //
  //   expect(result.data).toHaveLength(3);
  // });
  //
  // it("can delete data", async ({ c }) => {
  //   const { expect, bindings, builder } = c;
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .find({})
  //     .limit(1)
  //     .toArray();
  //
  //   expect(expected).toBeDefined();
  //   const ids = expected.map((document) => document._id.toString());
  //
  //   const result = await builder
  //     .deleteData(c, {
  //       collection: collection.id,
  //       filter: { _id: { $in: ids } },
  //     })
  //     .expectSuccess();
  //
  //   expect((result.data as DeleteResult).deletedCount).toEqual(1);
  // });
  //
  // it("can read user data", async ({ c }) => {
  //   const { expect, user } = c;
  //   const result = await user.readData(c).expectSuccess();
  //   expect(result.data).toHaveLength(2);
  // });
  //
  // it("can read data permissions", async ({ c }) => {
  //   const { expect, bindings, user } = c;
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .find({})
  //     .limit(1)
  //     .toArray();
  //
  //   const documentId = expected.map((document) => document._id.toString())[0];
  //
  //   const result = await user
  //     .readPermissions(c, {
  //       schema: collection.id.toString(),
  //       documentId: documentId.toString(),
  //     })
  //     .expectSuccess();
  //
  //   expect(result.data).toHaveLength(1);
  //   const permissions = Array.isArray(result.data)
  //     ? (Array.from(result.data)[0] as Acl)
  //     : undefined;
  //   expect(permissions?.acl?.read).toBe(true);
  //   expect(permissions?.acl?.write).toBe(false);
  //   expect(permissions?.acl?.execute).toBe(false);
  // });
  //
  // it("user cannot access data they are not the owner of", async ({ c }) => {
  //   const { bindings, builder, user } = c;
  //
  //   const otherUser = await createUserTestClient({
  //     app: user.app,
  //     keypair: Keypair.generate(),
  //     nodePublicKey: user._options.nodePublicKey,
  //   });
  //
  //   const data: Record[] = [
  //     {
  //       id: createUuidDto(),
  //       wallet: "0x4",
  //       country: "GBR",
  //       age: 30,
  //     },
  //   ];
  //
  //   // Enforce register user
  //   await builder
  //     .createOwnedData(c, {
  //       owner: otherUser.did,
  //       collection: collection.id,
  //       data,
  //       acl: { grantee: builder.did, read: true, write: false, execute: false },
  //     })
  //     .expectSuccess();
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .find({})
  //     .limit(1)
  //     .toArray();
  //
  //   const documentId = expected.map((document) => document._id.toString())[0];
  //
  //   await otherUser
  //     .readPermissions(c, {
  //       schema: collection.id.toString(),
  //       documentId: documentId.toString(),
  //     })
  //     .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  // });
  //
  // const targetDid = Keypair.generate().toDidString();
  // it("can add data permissions", async ({ c }) => {
  //   const { expect, bindings, user } = c;
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .find({})
  //     .limit(1)
  //     .toArray();
  //
  //   const documentId = expected.map((document) => document._id.toString())[0];
  //
  //   await user
  //     .grantAccess(c, {
  //       collection: collection.id.toString(),
  //       document: documentId.toString(),
  //       permissions: new Acl(targetDid),
  //     })
  //     .expectSuccess();
  //
  //   const result = await user
  //     .readPermissions(c, {
  //       schema: collection.id.toString(),
  //       documentId: documentId.toString(),
  //     })
  //     .expectSuccess();
  //
  //   expect(result.data).toHaveLength(2);
  //   const permissions = Array.isArray(result.data)
  //     ? (Array.from(result.data)[1] as Acl)
  //     : undefined;
  //   expect(permissions?.acl?.read).toBe(false);
  //   expect(permissions?.acl?.write).toBe(false);
  //   expect(permissions?.acl?.execute).toBe(false);
  // });
  //
  // it("can update data permissions", async ({ c }) => {
  //   const { expect, bindings, user } = c;
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .find({})
  //     .limit(1)
  //     .toArray();
  //
  //   const documentId = expected.map((document) => document._id.toString())[0];
  //
  //   await user
  //     .updateAccess(c, {
  //       schema: collection.id.toString(),
  //       document: documentId.toString(),
  //       acl: new Acl(targetDid, {
  //         read: true,
  //         write: true,
  //         execute: true,
  //       }),
  //     })
  //     .expectSuccess();
  //
  //   const result = await user
  //     .readPermissions(c, {
  //       schema: collection.id.toString(),
  //       documentId: documentId.toString(),
  //     })
  //     .expectSuccess();
  //
  //   expect(result.data).toHaveLength(2);
  //   const permissions = Array.isArray(result.data)
  //     ? (Array.from(result.data)[1] as Acl)
  //     : undefined;
  //   expect(permissions?.acl?.read).toBe(true);
  //   expect(permissions?.acl?.write).toBe(true);
  //   expect(permissions?.acl?.execute).toBe(true);
  // });
  //
  // it("can delete data permissions", async ({ c }) => {
  //   const { expect, bindings, user } = c;
  //
  //   const expected = await bindings.db.data
  //     .collection<OwnedDocumentBase>(collection.id.toString())
  //     .find({})
  //     .limit(1)
  //     .toArray();
  //
  //   const documentId = expected.map((document) => document._id.toString())[0];
  //
  //   await user
  //     .revokeAccess(c, {
  //       collection: collection.id.toString(),
  //       document: documentId.toString(),
  //       grantee: targetDid,
  //     })
  //     .expectSuccess();
  //
  //   const result = await user
  //     .readPermissions(c, {
  //       schema: collection.id.toString(),
  //       documentId: documentId.toString(),
  //     })
  //     .expectSuccess();
  //
  //   expect(result.data).toHaveLength(1);
  // });
});
