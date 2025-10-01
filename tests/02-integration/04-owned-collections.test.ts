import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import type { DeleteResult } from "mongodb";
import { UUID } from "mongodb";
import { describe, expect } from "vitest";
import type { CollectionDocument } from "#/collections/collections.types";
import { CollectionName } from "#/common/mongo";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { OwnedDocumentBase } from "#/data/data.types";
import simpleCollectionJson from "../data/simple.collection.json";
import simpleQueryJson from "../data/simple.query.json";
import collectionJson from "../data/wallet.collection.json";
import queryJson from "../data/wallet.query.json";
import {
  assertDefined,
  assertDocumentCount,
  expectBuilder,
} from "../fixture/assertions";
import type { CollectionFixture, QueryFixture } from "../fixture/fixture";
import { createTestFixtureExtension } from "../fixture/it";
import {
  type BuilderTestClient,
  createBuilderTestClient,
  createUserTestClient,
} from "../fixture/test-client";

describe("Owned Collections", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const simpleCollection = simpleCollectionJson as unknown as CollectionFixture;
  const _query = queryJson as unknown as QueryFixture;
  const _simpleQuery = simpleQueryJson as unknown as QueryFixture;

  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  let unauthorizedBuilder: BuilderTestClient;

  beforeAll(async (c) => {
    await c.builder.ensureSubscriptionActive();

    const { builder, bindings, app } = c;

    // This builder is created manually with a specific private key to test
    // interactions where a single DID acts as both a data owner (the default `user` client)
    // and a builder. Using the `createRegisteredBuilder` helper is not suitable here as it
    // generates a random keypair.
    unauthorizedBuilder = await createBuilderTestClient({
      app,
      keypair: Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_1!),
      chainUrl: process.env.APP_NILCHAIN_JSON_RPC!,
      nilauthBaseUrl: bindings.config.nilauthBaseUrl,
      nodePublicKey: builder._options.nodePublicKey,
    });

    await unauthorizedBuilder
      .register(c, {
        did: unauthorizedBuilder.did.didString,
        name: "unauthorizedBuilder",
      })
      .expectSuccess();

    await unauthorizedBuilder.ensureSubscriptionActive();
  });
  afterAll(async (_c) => {});

  describe("Collection Lifecycle", () => {
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

    it("can add simple collection", async ({ c }) => {
      const { builder } = c;

      const _id = createUuidDto();
      await builder
        .createCollection(c, {
          _id,
          type: simpleCollection.type,
          name: simpleCollection.name,
          schema: simpleCollection.schema,
        })
        .expectSuccess();

      simpleCollection.id = _id;
    });

    it("can list collections (expect 2)", async ({ c }) => {
      const { expect, builder } = c;

      const { data, pagination } = await builder
        .readCollections(c)
        .expectSuccess();
      expect(data).toHaveLength(2);
      expect(pagination.total).toBe(2);
    });

    it("can list collections with pagination", async ({ c }) => {
      const { expect, builder } = c;

      const { data, pagination } = await builder
        .readCollections(c, { limit: 1, offset: 1 })
        .expectSuccess();

      expect(data).toHaveLength(1);
      expect(pagination.total).toBe(2);
      expect(pagination.limit).toBe(1);
      expect(pagination.offset).toBe(1);

      // Verify it is the second collection that was created
      expect(data[0].name).toBe(collection.name);
    });

    it("can read collection metadata", async ({ c }) => {
      const { expect, builder } = c;

      const { data } = await builder
        .readCollection(c, collection.id)
        .expectSuccess();

      expect(data._id).toBe(collection.id);
      expect(data.count).toBe(0);
      expect(data.schema).toEqual(collection.schema);
    });
  });

  describe("Data Lifecycle (Builder & User)", () => {
    type OwnedRecord = {
      _id: UuidDto;
      wallet: string;
      country: string;
      age: number;
    };

    type SimpleRecord = {
      _id: UuidDto;
      name: string;
    };

    const collectionSize = 10;
    const simpleTestData: SimpleRecord[] = Array.from(
      { length: collectionSize },
      () => ({
        _id: createUuidDto(),
        name: faker.person.fullName(),
      }),
    );

    it("can upload owned data (persistent)", async ({ c }) => {
      const { expect, bindings, builder, user } = c;

      // Create persistent data that should never be deleted to keep user in system
      const result = await builder
        .createOwnedData(c, {
          owner: user.did.didString,
          collection: collection.id,
          data: [
            {
              _id: createUuidDto(),
              wallet: "0x1",
              country: "GBR",
              age: 42,
            },
          ],
          acl: {
            grantee: builder.did.didString,
            read: true,
            write: false,
            execute: false,
          },
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

    it("can't upload owned data with invalid permissions", async ({ c }) => {
      const { builder, user } = c;

      const data: OwnedRecord[] = [
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

    it("can upload more owned data (for testing)", async ({ c }) => {
      const { expect, bindings, builder, user } = c;

      // Create test data that can be safely modified/deleted in other tests
      const data: OwnedRecord[] = [
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

      expect(result.data.created).toHaveLength(2);

      const cursor = bindings.db.data
        .collection(collection.id.toString())
        .find({});
      const records = await cursor.toArray();
      expect(records).toHaveLength(3);
    });

    it("can read collection metadata after data upload", async ({ c }) => {
      const { expect, builder } = c;
      const { data } = await builder
        .readCollection(c, collection.id)
        .expectSuccess();
      expect(data.count).toBe(3); // 1 from first upload, 2 from second.
    });

    it("can't upload owned data with invalid permissions", async ({ c }) => {
      const { builder, user } = c;

      const data: OwnedRecord[] = [
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

    it("rejects owned data that does not conform", async ({ c }) => {
      const { builder, user } = c;

      const data: OwnedRecord[] = [
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

    it("can create test data for reading", async ({ c }) => {
      const { builder, user } = c;

      await builder
        .createOwnedData(c, {
          owner: user.did.didString,
          collection: simpleCollection.id,
          data: simpleTestData,
          acl: {
            grantee: builder.did.didString,
            read: true,
            write: false,
            execute: false,
          },
        })
        .expectSuccess();
    });

    it("can tail a collection", async ({ c }) => {
      const { expect, builder } = c;

      const result = await builder
        .tailData(c, simpleCollection.id, 5)
        .expectSuccess();

      expect(result.data).toHaveLength(5);
      expect(result.data[0]?.name).toBeDefined();
    });

    it("can read owned data by a single id", async ({ c }) => {
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
      expect(result.pagination.total).toBe(1);
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
          filter: {
            $coerce: {
              "_id.$in": "uuid",
            },
            _id: { $in: ids },
          },
        })
        .expectSuccess();

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it("can update owned data", async ({ c }) => {
      const { bindings, user } = c;

      // Find a document where the user has write permission (from the second upload)
      const docToUpdate = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .findOne({ age: 40 });
      assertDefined(c, docToUpdate, "Test document with age 40 not found");

      await user
        .updateData(c, {
          collection: collection.id.toString(),
          document: docToUpdate._id.toString(),
          update: {
            $set: {
              age: 41,
            },
          },
        })
        .expectSuccess();
    });

    it("can list owned data references", async ({ c }) => {
      const { expect, user } = c;
      const result = await user.listDataReferences(c).expectSuccess();
      expect(result.data).toHaveLength(13);
    });

    it("can read owned data as user", async ({ c }) => {
      const { expect, bindings, user } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({})
        .sort({ _created: -1 })
        .limit(1)
        .toArray();

      const documentId = expected.map((document) => document._id.toString())[0];

      const result = await user
        .readData(c, collection.id.toString(), documentId)
        .expectSuccess();

      expect(result.data._acl).toHaveLength(1);
      expect(result.data._acl[0]?.read).toBe(true);
      expect(result.data._acl[0]?.write).toBe(true);
      expect(result.data._acl[0]?.execute).toBe(true);
    });

    it("can delete owned data (specific test record)", async ({ c }) => {
      const { expect, bindings, builder } = c;

      // Find a record with wallet "0x3" that was created for testing and can be safely deleted
      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ wallet: "0x3" })
        .sort({ _created: -1 })
        .limit(1)
        .toArray();

      expect(expected).toBeDefined();
      const ids = expected.map((document) => document._id.toString());

      const result = await builder
        .deleteData(c, {
          collection: collection.id,
          filter: {
            $coerce: {
              "_id.$in": "uuid",
            },
            _id: { $in: ids },
          },
        })
        .expectSuccess();

      expect((result.data as DeleteResult).deletedCount).toEqual(1);
    });

    it("user cannot access data they are not the owner of", async ({ c }) => {
      const { bindings, builder, user } = c;

      const otherUser = await createUserTestClient({
        app: user.app,
        keypair: Keypair.generate(),
        nodePublicKey: user._options.nodePublicKey,
      });

      const data: OwnedRecord[] = [
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

      // Create data owned by other user
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
        .readData(c, collection.id.toString(), documentId)
        .expectFailure(StatusCodes.NOT_FOUND, "DocumentNotFoundError");
    });

    it("removes users if all their data have been deleted", async ({ c }) => {
      const { builder, expect, app } = c;

      // Create a new temporary user for this test
      const tempUser = await createUserTestClient({
        app: app,
        keypair: Keypair.generate(),
        nodePublicKey: builder._options.nodePublicKey,
      });

      // Create a single data record owned by the temporary user
      const documentId = createUuidDto();
      const { data: createResult } = await builder
        .createOwnedData(c, {
          owner: tempUser.did.didString,
          collection: collection.id,
          data: [{ _id: documentId, wallet: "0xz", country: "GBR", age: 33 }],
          acl: {
            grantee: builder.did.didString,
            read: true,
            write: true,
            execute: false,
          },
        })
        .expectSuccess();

      expect(createResult.created).toHaveLength(1);

      // Verify the user can list their data reference
      await tempUser.listDataReferences(c).expectSuccess();

      // Builder deletes the temporary user's only piece of data
      await tempUser.deleteData(c, collection.id, documentId).expectSuccess();

      // Assert that the temporary user can no longer access the system, as they have no data
      await tempUser
        .listDataReferences(c)
        .expectStatusCode(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("Access Control (ACL)", () => {
    it("can grant access", async ({ c }) => {
      const { expect, bindings, user } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ _owner: user.did.didString })
        .sort({ _created: -1 })
        .limit(1)
        .toArray();
      const latestDocumentId = expected.map((document) =>
        document._id.toString(),
      )[0];

      await user
        .grantAccess(c, {
          collection: collection.id.toString(),
          document: latestDocumentId,
          acl: {
            grantee: unauthorizedBuilder.did.didString,
            read: true,
            write: false,
            execute: false,
          },
        })
        .expectSuccess();

      const result = await user
        .readData(c, collection.id.toString(), latestDocumentId)
        .expectSuccess();

      const aclEntry = result.data._acl.find(
        (acl) => acl.grantee === unauthorizedBuilder.did.didString,
      );
      assertDefined(c, aclEntry);
      expect(aclEntry.read).toBe(true);
      expect(aclEntry.write).toBe(false);
      expect(aclEntry.execute).toBe(false);
    });

    it("insufficient access cannot be granted to the collection owner", async ({
      c,
    }) => {
      const { bindings, user, builder } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ _owner: user.did.didString })
        .limit(1)
        .toArray();

      const documentId = expected.map((document) => document._id.toString())[0];

      await user
        .grantAccess(c, {
          collection: collection.id.toString(),
          document: documentId,
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
        .find({ _owner: user.did.didString })
        .sort({ _created: -1 })
        .limit(1)
        .toArray();

      const documentId = expected.map((document) => document._id.toString())[0];

      await user
        .revokeAccess(c, {
          collection: collection.id.toString(),
          document: documentId,
          grantee: unauthorizedBuilder.did.didString,
        })
        .expectSuccess();

      const result = await user
        .readData(c, collection.id.toString(), documentId)
        .expectSuccess();

      expect(result.data._acl).toHaveLength(1);
    });

    it("cannot revoke access from collection owner", async ({ c }) => {
      const { bindings, user, builder } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ _owner: user.did.didString })
        .sort({ _created: -1 })
        .limit(1)
        .toArray();

      const documentId = expected.map((document) => document._id.toString())[0];

      await user
        .revokeAccess(c, {
          collection: collection.id.toString(),
          document: documentId,
          grantee: builder.did.didString,
        })
        .expectFailure(
          StatusCodes.BAD_REQUEST,
          "Collection owners cannot have their access revoked",
        );
    });
  });

  describe("Cross-Builder Access & Permissions", () => {
    const unauthorizedTestCollectionSize = 10;
    const unauthorizedTestData = Array.from(
      { length: unauthorizedTestCollectionSize },
      () => ({
        _id: createUuidDto(),
        name: faker.person.fullName(),
      }),
    );

    it("can create test data for unauthorized access testing", async ({
      c,
    }) => {
      const { builder, user } = c;

      await builder
        .createOwnedData(c, {
          owner: user.did.didString,
          collection: simpleCollection.id,
          data: unauthorizedTestData,
          acl: {
            grantee: builder.did.didString,
            read: true,
            write: false,
            execute: false,
          },
        })
        .expectSuccess();
    });

    it("prevents data upload by unauthorized builder", async ({ c }) => {
      const { builder, user } = c;

      await unauthorizedBuilder
        .createOwnedData(c, {
          owner: user.did.didString,
          collection: simpleCollection.id,
          data: [
            {
              _id: createUuidDto(),
              name: faker.person.fullName(),
            },
          ],
          acl: {
            grantee: builder.did.didString,
            read: true,
            write: false,
            execute: false,
          },
        })
        .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
    });

    it("prevents data reads by unauthorized builder", async ({ c }) => {
      const result = await unauthorizedBuilder
        .findData(c, {
          collection: simpleCollection.id,
          filter: {},
        })
        .expectSuccess();

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it("prevents data updates by unauthorized builder", async ({ c }) => {
      const record =
        unauthorizedTestData[
          Math.floor(Math.random() * unauthorizedTestCollectionSize)
        ];
      const result = await unauthorizedBuilder
        .updateData(c, {
          collection: simpleCollection.id,
          filter: { name: record.name },
          update: { $set: { name: "foo" } },
        })
        .expectSuccess();

      expect(result.data.modified).toBe(0);
    });

    it("prevents data deletes by unauthorized builder", async ({ c }) => {
      const record =
        unauthorizedTestData[
          Math.floor(Math.random() * unauthorizedTestCollectionSize)
        ];

      const result = await unauthorizedBuilder
        .deleteData(c, {
          collection: simpleCollection.id,
          filter: { name: record.name },
        })
        .expectSuccess();

      expect(result.data.deletedCount).toBe(0);
    });

    it("prevents data flush by unauthorized builder", async ({ c }) => {
      const { bindings } = c;

      const numRecordsBefore = await bindings.db.data
        .collection<OwnedDocumentBase>(simpleCollection.id)
        .count({});

      await unauthorizedBuilder
        .flushData(c, simpleCollection.id)
        .expectSuccess();

      const numRecordsAfter = await bindings.db.data
        .collection<OwnedDocumentBase>(simpleCollection.id)
        .count({});

      expect(numRecordsBefore).toBeGreaterThan(0);
      expect(numRecordsBefore).toEqual(numRecordsAfter);
    });

    it("prevents data tail by unauthorized builder", async ({ c }) => {
      const result = await unauthorizedBuilder
        .tailData(c, simpleCollection.id)
        .expectSuccess();
      expect(result.data).toHaveLength(0);
    });

    it("allows authorized read via findData after granting permission", async ({
      c,
    }) => {
      const { user } = c;

      // Grant unauthorizedBuilder read permission on unauthorizedTestData[0]
      await user
        .grantAccess(c, {
          collection: simpleCollection.id,
          document: unauthorizedTestData[0]._id,
          acl: {
            grantee: unauthorizedBuilder.did.didString,
            read: true,
            write: false,
            execute: false,
          },
        })
        .expectSuccess();

      // Now unauthorizedBuilder should be able to read unauthorizedTestData[0]
      const resultWithAccess = await unauthorizedBuilder
        .findData(c, {
          collection: simpleCollection.id,
          filter: { _id: unauthorizedTestData[0]._id },
        })
        .expectSuccess();

      expect(resultWithAccess.data).toHaveLength(1);
      expect(resultWithAccess.pagination.total).toBe(1);

      // But still can't read other documents
      const resultWithoutAccess = await unauthorizedBuilder
        .findData(c, {
          collection: simpleCollection.id,
          filter: { _id: unauthorizedTestData[1]._id },
        })
        .expectSuccess();

      expect(resultWithoutAccess.data).toHaveLength(0);
      expect(resultWithoutAccess.pagination.total).toBe(0);
    });

    it("can find owned data with pagination", async ({ c }) => {
      const { expect, builder } = c;

      // Total data count in simpleCollection is 10 for reading + 10 for unauthorized access testing = 20
      const { data, pagination } = await builder
        .findData(c, {
          collection: simpleCollection.id,
          filter: {},
          pagination: { limit: 5, offset: 10 },
        })
        .expectSuccess();

      expect(data).toHaveLength(5);
      expect(pagination.total).toBe(20);
      expect(pagination.limit).toBe(5);
      expect(pagination.offset).toBe(10);
    });

    it("prevents unauthorized update even with read permission", async ({
      c,
    }) => {
      const { user } = c;

      // Grant unauthorizedBuilder only read permission on unauthorizedTestData[2]
      await user
        .grantAccess(c, {
          collection: simpleCollection.id,
          document: unauthorizedTestData[2]._id,
          acl: {
            grantee: unauthorizedBuilder.did.didString,
            read: true,
            write: false,
            execute: false,
          },
        })
        .expectSuccess();

      // unauthorizedBuilder should NOT be able to update even with read permission
      const result = await unauthorizedBuilder
        .updateData(c, {
          collection: simpleCollection.id,
          filter: { _id: unauthorizedTestData[2]._id },
          update: { $set: { name: "hacked" } },
        })
        .expectSuccess();

      expect(result.data.modified).toBe(0);
    });

    it("allows authorized query execution with execute permission", async ({
      c,
    }) => {
      const { user } = c;

      // 1. Unauthorized builder creates its OWN collection
      const unauthorizedCollectionId = createUuidDto();
      await unauthorizedBuilder
        .createCollection(c, {
          _id: unauthorizedCollectionId,
          type: "owned",
          name: "unauthorized-collection",
          schema: simpleCollectionJson.schema,
        })
        .expectSuccess();

      // 2. Unauthorized builder creates its OWN query for its collection
      const unauthorizedQueryId = createUuidDto();
      await unauthorizedBuilder
        .createQuery(c, {
          _id: unauthorizedQueryId,
          name: "unauthorized-simple-query",
          collection: unauthorizedCollectionId,
          variables: { name: { path: "$.pipeline[0].$match.name" } },
          pipeline: [{ $match: { name: "" } }],
        })
        .expectSuccess();

      // 3. Unauthorized builder creates data in its collection, owned by the main user,
      //    and grants ITSELF 'execute' permission.
      const testDoc = { _id: createUuidDto(), name: "test-execute" };
      await unauthorizedBuilder
        .createOwnedData(c, {
          owner: user.did.didString,
          collection: unauthorizedCollectionId,
          data: [testDoc],
          acl: {
            grantee: unauthorizedBuilder.did.didString,
            read: false,
            write: false,
            execute: true,
          },
        })
        .expectSuccess();

      // 4. Unauthorized builder can now run its query, which will process the data
      //    it has 'execute' permission on.
      await unauthorizedBuilder
        .runQuery(c, {
          _id: unauthorizedQueryId,
          variables: { name: testDoc.name },
        })
        .expectSuccess();
    });
  });

  describe("Cleanup", () => {
    it("can delete collection", async ({ c }) => {
      const { expect, bindings, builder } = c;

      const id = collection.id;
      await builder.deleteCollection(c, id).expectSuccess();

      const collectionDocument = await bindings.db.primary
        .collection<CollectionDocument>(CollectionName.Collections)
        .findOne({ _id: new UUID(id) });

      expect(collectionDocument).toBeNull();

      const builderDocument = await expectBuilder(c, builder.did.didString);
      expect(builderDocument.collections).toHaveLength(1);

      await assertDocumentCount(c, id, 0);
    });
  });
});
