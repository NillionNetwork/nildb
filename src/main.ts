import { serve } from "@hono/node-server";
import { Command } from "commander";
import dotenv from "dotenv";
import { mongoMigrateUp } from "#/common/mongo";
import packageJson from "../package.json";
import { buildApp } from "./app";
import { FeatureFlag, hasFeatureFlag, loadBindings } from "./env";

export type NilDbCliOptions = {
  envFile: string;
};

async function main() {
  const program = new Command();

  program
    .name("@nillion/nildb-api")
    .description("nilDB API server cli")
    .version(packageJson.version)
    .option("--env-file [path]", "Path to the env file (default .env)", ".env")
    .parse(process.argv);

  const options = program.opts<NilDbCliOptions>();
  console.info("! Cli options: %O", options);

  const envFilePath = options.envFile ?? ".env";
  dotenv.config({ path: envFilePath, override: true });
  const bindings = await loadBindings();
  bindings.log.info("! Enabled features: %O", bindings.config.enabledFeatures);

  if (hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.MIGRATIONS)) {
    await mongoMigrateUp(bindings.config.dbUri, bindings.config.dbNamePrimary);
  }

  bindings.log.info("Building app ...");
  const { app, metrics } = await buildApp(bindings);

  bindings.log.info("Starting servers ...");
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

  const shutdown = async (): Promise<void> => {
    bindings.log.info(
      "Received shutdown signal. Starting graceful shutdown...",
    );

    try {
      const promises = [
        new Promise((resolve) => appServer.close(resolve)),
        new Promise((resolve) => metricsServer.close(resolve)),
        await bindings.db.client.close(),
      ];

      if (bindings.mq) {
        promises.push(bindings.mq.channel.close());
        promises.push(bindings.mq.connection.close());
      }

      await Promise.all(promises);

      bindings.log.info("Graceful shutdown completed. Goodbye.");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
