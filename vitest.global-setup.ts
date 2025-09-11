import dockerCompose from "docker-compose";
import pino from "pino";
import type { TestProject } from "vitest/node";

const MAX_RETRIES = 300;
const composeOptions = {
  cwd: "./docker",
  composeOptions: [["--project-name", "nildb-tests"]],
};

const log = pino({
  transport: {
    target: "pino-pretty",
    options: {
      sync: true,
      singleLine: true,
      messageFormat: "globalSetup - {msg}",
    },
  },
});

export async function setup(_project: TestProject) {
  log.info("🚀 Starting containers...");

  try {
    // Check if containers are already running
    const psResult = await dockerCompose.ps(composeOptions);
    const allServicesUp =
      psResult.data.services?.length > 0 &&
      psResult.data.services.every((service) => service.state?.includes("Up"));

    if (allServicesUp) {
      log.info("✅ Containers already running, skipping startup.");
      return;
    }

    await dockerCompose.upAll(composeOptions);
    let retry = 0;
    for (; retry < MAX_RETRIES; retry++) {
      const result = await dockerCompose.ps(composeOptions);
      if (
        result.data.services.every((service) => service.state.includes("Up"))
      ) {
        break;
      }
      await new Promise((f) => setTimeout(f, 200));
    }
    if (retry >= MAX_RETRIES) {
      log.error("❌ Error starting containers: timeout");
      process.exit(1);
    }
    // Sleep for 2s to ensure AboutResponse.started is at least 2s earlier than the tests start.
    await new Promise((f) => setTimeout(f, 2000));
    log.info("✅ Containers started successfully.");
  } catch (error) {
    log.error({ error }, "❌ Error starting containers: ");
    process.exit(1);
  }
}

export async function teardown(_project: TestProject) {
  // Skip teardown if KEEP_INFRA environment variable is set
  if (process.env.KEEP_INFRA === "true") {
    log.info("🔄 Keeping infrastructure running as KEEP_INFRA=true");
    return;
  }

  log.info("🛑 Removing containers...");
  try {
    await dockerCompose.downAll(composeOptions);
    log.info("✅ Containers removed successfully.");
  } catch (error) {
    log.error({ error }, "❌ Error removing containers");
    process.exit(1);
  }
}
