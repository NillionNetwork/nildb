import * as vitest from "vitest";
import type { App } from "#/app";
import type { AppBindingsWithNilcomm } from "#/env";
import {
  type QueryFixture,
  type SchemaFixture,
  type TestFixture,
  buildFixture,
} from "./fixture";
import type {
  TestAdminUserClient,
  TestOrganizationUserClient,
  TestRootUserClient,
} from "./test-client";

type FixtureContext = {
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

  const it = vitest.test.extend<FixtureContext>({
    // biome-ignore lint/correctness/noEmptyPattern: <explanation>
    id: async ({}, use) => {
      if (!fixture) throw new Error("Fixture not initialized");
      await use(fixture.id);
    },
    // biome-ignore lint/correctness/noEmptyPattern: <explanation>
    app: async ({}, use) => {
      if (!fixture) throw new Error("Fixture not initialized");
      await use(fixture.app);
    },
    // biome-ignore lint/correctness/noEmptyPattern: <explanation>
    bindings: async ({}, use) => {
      if (!fixture) throw new Error("Fixture not initialized");
      await use(fixture.bindings);
    },
    // biome-ignore lint/correctness/noEmptyPattern: <explanation>
    root: async ({}, use) => {
      if (!fixture) throw new Error("Fixture not initialized");
      await use(fixture.root);
    },
    // biome-ignore lint/correctness/noEmptyPattern: <explanation>
    admin: async ({}, use) => {
      if (!fixture) throw new Error("Fixture not initialized");
      await use(fixture.admin);
    },
    // biome-ignore lint/correctness/noEmptyPattern: <explanation>
    organization: async ({}, use) => {
      if (!fixture) throw new Error("Fixture not initialized");
      await use(fixture.organization);
    },
  });

  const beforeAll = (fn: (ctx: FixtureContext) => Promise<void>) =>
    vitest.beforeAll(async () => {
      fixture = await buildFixture(opts);
      await fn(fixture);
    });

  const afterAll = (fn: (ctx: FixtureContext) => Promise<void>) =>
    vitest.afterAll(async () => {
      if (!fixture) throw new Error("Fixture not initialized");
      const { bindings } = fixture;
      const { config, db } = bindings;

      if (!opts.keepDbs) {
        await db.client.db(config.dbNamePrimary).dropDatabase();
        await db.client.db(config.dbNameData).dropDatabase();
      }
      await db.client.close(true);

      if (bindings.mq) {
        await bindings.mq.channel.close();
        await bindings.mq.connection.close();
      }

      await fn(fixture);
    });

  return { beforeAll, afterAll, it };
}
