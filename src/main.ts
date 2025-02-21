import { serve } from "@hono/node-server";
import { Command } from "commander";
import dotenv from "dotenv";
import { mongoMigrateUp } from "#/common/mongo";
import packageJson from "../package.json";
import { buildApp } from "./app";
import { loadBindings } from "./env";

async function main() {
  const program = new Command();

  program
    .name("@nillion/nildb-api")
    .description("nilDB API server cli")
    .version(packageJson.version)
    .option("--env-file <path>", "Path to custom .env file")
    .option("--disable-migrations", "Disable MongoDB migrations")
    .parse(process.argv);

  const options = program.opts();
  console.info("! Starting api ...");

  if (options.envFile) {
    console.info(`! Using env file: ${options.envFile}`);
    dotenv.config({ path: options.envFile, override: true });
  } else {
    console.info("! Using env file: .env");
    dotenv.config({ override: true });
  }

  const bindings = await loadBindings();

  console.info(`! Migrations enabled: ${!options.disableMigrations}`);
  if (!options.disableMigrations) {
    await mongoMigrateUp(bindings.config.dbUri, bindings.config.dbNamePrimary);
  }

  const { app, metrics } = buildApp(bindings);

  const appServer = serve(
    {
      fetch: app.fetch,
      port: bindings.config.webPort,
    },
    () => {
      bindings.log.info(
        `Node public address ${bindings.node.identity.address}`,
      );
      bindings.log.info(`Node public endpoint ${bindings.node.endpoint}`);
      bindings.log.info(`App on :${bindings.config.webPort}`);
    },
  );

  const metricsServer = serve(
    {
      fetch: metrics.fetch,
      port: bindings.config.metricsPort,
    },
    () => {
      bindings.log.info(`Metrics on :${bindings.config.metricsPort}`);
    },
  );

  async function shutdown() {
    bindings.log.info(
      "Received shutdown signal. Starting graceful shutdown...",
    );

    try {
      await Promise.all([
        new Promise((resolve) => appServer.close(resolve)),
        new Promise((resolve) => metricsServer.close(resolve)),
        bindings.db.client.close(),
      ]);

      bindings.log.info("Graceful shutdown completed. Goodbye.");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
