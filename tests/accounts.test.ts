import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import type { AccountDocument } from "#/admin/admin.types";
import { CollectionName } from "#/common/mongo";
import { PathsV1 } from "#/common/paths";
import { expectSuccessResponse } from "./fixture/assertions";
import { createTestFixtureExtension } from "./fixture/it";
import { TestOrganizationUserClient } from "./fixture/test-client";

describe("account management", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_ctx) => {});
  afterAll(async (_ctx) => {});

  it("root can create an admin account without subscription", async ({
    expect,
    bindings,
    root,
  }) => {
    const keypair = Keypair.generate();
    const did = keypair.toDidString();

    const response = await root.createAccount({
      did,
      name: faker.person.fullName(),
      type: "admin",
    });

    expect(response.status).toBe(StatusCodes.CREATED);

    const document = await bindings.db.primary
      .collection<AccountDocument>(CollectionName.Accounts)
      .findOne({ _id: did });
    expect(document).toBeDefined;
  });

  it("rejects requests when the subscription is inactive", async ({
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

  it("accepts requests when the subscription is active", async ({
    expect,
    organization,
  }) => {
    await organization.ensureSubscriptionActive();

    const response = await organization.getAccount();
    const { data } =
      await expectSuccessResponse<OrganizationAccountDocument>(response);
    expect(data._id).toBe(organization.did);
  });

  it("admin can register an organization account", async ({
    expect,
    bindings,
    admin,
  }) => {
    const keypair = Keypair.generate();
    const did = keypair.toDidString();

    const response = await admin.createAccount({
      did,
      name: faker.company.name(),
      type: "organization",
    });

    expect(response.status).toBe(StatusCodes.CREATED);

    const document = await bindings.db.primary
      .collection<AccountDocument>(CollectionName.Accounts)
      .findOne({ _id: did });
    expect(document).toBeDefined;
  });

  it("an organization can read its profile", async ({
    expect,
    organization,
  }) => {
    const response = await organization.getAccount();
    const data = await expectSuccessResponse(response);

    expect(data.data).toMatchObject({
      _id: organization.did,
      _type: "organization",
    });
  });

  it("an organization can self-register", async ({
    app,
    bindings,
    expect,
    organization,
  }) => {
    const keypair = Keypair.generate();
    const did = keypair.toDidString();

    const newOrganization = new TestOrganizationUserClient({
      app,
      keypair,
      payer: organization._options.payer,
      nilauth: organization._options.nilauth,
      node: bindings.node,
    });

    await newOrganization.ensureSubscriptionActive();

    const response = await newOrganization.register({
      did,
      name: faker.company.name(),
    });

    expect(response.status).toBe(StatusCodes.CREATED);

    const document = await bindings.db.primary
      .collection<AccountDocument>(CollectionName.Accounts)
      .findOne({ did: newOrganization.did });
    expect(document).toBeDefined;
  });

  it("organization can update its public key", async ({
    expect,
    organization,
  }) => {
    const keypair = Keypair.generate();
    const updatedPublicKey = keypair.publicKey("hex");
    const response = await organization.updateAccount({
      did: organization.did,
      publicKey: updatedPublicKey,
    });
    expect(response.status).toBe(StatusCodes.OK);

    const account = await organization.getAccount();
    const data = await expectSuccessResponse(account);

    expect(data.data).toMatchObject({
      _id: organization.did,
      _type: "organization",
      publicKey: updatedPublicKey,
    });
  });

  it("admin can remove an organization account", async ({
    expect,
    bindings,
    admin,
    organization,
  }) => {
    const response = await admin.deleteAccount({
      id: organization.did,
    });

    expect(response.status).toBe(StatusCodes.NO_CONTENT);

    const documents = await bindings.db.primary
      .collection<OrganizationAccountDocument>(CollectionName.Accounts)
      .findOne({ _id: organization.did });

    expect(documents).toBeNull();
  });
});
