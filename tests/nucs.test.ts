import {
  Did,
  Keypair,
  NucTokenBuilder,
  NucTokenEnvelopeSchema,
} from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { UUID } from "mongodb";
import { describe } from "vitest";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import type { AccountDocument } from "#/admin/admin.types";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import { createUuidDto } from "#/common/types";
import type { UploadResult } from "#/data/data.repository";
import type { ExecuteQueryRequest } from "#/queries/queries.types";
import queryJson from "./data/wallet.query.json";
import schemaJson from "./data/wallet.schema.json";
import { expectSuccessResponse } from "./fixture/assertions";
import {
  type QueryFixture,
  registerSchemaAndQuery,
  type SchemaFixture,
} from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("nuc-based access control", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  // don't create schema and query as part of fixture standup else the fixture activates the org account
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  const user = {
    kp: Keypair.generate(),
  };

  beforeAll(async (_ctx) => {});
  afterAll(async (_ctx) => {});

  it("permits admin requests without subscription", async ({
    expect,
    admin,
  }) => {
    const response = await admin.listAccounts();
    const { data: accounts } = (await response.json()) as {
      data: AccountDocument[];
    };

    // an admin account and an org account
    expect(accounts.length).toBe(2);
  });

  it("rejects requests when subscription inactive", async ({
    expect,
    organization,
  }) => {
    const selfSignedRootNuc = organization.nuc();
    const response = await organization.app.request(PathsV1.accounts.root, {
      headers: {
        Authorization: `Bearer ${selfSignedRootNuc}`,
      },
    });
    // Unauthorised for now since we'd need to handle the throw for nuc-ts to delineate
    // between accounts that exist but have no subscription vs accounts that don't exist
    expect(response.status).toBe(401);
  });

  it("accepts requests when subscription active", async ({
    expect,
    organization,
  }) => {
    await organization.ensureSubscriptionActive();

    const response = await expectSuccessResponse<OrganizationAccountDocument>(
      await organization.getAccount(),
    );

    expect(response.data._id).toBe(organization.did);
  });

  it("can setup schemas and queries", async ({ expect, organization }) => {
    const promise = registerSchemaAndQuery({ organization, schema, query });
    await expect(promise).resolves.not.toThrow();

    const response = await organization.uploadData({
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          wallet: "0x1",
          country: "GBR",
          age: 10,
        },
      ],
    });

    const result = await expectSuccessResponse<UploadResult>(response);
    expect(result.data.created).toHaveLength(1);
  });

  it("allows for delegated access (cmd: /nil/db)", async ({
    expect,
    app,
    admin,
    bindings,
    organization,
  }) => {
    // 1. The org mints a delegation nuc address to the user
    const root = await organization.getRootToken();

    const delegationFromBuilderRaw = NucTokenBuilder.extending(root)
      .audience(Did.fromHex(user.kp.publicKey("hex")))
      .build(organization.keypair.privateKey());

    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation address to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.node.keypair.publicKey("hex")))
      .build(user.kp.privateKey());

    // 3. User creates an upload data request
    const body = {
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          wallet: "0x2",
          country: "CAN",
          age: 20,
        },
      ],
    };

    // 4. Send the request to nilDB using the invocation NUC to write the organizations schemas
    const response = await app.request(PathsV1.data.upload, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 5. Check the response succeeded
    const result = await expectSuccessResponse<UploadResult>(response);
    expect(result.data.created).toHaveLength(1);

    // 6. Check the organisations schema to confirm the data upload
    const documents = await bindings.db.data
      .collection<{ _id: UUID }>(schema.id.toString())
      .find({ _id: new UUID(body.data[0]._id) })
      .toArray();

    expect(documents).toHaveLength(1);
    expect(documents[0]._id.toString()).toBe(body.data[0]._id);
  });

  it("allows for delegated upload data (cmd: /nil/db/data)", async ({
    expect,
    app,
    admin,
    bindings,
    organization,
  }) => {
    // 1. The org mints a delegation nuc address to the user
    const root = await organization.getRootToken();
    const delegationFromBuilderRaw = NucTokenBuilder.extending(root)
      .audience(Did.fromHex(user.kp.publicKey("hex")))
      .command(NucCmd.nil.db.data)
      .build(organization.keypair.privateKey());
    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation address to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.node.keypair.publicKey("hex")))
      .build(user.kp.privateKey());

    // 3. User creates an upload data request
    const body = {
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          wallet: "0x3",
          country: "FR",
          age: 30,
        },
      ],
    };

    // 4. Send the request to nilDB using the invocation NUC to write the organizations schemas
    const response = await app.request(PathsV1.data.upload, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 5. Check the response succeeded
    const result = await expectSuccessResponse<UploadResult>(response);
    expect(result.data.created).toHaveLength(1);

    // 6. Check the organisations schema to confirm the data upload
    const documents = await bindings.db.data
      .collection<{ _id: UUID }>(schema.id.toString())
      .find({ _id: new UUID(body.data[0]._id) })
      .toArray();

    expect(documents).toHaveLength(1);
    expect(documents[0]._id.toString()).toBe(body.data[0]._id);

    // 7. Confirm delegation is limited to /nil/db/data by trying to access the org's profile
    const forbiddenResponse = await app.request(PathsV1.accounts.root, {
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
      },
    });
    expect(forbiddenResponse.status).toBe(StatusCodes.FORBIDDEN);
  });

  it("allows for delegated run query (cmd: /nil/db/queries)", async ({
    expect,
    app,
    admin,
    organization,
  }) => {
    // 1. The org mints a delegation nuc address to the user
    const root = await organization.getRootToken();
    const delegationFromBuilderRaw = NucTokenBuilder.extending(root)
      .audience(Did.fromHex(user.kp.publicKey("hex")))
      .command(NucCmd.nil.db.queries)
      .build(organization.keypair.privateKey());
    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation addressed to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.node.keypair.publicKey("hex")))
      .build(user.kp.privateKey());

    // 3. User creates a query execution request (average age of wallets in GBR)
    const body: ExecuteQueryRequest = {
      id: query.id,
      variables: {},
    };

    // 4. Send the request to nilDB using the invocation NUC to run the organization's query
    const response = await app.request(PathsV1.queries.execute, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
        "Content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // 5. Check the response succeeded
    const result =
      await expectSuccessResponse<
        [
          {
            averageAge: number;
            count: number;
          },
        ]
      >(response);
    expect(result.data[0].averageAge).toBe(10);
    expect(result.data[0].count).toBe(1);

    // 7. Confirm delegation is limited to /nil/db/queries by trying to access the org's profile
    const forbiddenResponse = await app.request(PathsV1.accounts.root, {
      headers: {
        Authorization: `Bearer ${invocationByUser}`,
      },
    });
    expect(forbiddenResponse.status).toBe(StatusCodes.FORBIDDEN);
  });

  it("enforces revocations", async ({ expect, app, admin, organization }) => {
    // 1. The org mints a delegation nuc addressed to the user
    const root = await organization.getRootToken();
    const delegationFromBuilderRaw = NucTokenBuilder.extending(root)
      .audience(Did.fromHex(user.kp.publicKey("hex")))
      .command(NucCmd.nil.db.queries)
      .build(organization.keypair.privateKey());
    const delegationFromBuilderEnvelope = NucTokenEnvelopeSchema.parse(
      delegationFromBuilderRaw,
    );

    // 2. The user receives the delegation nuc, mints an invocation addressed to the nildb node
    const invocationByUser = NucTokenBuilder.extending(
      delegationFromBuilderEnvelope,
    )
      .audience(Did.fromHex(admin._options.node.keypair.publicKey("hex")))
      .build(user.kp.privateKey());

    // 3. The org revokes the delegation nuc
    await organization._options.nilauth.revokeToken(root);

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
