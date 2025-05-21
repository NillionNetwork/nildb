import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { CollectionName } from "#/common/mongo";
import { PathsV1 } from "#/common/paths";
import { expectAccount, expectSuccessResponse } from "./fixture/assertions";
import { createTestFixtureExtension } from "./fixture/it";
import { TestOrganizationUserClient } from "./fixture/test-client";

describe("account management", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("root can create an admin account without subscription", async ({ c }) => {
    const { root, expect } = c;

    const keypair = Keypair.generate();
    const did = keypair.toDidString();

    const response = await root.createAccount({
      did,
      name: faker.person.fullName(),
      type: "admin",
    });

    expect(response.status).toBe(StatusCodes.CREATED);
    await expectAccount(c, did);
  });

  it("rejects requests when the subscription is inactive", async ({ c }) => {
    const { organization, expect } = c;

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

  it("accepts requests when the subscription is active", async ({ c }) => {
    const { organization, expect } = c;

    await organization.ensureSubscriptionActive();

    const response = await organization.getAccount();
    const { data } = await expectSuccessResponse<OrganizationAccountDocument>(
      c,
      response,
    );
    expect(data._id).toBe(organization.did);
  });

  it("admin can register an organization account", async ({ c }) => {
    const { admin, expect } = c;

    const keypair = Keypair.generate();
    const did = keypair.toDidString();

    const response = await admin.createAccount({
      did,
      name: faker.company.name(),
      type: "organization",
    });

    expect(response.status).toBe(StatusCodes.CREATED);
    await expectAccount(c, did);
  });

  it("an organization can read its profile", async ({ c }) => {
    const { organization, expect } = c;

    const response = await organization.getAccount();
    const { data } = await expectSuccessResponse<OrganizationAccountDocument>(
      c,
      response,
    );

    expect(data).toMatchObject({
      _id: organization.did,
      _type: "organization",
    });
  });

  it("an organization can self-register", async ({ c }) => {
    const { app, bindings, organization, expect } = c;

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
    await expectAccount(c, newOrganization.did);
  });

  it("an organization can update its public key", async ({ c }) => {
    const { organization, expect } = c;

    const keypair = Keypair.generate();
    const updatedPublicKey = keypair.publicKey("hex");
    const response = await organization.updateAccount({
      did: organization.did,
      publicKey: updatedPublicKey,
    });
    expect(response.status).toBe(StatusCodes.OK);

    const account = await organization.getAccount();
    const data = await expectSuccessResponse(c, account);

    expect(data.data).toMatchObject({
      _id: organization.did,
      _type: "organization",
      publicKey: updatedPublicKey,
    });
  });

  it("admin can remove an organization account", async ({ c }) => {
    const { admin, bindings, organization, expect } = c;

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
