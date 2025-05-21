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
  expect: vitest.ExpectStatic;
};

type TestFixtureExtension = {
  it: vitest.TestAPI<{ c: FixtureContext }>;
  beforeAll: (fn: (c: Omit<FixtureContext, "expect">) => Promise<void>) => void;
  afterAll: (fn: (c: Omit<FixtureContext, "expect">) => Promise<void>) => void;
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

  const it = vitest.test.extend<{ c: FixtureContext }>({
    c: async ({ expect }, use) => {
      if (!fixture) throw new Error("Fixture is not initialized");

      const ctx: FixtureContext = {
        id: fixture.id,
        app: fixture.app,
        bindings: fixture.bindings,
        root: fixture.root,
        admin: fixture.admin,
        organization: fixture.organization,
        expect,
      };

      await use(ctx);
    },
  });

  const beforeAll = (
    fn: (c: Omit<FixtureContext, "expect">) => Promise<void>,
  ) =>
    vitest.beforeAll(async () => {
      try {
        fixture = await buildFixture(opts);
        await fn(fixture);
      } catch (error) {
        console.error("Fixture setup failed:", error);
        throw error;
      }
    });

  const afterAll = (fn: (c: Omit<FixtureContext, "expect">) => Promise<void>) =>
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
