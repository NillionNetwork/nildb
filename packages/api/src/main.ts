import { serve } from "@hono/node-server";
import { mongoMigrateUp } from "@nildb/common/mongo";
import {
  initializeMetricsOnly,
  initializeOtel,
  type MetricsOnlyProviders,
  type OtelProviders,
  shutdownMetricsOnly,
  shutdownOtel,
} from "@nildb/common/otel";
import { Command } from "commander";
import dotenv from "dotenv";

import { buildApp } from "./app.js";
import { FeatureFlag, hasFeatureFlag, loadBindings, parseConfigFromEnv } from "./env.js";

export type NilDbCliOptions = {
  envFile: string;
};

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("@nillion/nildb")
    .description("nilDB API server cli")
    .option("--env-file [path]", "Path to the env file (default .env)", ".env")
    .parse(process.argv);

  const options = program.opts<NilDbCliOptions>();
  console.info("! Cli options: %O", options);

  const envFilePath = options.envFile ?? ".env";
  dotenv.config({ path: envFilePath, override: true });

  // Parse config early to check for feature flags
  const config = parseConfigFromEnv({});
  const otelEnabled = hasFeatureFlag(config.enabledFeatures, FeatureFlag.OTEL);
  const metricsEnabled = hasFeatureFlag(config.enabledFeatures, FeatureFlag.METRICS);

  // Validate that only one observability mode is enabled
  if (otelEnabled && metricsEnabled) {
    console.error(
      "Both 'metrics' and 'otel' feature flags are enabled. These are mutually exclusive. Update APP_ENABLED_FEATURES to include only one.",
    );
    process.exit(1);
  }

  // Initialize observability based on feature flags
  let otelProviders: OtelProviders | null = null;
  let metricsOnlyProviders: MetricsOnlyProviders | null = null;

  if (otelEnabled) {
    // Full OpenTelemetry mode: metrics, traces, and logs to OTLP (no /metrics endpoint)
    otelProviders = await initializeOtel(config);
    if (otelProviders) {
      console.info("! OpenTelemetry initialized: metrics, traces, and logs will be pushed to OTLP");
    } else {
      console.info("! OpenTelemetry SDK disabled (OTEL_SDK_DISABLED=true); using stdout logging only");
    }
  } else if (metricsEnabled) {
    // Metrics-only mode: serve metrics on /metrics endpoint (no traces, no logs to OTLP)
    metricsOnlyProviders = await initializeMetricsOnly(config);
    console.info(`! Metrics-only mode initialized: metrics will be served on :${config.metricsPort}/metrics`);
  }

  // Load bindings with OTel logger provider if available (only when otel flag is enabled)
  const bindings = await loadBindings({}, otelProviders?.loggerProvider);
  bindings.log.info("! Enabled features: %O", bindings.config.enabledFeatures);

  bindings.log.info("Building app ...");
  const { app } = await buildApp(bindings);

  bindings.log.info("Starting servers ...");
  const appServer = serve(
    {
      fetch: app.fetch,
      port: bindings.config.webPort,
    },
    async () => {
      bindings.log.info(`Node public endpoint ${bindings.node.endpoint}`);
      bindings.log.info(`Node identifier ${bindings.node.did.didString}`);
      bindings.log.info(`App on :${bindings.config.webPort}`);
    },
  );

  // Run migrations in background to avoid container liveness probe timeouts
  if (hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.MIGRATIONS)) {
    void (async (): Promise<void> => {
      try {
        bindings.log.info("Starting database migrations...");
        await mongoMigrateUp(bindings.config.dbUri, bindings.config.dbNamePrimary);
        bindings.migrationsComplete = true;
        bindings.log.info("Database migrations completed successfully");
      } catch (error) {
        bindings.log.error({ error }, "Database migrations failed");
        process.exit(1);
      }
    })();
  } else {
    bindings.migrationsComplete = true;
  }

  const shutdown = async (): Promise<void> => {
    bindings.log.info("Received shutdown signal. Starting graceful shutdown...");

    try {
      const promises: Promise<unknown>[] = [
        new Promise((resolve) => appServer.close(resolve)),
        bindings.db.client.close(),
      ];
      if (otelProviders) {
        promises.push(shutdownOtel(otelProviders));
      }
      if (metricsOnlyProviders) {
        promises.push(shutdownMetricsOnly(metricsOnlyProviders));
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
