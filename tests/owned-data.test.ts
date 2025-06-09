import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { DataDocument } from "#/data/data.repository";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/wallet.query.json";
import schemaJson from "./data/wallet.schema.json";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";
import { createUserTestClient } from "./fixture/test-client";

describe("data", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
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
      .uploadOwnedData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data.collection(schema.id.toString()).find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it.skip("rejects primary key collisions", async ({ skip, c }) => {
    skip("TODO: depends on indexes, disable until index endpoint is ready");
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
      .uploadOwnedData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    expect(result.data.errors).toHaveLength(1);

    const cursor = bindings.db.data.collection(schema.id.toString()).find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it.skip("allows for partial success", async ({ skip, c }) => {
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
      .uploadOwnedData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    expect(result.data.errors).toHaveLength(1);
    expect(result.data.created).toHaveLength(1);
  });

  it.skip("rejects duplicates in data payload", async ({ skip, c }) => {
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
      .uploadOwnedData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    const cursor = c.bindings.db.data.collection(schema.id.toString()).find({});
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
      .uploadOwnedData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
  });

  it.skip("can run a query", async ({ skip, c }) => {
    skip("depends on indexes, disable until index endpoint is ready");
    const { expect, builder } = c;

    const { data } = await builder
      .executeQuery(c, {
        id: query.id,
        variables: query.variables,
      })
      .expectSuccess();

    expect(data).toEqual([
      {
        averageAge: 30,
        count: 3,
      },
    ]);
  });

  it("can read data by a single id", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .findOne({});

    expect(expected).toBeDefined();
    const _id = expected!._id.toString();

    const result = await builder
      .readData(c, {
        schema: schema.id,
        filter: { _id },
      })
      .expectSuccess();

    const actual = result.data[0];
    expect(actual._id).toBe(_id);
  });

  it("can read data from a list of ids", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .find({})
      .limit(3)
      .toArray();

    expect(expected).toBeDefined();
    const ids = expected.map((document) => document._id.toString());

    const result = await builder
      .readData(c, {
        schema: schema.id,
        filter: { _id: { $in: ids } },
      })
      .expectSuccess();

    expect(result.data).toHaveLength(3);
  });

  it("can delete data", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .find({})
      .limit(1)
      .toArray();

    expect(expected).toBeDefined();
    const ids = expected.map((document) => document._id.toString());

    const result = await builder
      .deleteData(c, {
        schema: schema.id,
        filter: { _id: { $in: ids } },
      })
      .expectSuccess();

    expect((result.data as DeleteResult).deletedCount).toEqual(1);
  });

  it("can read user data", async ({ c }) => {
    const { expect, user } = c;
    const result = await user.readUserData(c).expectSuccess();
    expect(result.data).toHaveLength(2);
  });

  it("can read data permissions", async ({ c }) => {
    const { expect, bindings, user } = c;

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    const result = await user
      .readPermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
      })
      .expectSuccess();

    expect(result.data).toHaveLength(1);
    const permissions = Array.isArray(result.data)
      ? (Array.from(result.data)[0] as Permissions)
      : undefined;
    expect(permissions?.perms?.read).toBe(true);
    expect(permissions?.perms?.write).toBe(false);
    expect(permissions?.perms?.execute).toBe(false);
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

    // Enforce register user
    await builder
      .uploadOwnedData(c, {
        userId: otherUser.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did),
      })
      .expectSuccess();

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await otherUser
      .readPermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  const targetDid = Keypair.generate().toDidString();
  it("can add data permissions", async ({ c }) => {
    const { expect, bindings, user } = c;

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await user
      .addPermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
        permissions: new Permissions(targetDid),
      })
      .expectSuccess();

    const result = await user
      .readPermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
      })
      .expectSuccess();

    expect(result.data).toHaveLength(2);
    const permissions = Array.isArray(result.data)
      ? (Array.from(result.data)[1] as Permissions)
      : undefined;
    expect(permissions?.perms?.read).toBe(false);
    expect(permissions?.perms?.write).toBe(false);
    expect(permissions?.perms?.execute).toBe(false);
  });

  it("can update data permissions", async ({ c }) => {
    const { expect, bindings, user } = c;

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await user
      .updatePermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
        permissions: new Permissions(targetDid, {
          read: true,
          write: true,
          execute: true,
        }),
      })
      .expectSuccess();

    const result = await user
      .readPermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
      })
      .expectSuccess();

    expect(result.data).toHaveLength(2);
    const permissions = Array.isArray(result.data)
      ? (Array.from(result.data)[1] as Permissions)
      : undefined;
    expect(permissions?.perms?.read).toBe(true);
    expect(permissions?.perms?.write).toBe(true);
    expect(permissions?.perms?.execute).toBe(true);
  });

  it("can delete data permissions", async ({ c }) => {
    const { expect, bindings, user } = c;

    const expected = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .find({})
      .limit(1)
      .toArray();

    const documentId = expected.map((document) => document._id.toString())[0];

    await user
      .deletePermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
        did: targetDid,
      })
      .expectSuccess();

    const result = await user
      .readPermissions(c, {
        schema: schema.id.toString(),
        documentId: documentId.toString(),
      })
      .expectSuccess();

    expect(result.data).toHaveLength(1);
  });
});
