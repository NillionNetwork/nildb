import * as vitest from "vitest";
import type { FixtureContext } from "./fixture";
import {
  buildFixture,
  type CollectionFixture,
  type QueryFixture,
} from "./fixture";

type TestFixtureExtension = {
  it: vitest.TestAPI<{ c: FixtureContext }>;
  beforeAll: (fn: (c: FixtureContext) => Promise<void>) => void;
  afterAll: (fn: (c: FixtureContext) => Promise<void>) => void;
};

export function createTestFixtureExtension(
  opts: {
    collection?: CollectionFixture;
    query?: QueryFixture;
    keepDbs?: boolean;
  } = {},
): TestFixtureExtension {
  let fixture: FixtureContext | null = null;

  const it = vitest.test.extend<{ c: FixtureContext }>({
    c: async ({ expect }, use) => {
      const ctx: FixtureContext = {
        ...fixture!,
        expect,
      };

      await use(ctx);
    },
  });

  const beforeAll = (fn: (c: FixtureContext) => Promise<void>) =>
    vitest.beforeAll(async () => {
      try {
        fixture = await buildFixture(opts);
        await fn(fixture);
      } catch (cause) {
        // Fallback to `process.stderr` to ensure fixture setup failures are logged during suite setup/teardown
        process.stderr.write("***\n");
        process.stderr.write(
          "Critical: Fixture setup failed, stopping test run\n",
        );
        process.stderr.write(`${cause}\n`);
        process.stderr.write("***\n");
        throw new Error("Critical: Fixture setup failed, stopping test run", {
          cause,
        });
      }
    });

  const afterAll = (fn: (c: FixtureContext) => Promise<void>) =>
    vitest.afterAll(async () => {
      if (!fixture) {
        // Fallback to `process.stderr` to ensure fixture setup failures are logged during suite setup/teardown
        process.stderr.write(
          "Fixture is not initialized, skipping 'afterAll' hook\n",
        );
        return;
      }
      const { bindings } = fixture;
      const { config, db } = bindings;

      if (!opts.keepDbs) {
        await db.client.db(config.dbNamePrimary).dropDatabase();
        await db.client.db(config.dbNameData).dropDatabase();
      }
      await db.client.close(true);
      await fn(fixture);
    });

  return { beforeAll, afterAll, it };
}
