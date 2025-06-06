import { faker } from "@faker-js/faker";
import { Command, Did, Keypair, NucTokenBuilder } from "@nillion/nuc";
import dotenv from "dotenv";
import { StatusCodes } from "http-status-codes";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "#/app";
import { mongoMigrateUp } from "#/common/mongo";
import { PathsV1 } from "#/common/paths";
import { FeatureFlag, hasFeatureFlag, loadBindings } from "#/env";
import type { FixtureContext } from "./fixture/fixture";
import { createTestLogger } from "./fixture/logger";
import {
  createAdminTestClient,
  createBuilderTestClient,
  createUserTestClient,
} from "./fixture/test-client";

/**
 * Bootstrap integration tests for core NilDB functionality.
 *
 * These tests verify fundamental authentication and authorization flows using
 * minimal test infrastructure. While other tests use the full fixture system
 * for convenience, these tests intentionally use only basic test clients to
 * ensure core functionality works independently.
 */
describe("bootstrap.test.ts", () => {
  let c: FixtureContext;

  beforeAll(async () => {
    dotenv.config({ path: [".env.test", ".env.test.nilauthclient"] });
    const id = faker.string.alphanumeric({ length: 4, casing: "lower" });
    const log = createTestLogger(id);

    process.env.APP_DB_NAME_PRIMARY = `${process.env.APP_DB_NAME_PRIMARY}_${id}`;
    process.env.APP_DB_NAME_DATA = `${process.env.APP_DB_NAME_DATA}_${id}`;
    process.env.APP_DB_NAME_PERMISSIONS = `${process.env.APP_DB_NAME_PERMISSIONS}_${id}`;

    const bindings = await loadBindings();

    if (
      hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.MIGRATIONS)
    ) {
      await mongoMigrateUp(
        bindings.config.dbUri,
        bindings.config.dbNamePrimary,
      );
    }

    const app = (await buildApp(bindings)).app;

    const nodeKeypair = Keypair.from(bindings.config.nodeSecretKey);
    const builderKeypair = Keypair.from(
      process.env.APP_NILCHAIN_PRIVATE_KEY_1!,
    );

    const admin = await createAdminTestClient({
      app,
      keypair: nodeKeypair,
      nodePublicKey: nodeKeypair.publicKey("hex"),
    });
    const builder = await createBuilderTestClient({
      app,
      keypair: builderKeypair,
      chainUrl: process.env.APP_NILCHAIN_JSON_RPC,
      nilauthBaseUrl: process.env.APP_NILAUTH_BASE_URL,
      nodePublicKey: nodeKeypair.publicKey("hex"),
    });
    const user = await createUserTestClient({
      app,
      keypair: Keypair.generate(),
      nodePublicKey: nodeKeypair.publicKey("hex"),
    });

    c = {
      id,
      log,
      app,
      bindings,
      admin: admin,
      builder,
      user,
      // expect is required, so adding global vitest.expect (tests should replace it for localised reporting)
      expect,
    };
  });

  it("routes reject requests without any authentication", async ({
    expect,
  }) => {
    c.expect = expect;
    const response = await c.app.request(PathsV1.schemas.root);
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("builder can register", async ({ expect }) => {
    c.expect = expect;
    const { builder } = c;
    const body = {
      did: builder.did,
      name: faker.person.fullName(),
    };

    await builder.register(c, body).expectSuccess();
  });

  it("self-signed tokens are rejected from paid route", async ({ expect }) => {
    c.expect = expect;
    const { builder, admin } = c;

    const selfSignedToken = NucTokenBuilder.invocation({})
      .command(new Command(["nil", "db"]))
      .audience(Did.fromHex(admin.keypair.publicKey("hex")))
      .subject(Did.fromHex(builder.keypair.publicKey("hex")))
      .build(builder.keypair.privateKey());

    const response = await builder.app.request(PathsV1.schemas.root, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${selfSignedToken}`,
      },
    });
    expect(response.status).toBe(StatusCodes.PAYMENT_REQUIRED);
  });

  it("builder can access paid routes with a subscription", async ({
    expect,
  }) => {
    c.expect = expect;
    const { builder } = c;

    await builder.ensureSubscriptionActive();
    await builder.listSchemas(c).expectSuccess();
  });
});
