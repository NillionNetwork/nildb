import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { describe } from "vitest";
import { PathsV1 } from "#/common/paths";
import { expectAccount } from "./fixture/assertions";
import { createTestFixtureExtension } from "./fixture/it";
import { TestOrganizationUserClient } from "./fixture/test-client";

describe("account management", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("rejects requests when the subscription is inactive", async ({ c }) => {
    const { organization, expect } = c;

    const selfSignedRootNuc = organization.nuc();
    const response = await organization.app.request(PathsV1.accounts.me, {
      headers: {
        Authorization: `Bearer ${selfSignedRootNuc}`,
      },
    });
    // Unauthorised for now since we'd need to handle the throw for nuc-ts to delineate
    // between accounts that exist but have no subscription vs. accounts that don't exist
    expect(response.status).toBe(401);
  });

  it("accepts requests when the subscription is active", async ({ c }) => {
    const { organization, expect } = c;

    await organization.ensureSubscriptionActive();
    const { data } = await organization.getProfile(c);
    expect(data._id).toBe(organization.did);
  });

  it("an organization can read its profile", async ({ c }) => {
    const { organization } = c;
    const { data: _data } = await organization.getProfile(c);
  });

  it("an organization can self-register", async ({ c }) => {
    const { app, bindings, organization } = c;

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
    await newOrganization.register(c, {
      did,
      name: faker.company.name(),
    });
    await expectAccount(c, newOrganization.did);
  });
});
