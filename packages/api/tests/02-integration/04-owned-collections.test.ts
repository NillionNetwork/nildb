import { faker } from "@faker-js/faker";
import type { CollectionDocument } from "@nildb/collections/collections.types";
import { CollectionName } from "@nildb/common/mongo";
import type { OwnedDocumentBase } from "@nildb/data/data.types";
import { NilauthClient } from "@nillion/nilauth-client";
import { BuilderClient } from "@nillion/nildb-client";
import { createUuidDto, type UuidDto } from "@nillion/nildb-types";
import { Signer } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { DeleteResult } from "mongodb";
import { UUID } from "mongodb";
import { describe } from "vitest";
import simpleCollectionJson from "../data/simple.collection.json";
import simpleQueryJson from "../data/simple.query.json";
import collectionJson from "../data/wallet.collection.json";
import queryJson from "../data/wallet.query.json";
import {
  assertDefined,
  assertDocumentCount,
  expectBuilder,
} from "../fixture/assertions.js";
import type { CollectionFixture, QueryFixture } from "../fixture/fixture.js";
import { createUserTestClient } from "../fixture/helpers.js";
import { createTestFixtureExtension } from "../fixture/it.js";
import { activateSubscriptionWithPayment } from "../fixture/payment.js";

describe("Owned Collections", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const simpleCollection = simpleCollectionJson as unknown as CollectionFixture;
  const _query = queryJson as unknown as QueryFixture;
  const _simpleQuery = simpleQueryJson as unknown as QueryFixture;

  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  let unauthorizedBuilder: BuilderClient;
  let unauthorizedBuilderSigner: Signer;

  beforeAll(async (c) => {
    const { bindings, app } = c;

    // This builder is created manually with a specific private key to test
    // interactions where a single DID acts as both a data owner (the default `user` client)
    // and a builder. Using the `createRegisteredBuilder` helper is not suitable here as it
    // generates a random private key.
    const privateKey = process.env.APP_TEST_USER_PRIVATE_KEY!;
    unauthorizedBuilderSigner = Signer.fromPrivateKey(privateKey);
    const builderDid = await unauthorizedBuilderSigner.getDid();

    // Create nilauth client and activate subscription for testing
    const nilauth = await NilauthClient.create({
      baseUrl: bindings.config.nilauthInstances[0].baseUrl,
      chainId: bindings.config.nilauthChainId,
    });

    // Activate subscription via real payment on Anvil
    const anvilRpcUrl =
      process.env.APP_ANVIL_RPC_URL || "http://127.0.0.1:30545";
    await activateSubscriptionWithPayment(nilauth, builderDid, anvilRpcUrl);

    unauthorizedBuilder = new BuilderClient({
      baseUrl: bindings.config.nodePublicEndpoint,
      signer: unauthorizedBuilderSigner,
      nodePublicKey: bindings.node.publicKey,
      nilauth,
      httpClient: app.request,
    });

    const registerResult = await unauthorizedBuilder.register({
      did: builderDid.didString,
      name: "unauthorizedBuilder",
    });

    if (!registerResult.ok) {
      throw new Error(`Failed to register builder: ${registerResult.error}`);
    }
  });
  afterAll(async (_c) => {});

  describe("Collection Lifecycle", () => {
    it("can list collections (expect 0)", async ({ c }) => {
      const { expect, builder } = c;
      const result = await builder.readCollections();
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(0);
    });

    it("can add collection", async ({ c }) => {
      const { bindings, builder, expect } = c;

      const _id = createUuidDto();
      const result = await builder.createCollection({
        _id,
        type: collection.type,
        name: collection.name,
        schema: collection.schema,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");

      const document = await bindings.db.primary
        .collection(CollectionName.Builders)
        .findOne({
          collections: { $elemMatch: { $in: [new UUID(_id)] } },
        });
      assertDefined(c, document);

      collection.id = _id;
    });

    it("can add simple collection", async ({ c }) => {
      const { builder, expect } = c;

      const _id = createUuidDto();
      const result = await builder.createCollection({
        _id,
        type: simpleCollection.type,
        name: simpleCollection.name,
        schema: simpleCollection.schema,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");

      simpleCollection.id = _id;
    });

    it("can list collections (expect 2)", async ({ c }) => {
      const { expect, builder } = c;

      const result = await builder.readCollections();
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(2);
      expect(result.data.pagination.total).toBe(2);
    });

    it("can list collections with pagination", async ({ c }) => {
      const { expect, builder } = c;

      const result = await builder.readCollections({
        limit: 1,
        offset: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(1);
      expect(result.data.pagination.total).toBe(2);
      expect(result.data.pagination.limit).toBe(1);
      expect(result.data.pagination.offset).toBe(1);

      // Verify it is the second collection that was created
      expect(result.data.data[0].name).toBe(collection.name);
    });

    it("can read collection metadata", async ({ c }) => {
      const { expect, builder } = c;

      const result = await builder.readCollection(collection.id);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data._id).toBe(collection.id);
      expect(result.data.data.count).toBe(0);
      expect(result.data.data.schema).toEqual(collection.schema);
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
      const { expect, bindings, builder, userSigner, builderSigner } = c;

      // Create persistent data that should never be deleted to keep user in system
      const result = await builder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
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
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data.created).toHaveLength(1);

      const data = await bindings.db.data
        .collection(collection.id.toString())
        .find()
        .toArray();

      expect(data).toHaveLength(1);
      expect(data[0]?.age).toBe(42);
    });

    it("can't upload owned data with invalid permissions", async ({ c }) => {
      const { expect, builder, userSigner, builderSigner } = c;

      const data: OwnedRecord[] = [
        {
          _id: createUuidDto(),
          wallet: "0x1",
          country: "GBR",
          age: 20,
        },
      ];

      const result = await builder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
        collection: collection.id,
        data,
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: false,
          write: false,
          execute: false,
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBeDefined();
      }
    });

    it("can upload more owned data (for testing)", async ({ c }) => {
      const { expect, bindings, builder, userSigner, builderSigner } = c;

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

      const result = await builder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
        collection: collection.id,
        data,
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: true,
          execute: true,
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data.created).toHaveLength(2);

      const cursor = bindings.db.data
        .collection(collection.id.toString())
        .find({});
      const records = await cursor.toArray();
      expect(records).toHaveLength(3);
    });

    it("can read collection metadata after data upload", async ({ c }) => {
      const { expect, builder } = c;
      const result = await builder.readCollection(collection.id);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data.count).toBe(3); // 1 from first upload, 2 from second.
    });

    it("rejects owned data that does not conform", async ({ c }) => {
      const { expect, builder, userSigner, builderSigner } = c;

      const data: OwnedRecord[] = [
        {
          _id: createUuidDto(),
          // @ts-expect-error should be string but want to check rejection
          wallet: true,
          country: "GBR",
          age: 30,
        },
      ];

      const result = await builder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
        collection: collection.id,
        data,
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBeDefined();
      }
    });

    it("can create test data for reading", async ({ c }) => {
      const { builder, expect, userSigner, builderSigner } = c;

      const result = await builder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
        collection: simpleCollection.id,
        data: simpleTestData,
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
    });

    it("can tail a collection", async ({ c }) => {
      const { expect, builder } = c;

      const result = await builder.tailData(simpleCollection.id, 5);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(5);
      expect(result.data.data[0]?.name).toBeDefined();
    });

    it("can read owned data by a single id", async ({ c }) => {
      const { expect, bindings, builder } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .findOne({});

      expect(expected).toBeDefined();
      const _id = expected?._id.toString();

      const result = await builder.findData({
        collection: collection.id,
        filter: { _id },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      const actual = result.data.data[0];
      expect(actual._id).toBe(_id);
      expect(result.data.pagination.total).toBe(1);
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

      const result = await builder.findData({
        collection: collection.id,
        filter: {
          $coerce: {
            "_id.$in": "uuid",
          },
          _id: { $in: ids },
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(3);
      expect(result.data.pagination.total).toBe(3);
    });

    it("can update owned data", async ({ c }) => {
      const { bindings, user, expect } = c;

      // Find a document where the user has write permission (from the second upload)
      const docToUpdate = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .findOne({ age: 40 });
      assertDefined(c, docToUpdate, "Test document with age 40 not found");

      const result = await user.updateData({
        collection: collection.id.toString(),
        document: docToUpdate._id.toString(),
        update: {
          $set: {
            age: 41,
          },
        },
      });
      expect(result.ok).toBe(true);
    });

    it("can list owned data references", async ({ c }) => {
      const { expect, user } = c;
      const result = await user.listDataReferences();
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(13);
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

      const result = await user.readData(collection.id.toString(), documentId);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data._acl).toHaveLength(1);
      expect(result.data.data._acl[0]?.read).toBe(true);
      expect(result.data.data._acl[0]?.write).toBe(true);
      expect(result.data.data._acl[0]?.execute).toBe(true);
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

      const result = await builder.deleteData({
        collection: collection.id,
        filter: {
          $coerce: {
            "_id.$in": "uuid",
          },
          _id: { $in: ids },
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect((result.data.data as DeleteResult).deletedCount).toEqual(1);
    });

    it("user cannot access data they are not the owner of", async ({ c }) => {
      const { expect, bindings, builder, app, builderSigner } = c;

      const otherUserPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
      const otherUserSigner = Signer.fromPrivateKey(otherUserPrivateKey);
      const otherUser = await createUserTestClient({
        app,
        privateKey: otherUserPrivateKey,
        nodePublicKey: bindings.node.publicKey,
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
      const createResult = await builder.createOwnedData({
        owner: (await otherUserSigner.getDid()).didString,
        collection: collection.id,
        data,
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(createResult.ok).toBe(true);

      const readResult = await otherUser.readData(
        collection.id.toString(),
        documentId,
      );
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.status).toBeDefined();
      }
    });

    it("removes users if all their data have been deleted", async ({ c }) => {
      const { builder, expect, app, bindings, builderSigner } = c;

      // Create a new temporary user for this test
      const tempUserPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
      const tempUserSigner = Signer.fromPrivateKey(tempUserPrivateKey);
      const tempUser = await createUserTestClient({
        app,
        privateKey: tempUserPrivateKey,
        nodePublicKey: bindings.node.publicKey,
      });

      // Create a single data record owned by the temporary user
      const documentId = createUuidDto();
      const createResultResponse = await builder.createOwnedData({
        owner: (await tempUserSigner.getDid()).didString,
        collection: collection.id,
        data: [{ _id: documentId, wallet: "0xz", country: "GBR", age: 33 }],
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: true,
          execute: false,
        },
      });

      expect(createResultResponse.ok).toBe(true);
      if (!createResultResponse.ok) throw new Error("Test setup failed");
      expect(createResultResponse.data.data.created).toHaveLength(1);

      // Verify the user can list their data reference
      const listResult = await tempUser.listDataReferences();
      expect(listResult.ok).toBe(true);

      // Builder deletes the temporary user's only piece of data
      const deleteResult = await tempUser.deleteData(collection.id, documentId);
      expect(deleteResult.ok).toBe(true);

      // Assert that the temporary user can no longer access the system, as they have no data
      const finalListResult = await tempUser.listDataReferences();
      expect(finalListResult.ok).toBe(false);
      if (!finalListResult.ok) {
        expect(finalListResult.status).toBeDefined();
      }
    });
  });

  describe("Access Control (ACL)", () => {
    it("can grant access", async ({ c }) => {
      const { expect, bindings, user, userSigner } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ _owner: (await userSigner.getDid()).didString })
        .sort({ _created: -1 })
        .limit(1)
        .toArray();
      const latestDocumentId = expected.map((document) =>
        document._id.toString(),
      )[0];

      const grantResult = await user.grantAccess({
        collection: collection.id.toString(),
        document: latestDocumentId,
        acl: {
          grantee: (await unauthorizedBuilderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(grantResult.ok).toBe(true);

      const result = await user.readData(
        collection.id.toString(),
        latestDocumentId,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      const unauthorizedBuilderDid = (await unauthorizedBuilderSigner.getDid())
        .didString;
      const aclEntry = result.data.data._acl.find(
        (acl) => acl.grantee === unauthorizedBuilderDid,
      );
      assertDefined(c, aclEntry);
      expect(aclEntry.read).toBe(true);
      expect(aclEntry.write).toBe(false);
      expect(aclEntry.execute).toBe(false);
    });

    it("insufficient access cannot be granted to the collection owner", async ({
      c,
    }) => {
      const { expect, bindings, user, userSigner, builderSigner } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ _owner: (await userSigner.getDid()).didString })
        .limit(1)
        .toArray();

      const documentId = expected.map((document) => document._id.toString())[0];

      const result = await user.grantAccess({
        collection: collection.id.toString(),
        document: documentId,
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: false,
          write: false,
          execute: false,
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBeDefined();
      }
    });

    it("can revoke access", async ({ c }) => {
      const { expect, bindings, user, userSigner } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ _owner: (await userSigner.getDid()).didString })
        .sort({ _created: -1 })
        .limit(1)
        .toArray();

      const documentId = expected.map((document) => document._id.toString())[0];

      const revokeResult = await user.revokeAccess({
        collection: collection.id.toString(),
        document: documentId,
        grantee: (await unauthorizedBuilderSigner.getDid()).didString,
      });
      expect(revokeResult.ok).toBe(true);

      const result = await user.readData(collection.id.toString(), documentId);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data._acl).toHaveLength(1);
    });

    it("cannot revoke access from collection owner", async ({ c }) => {
      const { expect, bindings, user, userSigner, builderSigner } = c;

      const expected = await bindings.db.data
        .collection<OwnedDocumentBase>(collection.id.toString())
        .find({ _owner: (await userSigner.getDid()).didString })
        .sort({ _created: -1 })
        .limit(1)
        .toArray();

      const documentId = expected.map((document) => document._id.toString())[0];

      const result = await user.revokeAccess({
        collection: collection.id.toString(),
        document: documentId,
        grantee: (await builderSigner.getDid()).didString,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBeDefined();
      }
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
      const { builder, expect, userSigner, builderSigner } = c;

      const result = await builder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
        collection: simpleCollection.id,
        data: unauthorizedTestData,
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
    });

    it("prevents data upload by unauthorized builder", async ({ c }) => {
      const { expect, userSigner, builderSigner } = c;

      const result = await unauthorizedBuilder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
        collection: simpleCollection.id,
        data: [
          {
            _id: createUuidDto(),
            name: faker.person.fullName(),
          },
        ],
        acl: {
          grantee: (await builderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBeDefined();
      }
    });

    it("prevents data reads by unauthorized builder", async ({ c }) => {
      const { expect } = c;
      const result = await unauthorizedBuilder.findData({
        collection: simpleCollection.id,
        filter: {},
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(0);
      expect(result.data.pagination.total).toBe(0);
    });

    it("prevents data updates by unauthorized builder", async ({ c }) => {
      const { expect } = c;
      const record =
        unauthorizedTestData[
          Math.floor(Math.random() * unauthorizedTestCollectionSize)
        ];
      const result = await unauthorizedBuilder.updateData({
        collection: simpleCollection.id,
        filter: { name: record.name },
        update: { $set: { name: "foo" } },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data.modified).toBe(0);
    });

    it("prevents data deletes by unauthorized builder", async ({ c }) => {
      const { expect } = c;
      const record =
        unauthorizedTestData[
          Math.floor(Math.random() * unauthorizedTestCollectionSize)
        ];

      const result = await unauthorizedBuilder.deleteData({
        collection: simpleCollection.id,
        filter: { name: record.name },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data.deletedCount).toBe(0);
    });

    it("prevents data flush by unauthorized builder", async ({ c }) => {
      const { expect, bindings } = c;

      const numRecordsBefore = await bindings.db.data
        .collection<OwnedDocumentBase>(simpleCollection.id)
        .count({});

      const flushResult = await unauthorizedBuilder.flushData(
        simpleCollection.id,
      );
      expect(flushResult.ok).toBe(true);

      const numRecordsAfter = await bindings.db.data
        .collection<OwnedDocumentBase>(simpleCollection.id)
        .count({});

      expect(numRecordsBefore).toBeGreaterThan(0);
      expect(numRecordsBefore).toEqual(numRecordsAfter);
    });

    it("prevents data tail by unauthorized builder", async ({ c }) => {
      const { expect } = c;
      const result = await unauthorizedBuilder.tailData(simpleCollection.id);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(0);
    });

    it("allows authorized read via findData after granting permission", async ({
      c,
    }) => {
      const { expect, user } = c;

      // Grant unauthorizedBuilder read permission on unauthorizedTestData[0]
      const grantResult = await user.grantAccess({
        collection: simpleCollection.id,
        document: unauthorizedTestData[0]._id,
        acl: {
          grantee: (await unauthorizedBuilderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(grantResult.ok).toBe(true);

      // Now unauthorizedBuilder should be able to read unauthorizedTestData[0]
      const resultWithAccess = await unauthorizedBuilder.findData({
        collection: simpleCollection.id,
        filter: { _id: unauthorizedTestData[0]._id },
      });

      expect(resultWithAccess.ok).toBe(true);
      if (!resultWithAccess.ok) throw new Error("Test setup failed");
      expect(resultWithAccess.data.data).toHaveLength(1);
      expect(resultWithAccess.data.pagination.total).toBe(1);

      // But still can't read other documents
      const resultWithoutAccess = await unauthorizedBuilder.findData({
        collection: simpleCollection.id,
        filter: { _id: unauthorizedTestData[1]._id },
      });

      expect(resultWithoutAccess.ok).toBe(true);
      if (!resultWithoutAccess.ok) throw new Error("Test setup failed");
      expect(resultWithoutAccess.data.data).toHaveLength(0);
      expect(resultWithoutAccess.data.pagination.total).toBe(0);
    });

    it("can find owned data with pagination", async ({ c }) => {
      const { expect, builder } = c;

      // Total data count in simpleCollection is 10 for reading + 10 for unauthorized access testing = 20
      const result = await builder.findData({
        collection: simpleCollection.id,
        filter: {},
        pagination: { limit: 5, offset: 10 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data).toHaveLength(5);
      expect(result.data.pagination.total).toBe(20);
      expect(result.data.pagination.limit).toBe(5);
      expect(result.data.pagination.offset).toBe(10);
    });

    it("prevents unauthorized update even with read permission", async ({
      c,
    }) => {
      const { expect, user } = c;

      // Grant unauthorizedBuilder only read permission on unauthorizedTestData[2]
      const grantResult = await user.grantAccess({
        collection: simpleCollection.id,
        document: unauthorizedTestData[2]._id,
        acl: {
          grantee: (await unauthorizedBuilderSigner.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      });
      expect(grantResult.ok).toBe(true);

      // unauthorizedBuilder should NOT be able to update even with read permission
      const result = await unauthorizedBuilder.updateData({
        collection: simpleCollection.id,
        filter: { _id: unauthorizedTestData[2]._id },
        update: { $set: { name: "hacked" } },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Test setup failed");
      expect(result.data.data.modified).toBe(0);
    });

    it("allows authorized query execution with execute permission", async ({
      c,
    }) => {
      const { expect, userSigner } = c;

      // 1. Unauthorized builder creates its OWN collection
      const unauthorizedCollectionId = createUuidDto();
      const createCollectionResult = await unauthorizedBuilder.createCollection(
        {
          _id: unauthorizedCollectionId,
          type: "owned",
          name: "unauthorized-collection",
          schema: simpleCollectionJson.schema,
        },
      );
      expect(createCollectionResult.ok).toBe(true);

      // 2. Unauthorized builder creates its OWN query for its collection
      const unauthorizedQueryId = createUuidDto();
      const createQueryResult = await unauthorizedBuilder.createQuery({
        _id: unauthorizedQueryId,
        name: "unauthorized-simple-query",
        collection: unauthorizedCollectionId,
        variables: { name: { path: "$.pipeline[0].$match.name" } },
        pipeline: [{ $match: { name: "" } }],
      });
      expect(createQueryResult.ok).toBe(true);

      // 3. Unauthorized builder creates data in its collection, owned by the main user,
      //    and grants ITSELF 'execute' permission.
      const testDoc = { _id: createUuidDto(), name: "test-execute" };
      const createDataResult = await unauthorizedBuilder.createOwnedData({
        owner: (await userSigner.getDid()).didString,
        collection: unauthorizedCollectionId,
        data: [testDoc],
        acl: {
          grantee: (await unauthorizedBuilderSigner.getDid()).didString,
          read: false,
          write: false,
          execute: true,
        },
      });
      expect(createDataResult.ok).toBe(true);

      // 4. Unauthorized builder can now run its query, which will process the data
      //    it has 'execute' permission on.
      const runQueryResult = await unauthorizedBuilder.runQuery({
        _id: unauthorizedQueryId,
        variables: { name: testDoc.name },
      });
      expect(runQueryResult.ok).toBe(true);
    });
  });

  describe("Cleanup", () => {
    it("can delete collection", async ({ c }) => {
      const { expect, bindings, builder, builderSigner } = c;

      const id = collection.id;
      const result = await builder.deleteCollection(id);
      expect(result.ok).toBe(true);

      const collectionDocument = await bindings.db.primary
        .collection<CollectionDocument>(CollectionName.Collections)
        .findOne({ _id: new UUID(id) });

      expect(collectionDocument).toBeNull();

      const builderDocument = await expectBuilder(
        c,
        (await builderSigner.getDid()).didString,
      );
      expect(builderDocument.collections).toHaveLength(1);

      await assertDocumentCount(c, id, 0);
    });
  });
});
