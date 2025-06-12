import {
  Did,
  InvocationBody,
  Keypair,
  NucTokenBuilder,
  NucTokenEnvelopeSchema,
} from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { UUID } from "mongodb";
import { describe } from "vitest";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import { createUuidDto } from "#/common/types";
import type { TailDataRequest } from "#/data/data.dto";
import type { UploadResult } from "#/data/data.repository";
import type { ExecuteQueryRequest } from "#/queries/queries.dto";
import { Permissions } from "#/users/users.types";
import queryJson from "./data/wallet.query.json";
import schemaJson from "./data/wallet.schema.json";
import { expectSuccessResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("nuc-based access control", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  // don't create schema and query as part of fixture standup else the fixture activates the builder
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  const user = {
    kp: Keypair.generate(),
  };

  beforeAll(async ({ builder }) => {
    await builder.ensureSubscriptionActive();
  });
  afterAll(async (_c) => {});

  it("can setup schemas and queries", async ({ c }) => {
    const { expect, builder, user } = c;

    schema.id = new UUID();
    await builder
      .addSchema(c, {
        _id: schema.id,
        name: schema.name,
        collection: schema.schema,
        documentType: schema.documentType,
      })
      .expectSuccess();

    query.id = new UUID();
    query.schema = schema.id;
    await builder
      .createQuery(c, {
        id: query.id,
        name: query.name,
        collection: query.schema,
        variables: query.variables,
        pipeline: query.pipeline,
      })
      .expectSuccess();

    const result = await builder
      .uploadOwnedData(c, {
        userId: user.did,
        collection: schema.id,
        data: [
          {
            _id: createUuidDto(),
            wallet: "0x1",
            country: "GBR",
            age: 10,
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
  });

  it("allows for delegated access (cmd: /nil/db)", async ({ c }) => {
    const { expect, app, admin, bindings, builder, user } = c;

    // 1. The org mints a delegation nuc address to the user
    const delegationFromBuilderRaw = NucTokenBuilder.extending(
      await builder.getRootToken(),
    )
      .audience(Did.fromHex(user.keypair.publicKey("hex")))
      .build(builder.keypair.privateKey());

    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation address to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .body(new InvocationBody({}))
      .audience(Did.fromHex(admin._options.nodePublicKey))
      .build(user.keypair.privateKey());

    // 3. User creates an upload data request
    const body = {
      userId: user.did,
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          wallet: "0x2",
          country: "CAN",
          age: 20,
        },
      ],
      permissions: new Permissions(builder.did, {
        read: true,
        write: false,
        execute: false,
      }),
    };

    // 4. Send the request to nilDB using the invocation NUC to write the builder schemas
    const response = await app.request(PathsV1.data.createOwned, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 5. Check the response succeeded
    const result = await expectSuccessResponse<UploadResult>(c, response);
    expect(result.data.created).toHaveLength(1);

    // 6. Check the organisations schema to confirm the data upload
    const documents = await bindings.db.data
      .collection<{ _id: UUID }>(schema.id.toString())
      .find({ id: new UUID(body.data[0]._id) })
      .toArray();

    expect(documents).toHaveLength(1);
    expect(documents[0]._id.toString()).toBe(body.data[0]._id);
  });

  it("allows for delegated upload data (cmd: /nil/db/data)", async ({ c }) => {
    const { expect, app, admin, bindings, builder, user } = c;

    // 1. The org mints a delegation nuc address to the user
    const delegationFromBuilderRaw = NucTokenBuilder.extending(
      await builder.getRootToken(),
    )
      .audience(Did.fromHex(user.keypair.publicKey("hex")))
      .command(NucCmd.nil.db.data)
      .build(builder.keypair.privateKey());
    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation address to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.nodePublicKey))
      .body(new InvocationBody({}))
      .build(user.keypair.privateKey());

    // 3. User creates an upload data request
    const body = {
      userId: user.did,
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          wallet: "0x3",
          country: "FR",
          age: 30,
        },
      ],
      permissions: new Permissions(builder.did, {
        read: true,
        write: false,
        execute: false,
      }),
    };

    // 4. Send the request to nilDB using the invocation NUC to write the builder's schemas
    const response = await app.request(PathsV1.data.createOwned, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 5. Check the response succeeded
    const result = await expectSuccessResponse<UploadResult>(c, response);
    expect(result.data.created).toHaveLength(1);

    // 6. Check the organisations schema to confirm the data upload
    const documents = await bindings.db.data
      .collection<{ _id: UUID }>(schema.id.toString())
      .find({ id: new UUID(body.data[0]._id) })
      .toArray();

    expect(documents).toHaveLength(1);
    expect(documents[0]._id.toString()).toBe(body.data[0]._id);

    // 7. Confirm delegation is limited to /nil/db/data by trying to access the org's profile
    const forbiddenResponse = await app.request(PathsV1.builders.me, {
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
      },
    });
    expect(forbiddenResponse.status).toBe(StatusCodes.FORBIDDEN);
  });

  it("allows for delegated run query (cmd: /nil/db/queries)", async ({ c }) => {
    const { expect, app, admin, builder, user } = c;

    // 1. The org mints a delegation nuc address to the user
    const delegationFromBuilderRaw = NucTokenBuilder.extending(
      await builder.getRootToken(),
    )
      .audience(Did.fromHex(user.keypair.publicKey("hex")))
      .command(NucCmd.nil.db.queries)
      .build(builder.keypair.privateKey());
    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation addressed to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.nodePublicKey))
      .body(new InvocationBody({}))
      .build(user.keypair.privateKey());

    // 3. User creates a query execution request (average age of wallets in GBR)
    const body: ExecuteQueryRequest = {
      id: query.id,
      variables: {},
    };

    // 4. Send the request to nilDB using the invocation NUC to run the builder's query
    const response = await app.request(PathsV1.queries.execute, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 5. Check the response succeeded
    const result = await expectSuccessResponse<
      [
        {
          averageAge: number;
          count: number;
        },
      ]
    >(c, response);
    expect(result.data[0].averageAge).toBe(10);
    expect(result.data[0].count).toBe(1);

    // 7. Confirm delegation is limited to /nil/db/queries by trying to access the org's profile
    const forbiddenResponse = await app.request(PathsV1.builders.me, {
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
      },
    });
    expect(forbiddenResponse.status).toBe(StatusCodes.FORBIDDEN);
  });

  it("rejects namespace v path jumps: token.cmd=/nil/db/queries attempting to access /api/v1/data/tail)", async ({
    c,
  }) => {
    const { expect, app, admin, builder } = c;

    // 1. The org mints a delegation nuc address to the user
    const delegationFromBuilderRaw = NucTokenBuilder.extending(
      await builder.getRootToken(),
    )
      .audience(Did.fromHex(user.kp.publicKey("hex")))
      .command(NucCmd.nil.db.queries)
      .build(builder.keypair.privateKey());

    // 2. The user receives the delegation nuc, mints an invocation addressed to the nildb node

    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.nodePublicKey))
      .body(new InvocationBody({}))
      .build(user.kp.privateKey());

    // 3. Send namespace-jump attempt
    const body: TailDataRequest = {
      schema: schema.id,
    };
    const response = await app.request(PathsV1.data.tail, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 4. Check the response was rejected
    expect(response.status).toBe(StatusCodes.FORBIDDEN);
  });

  it("enforces revocations", async ({ c }) => {
    const { expect, app, admin, builder } = c;

    // 1. The org mints a delegation nuc addressed to the user
    const rootNuc = await builder.getRootToken();
    const delegationFromBuilderRaw = NucTokenBuilder.extending(rootNuc)
      .audience(Did.fromHex(user.kp.publicKey("hex")))
      .command(NucCmd.nil.db.queries)
      .build(builder.keypair.privateKey());
    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation addressed to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.nodePublicKey))
      .build(user.kp.privateKey());

    // 3. The org revokes the delegation nuc
    await builder.nilauth.revokeToken(rootNuc);

    // 4. User creates a query execution request (average age of wallets in GBR)
    const body: ExecuteQueryRequest = {
      id: query.id,
      variables: {},
    };

    // 5. User sends the request using the derived permissions from the revoked root nuc
    const response = await app.request(PathsV1.queries.execute, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 6. Check that nildb rejected the request
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
