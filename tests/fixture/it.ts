import * as vitest from "vitest";
import type { App } from "#/app";
import type { AppBindingsWithNilcomm } from "#/env";
import {
  buildFixture,
  type QueryFixture,
  type SchemaFixture,
  type TestFixture,
} from "./fixture";
import type {
  TestAdminUserClient,
  TestOrganizationUserClient,
  TestRootUserClient,
} from "./test-client";

export type FixtureContext = {
  id: string;
  app: App;
  bindings: AppBindingsWithNilcomm;
  root: TestRootUserClient;
  admin: TestAdminUserClient;
  organization: TestOrganizationUserClient;
};

type TestFixtureExtension = {
  it: vitest.TestAPI<FixtureContext>;
  beforeAll: (fn: (ctx: FixtureContext) => Promise<void>) => void;
  afterAll: (fn: (ctx: FixtureContext) => Promise<void>) => void;
};

export function createTestFixtureExtension(
  opts: {
    schema?: SchemaFixture;
    query?: QueryFixture;
    keepDbs?: boolean;
    enableNilcomm?: boolean;
  } = {},
): TestFixtureExtension {
  let fixture: TestFixture | null = null;

  // biome-ignore-start lint/correctness/noEmptyPattern: Vitest fixture API requires this parameter structure
  const it = vitest.test.extend<FixtureContext>({
    id: async ({}, use) => {
      if (!fixture) throw new Error("Fixture is not initialized");
      await use(fixture.id);
    },
    app: async ({}, use) => {
      if (!fixture) throw new Error("Fixture is not initialized");
      await use(fixture.app);
    },
    bindings: async ({}, use) => {
      if (!fixture) throw new Error("Fixture is not initialized");
      await use(fixture.bindings);
    },
    root: async ({}, use) => {
      if (!fixture) throw new Error("Fixture is not initialized");
      await use(fixture.root);
    },
    admin: async ({}, use) => {
      if (!fixture) throw new Error("Fixture is not initialized");
      await use(fixture.admin);
    },
    organization: async ({}, use) => {
      if (!fixture) throw new Error("Fixture is not initialized");
      await use(fixture.organization);
    },
  });
  // biome-ignore-end lint/correctness/noEmptyPattern: Vitest fixture API requires this parameter structure

  const beforeAll = (fn: (ctx: FixtureContext) => Promise<void>) =>
    vitest.beforeAll(async () => {
      try {
        fixture = await buildFixture(opts);
        await fn(fixture);
      } catch (error) {
        console.error("Fixture setup failed:", error);
        throw error;
      }
    });

  const afterAll = (fn: (ctx: FixtureContext) => Promise<void>) =>
    vitest.afterAll(async () => {
      if (!fixture) throw new Error("Fixture is not initialized");
      const { bindings } = fixture;
      const { config, db } = bindings;

      if (!opts.keepDbs) {
        await db.client.db(config.dbNamePrimary).dropDatabase();
        await db.client.db(config.dbNameData).dropDatabase();
      }
      await db.client.close(true);

      if (bindings.mq) {
        await bindings.mq.channel.close();
        await bindings.mq.channelModel.close();
      }

      await fn(fixture);
    });

  return { beforeAll, afterAll, it };
}
